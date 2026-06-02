# Handoff — AI Tailoring Pipeline Rework

> **Audience:** the next Claude Code session (and Kamiar) continuing this work in VS Code.
> **Branch:** `claude/youthful-ritchie-XQGBI` (based on `main` @ `6ff89c1`, "Bump version to 4.4.20").
> **Date:** 2026-06-02.
> **Read this top-to-bottom before touching code.** It captures what the user wants, what
> was decided, what is already done (and tested), and exactly what is left — with enough
> detail to resume without re-discovering everything.

---

## 1. What the user (Kamiar) actually wants

This is a single-user-ish CV tailoring app (≤5 users, mostly the owner). The owner explicitly
prioritizes **accuracy and correctness over speed and cost** — slow, expensive, and *right*
beats fast and wrong. The product vision and the concrete asks that kicked this off:

1. **Selection must understand hierarchy.** When the AI decides which profile pieces go on a
   tailored CV, it must judge each bullet *in the context of its parent role/section*, not as
   a flat, context-free list. The model only ever returns per-node decisions; the hierarchy
   and relationships stay server-side.
2. **Dual-model for scoring, single-model for selection.** Keep the two-AI (OpenAI + Claude)
   comparison for *scoring* (it's a useful second opinion), but do *selection* with a single
   primary model (the dual-vote selection UX adds complexity without enough payoff).
3. **Score the SELECTED nodes each round, not the whole profile.** The whole point of the
   optimization loop is to maximize the score of the CV you're actually building. So the
   optimization/ATS score must be computed on the currently-selected, rendered CV and
   recomputed every round — *not* on the full profile.
4. **One renderer, no duplication.** There were multiple, divergent ways of turning the node
   tree into text for the AI. Collapse them into a single source of truth. (`main.py` is also
   a 5,700-line monolith that the user wants split into routers.)
5. **Honest product story + guardrails.** The old marketing line was "AI NEVER generates new
   content, ONLY selects." Reality: there *is* a refinement/polish step. The user wants the
   story to be truthful — *select → polish wording → authenticity-check* — and wants the
   "never invent facts" promise **enforced in code**, not just asked for in a prompt.
6. **Structured outputs.** Replace brittle "ask for JSON, then repair malformed JSON" with
   provider-native structured outputs (OpenAI structured outputs / JSON schema, Claude
   tool-use) so responses are schema-valid by construction.

The user approved doing the **full plan, in order**:

> safety net → renderer → scoring → dual/single-select → structured outputs → dedup/router-split → guardrails

---

## 2. Key findings about the codebase (so you don't re-learn them)

**The backend is `backend/`, FastAPI + SQLAlchemy + Postgres. Frontend is React (Vite) in
`frontend/`.** AI logic lives in `backend/ai_tailor_service.py`; the HTTP layer is
`backend/main.py` (~5,700 lines, the monolith).

### 2.1 There were THREE different node→text serializers (the core duplication problem)

| Function | Location (original) | Problem |
|---|---|---|
| `profile_nodes_to_text` | `ai_tailor_service.py` | Lost the node **ids** → model couldn't reference nodes reliably. |
| `flatten_nodes_for_analysis` | `ai_tailor_service.py` | **Flattened** the tree → lost hierarchy → selection judged bullets context-free. |
| `format_hierarchical_cv_for_ai` | `format_hierarchical_cv.py` | A *third* selected-only serializer used for scoring/humanity. Verbose box format. |

These have now been consolidated onto **one renderer** (see §3).

### 2.2 The "force structural nodes" hack (selection)

In the `recommend-nodes` endpoint, after the model returned per-node include/exclude
decisions, the code **blanket-forced every `section` and `entry` to `include=true`** to "preserve
hierarchy." This was wrong: it would keep a role on the CV even when *none* of its bullets were
selected (empty roles leaking onto the CV). Replaced with a deterministic rule (see §3).

### 2.3 Fit vs Optimization scores were conflated

- `/api/tailor/score-profile` scored the **whole profile** and that became the stored headline.
- `/api/tailor/{cv_id}/recalculate-scores` (Portfolio) already scored **only selected** nodes
  via `format_hierarchical_cv_for_ai` — so the per-round optimization loop *did* exist there,
  but the initial headline reflected the whole profile, which is misleading.

The intended mental model (now documented in README "Behavioral Invariants"):
- **Candidate Fit** = whole profile vs JD → answers "should I apply?".
- **CV Optimization (ATS/match)** = *selected nodes only*, rendered to the exact CV text,
  recomputed each round → the number the optimization loop maximizes.

### 2.4 JSON handling is brittle

Both providers are prompted to "return ONLY valid JSON," then responses go through repair
logic. Claude uses `messages.create` with a system prompt begging for clean JSON; OpenAI uses
`call_openai_for_json` (`openai_wrapper.py`). This is the target for Stage ⑥ (structured outputs).

### 2.5 Environment / testing reality in the web sandbox

- The full backend deps **do not install** here: the PDF stack (`svglib`/`reportlab`/etc.)
  fails to build. So `main.py` cannot be imported wholesale in this sandbox.
- Installed for testing: `pytest`, `anthropic`, `openai`, `sqlalchemy`, `pydantic[email]`.
  That's enough to import `models.py`, `ai_tailor_service.py`, `profile_render.py`,
  `refinement_guards.py`, `format_hierarchical_cv.py`.
- **Test strategy used:** unit-test the pure logic layer; use `python3 -m py_compile` as a
  smoke check for the endpoint wiring in `main.py`. In VS Code with a full local env + DB you
  can (and should) run the app end-to-end before the bigger refactors.

---

## 3. What was DONE in this session (committed, tested)

6 commits on `claude/youthful-ritchie-XQGBI` (newest last):

```
e360ddc  Add single profile-outline renderer with hierarchy + stable IDs
91ece6c  Feed selection model the hierarchical outline; derive structural inclusion
d7e70b7  Unify CV-text rendering for scoring; clarify fit vs optimization metrics
2263344  Add code-enforced 'polish, never invent' guardrail to refinement
ea8391e  docs: align product philosophy with code; document renderer + metric split
f8445f9  Bump backend version to 4.4.21
```

(Plus a 7th commit adding *this* document — see end.)

### Stage ① — The single renderer  ✅  (addresses asks #1, #4)

**New file `backend/profile_render.py`** — the one source of truth for turning the node tree
into text the AI reads:

- `render_profile_outline(nodes, *, include_ids=True, only_selected=False, depth=0)` →
  an **indented, CV-like outline** that preserves parent→child structure, with each line tagged
  `[#<id> <type>]`, e.g.:
  ```
  § [#12 section] Work Experience
    ▸ [#34 entry] Senior Data Engineer · Acme Corp · 2021–2024 · Stockholm
      • [#56 bullet] Built distributed pipelines processing 10TB/day
  ```
  Markers: `§` section, `▸` entry, `•` bullet/item, `¶` paragraph, `-` unknown (never throws).
- `render_cv_for_scoring(content_snapshot, job_title, company_name)` → the **selected-only** CV
  text (with a TAILORED-FOR / contact header) used for optimization scoring + humanity checks.
- `compute_included_ids(nodes, selected_ids)` → deterministic structural inclusion: returns
  every selected id **plus all ancestors of any selected id**. This is the replacement for the
  "force every section/entry" hack: a container is included **iff it has a selected descendant.**
- `iter_nodes(nodes)` → depth-first traversal helper.

**Wiring done:**
- `ai_tailor_service.py`: imports the renderer; new helper `_render_nodes_for_prompt()`;
  both `recommend_nodes_with_openai` and `recommend_nodes_with_claude` now send the **outline**
  (not `json.dumps` of flat nodes). The `NODE_SELECTION_PROMPT` was updated with a "How to read
  the profile outline" section so the model knows ids come from `[#id type]` tags.
- `main.py` `recommend-nodes` endpoint: passes the **hierarchical `nodes_list`** to the two
  selection functions (was passing `flat_nodes`); size logging now measures the outline.
- `format_hierarchical_cv.py`: `format_hierarchical_cv_for_ai` is now a **thin shim** delegating
  to `render_cv_for_scoring` (dedup; single caller is `recalculate-scores`).

### Stage ② post-process — deterministic structural inclusion  ✅ (part of ask #1)

In `recommend-nodes`, the old `force_structural_nodes` was replaced by `apply_structural_inclusion`:
the model's `include` is authoritative only for **leaf/content nodes** (no children); containers
are then included iff `compute_included_ids` says they have a selected descendant. Missing
ancestors are added; summary counts recomputed.

### Stage ③ — Score the selected, rendered CV  ✅ (ask #3)

- `score-profile` whole-profile candidate-fit now renders via `render_profile_outline(..., include_ids=False)`
  and carries a comment documenting the fit-vs-optimization split.
- The selected-only optimization path (`recalculate-scores` → `format_hierarchical_cv_for_ai`)
  now flows through `render_cv_for_scoring`. So both metrics share one renderer, and the
  optimization score reflects exactly the selected CV text, each round.
- The node-refine **context** (`main.py` ~line 2471) also uses the renderer now.

### Stage ⑤ — Guardrails + honest story  ✅ PARTIAL (asks #5, #6-philosophy)

**New file `backend/refinement_guards.py`** — pure, tested "polish, never invent" enforcement:
- `audit_refinement(original, refined, *, profile_corpus="")` → `{hard_violation, invented_numbers, warnings, ok}`.
- **Hard violation = a number/metric in the refined text that exists nowhere in the original
  node or the full CV** (e.g. turning "improved performance" into "improved performance by 40%").
- Soft **warnings** = capitalized/acronym/tech-like terms (potential skills/tools) introduced
  by refinement but absent from the source.
- Wired into `/api/tailor/{cv_id}/refine-section`: the response now carries an `integrity`
  report (soft — the UI can warn / let the user revert; it never silently rewrites facts).
- README philosophy sections rewritten to the truthful select → polish → authenticity story,
  and the renderer / metric-split / inclusion rule added as "Behavioral Invariants."

### Safety net  ✅ (18 passing tests)

- `backend/pytest.ini`, `backend/tests/__init__.py`
- `backend/tests/test_profile_render.py` (11 tests): hierarchy/indentation, metadata, id
  toggle, only-selected filtering, open-ended dates, unknown types, `compute_included_ids`
  ancestor pull-in, `render_cv_for_scoring`.
- `backend/tests/test_refinement_guards.py` (7 tests): number extraction/formats, invented vs
  preserved numbers, corpus allowance, new-term warnings, hard-vs-warning separation.

Run them:
```bash
cd backend
pip install pytest anthropic openai sqlalchemy "pydantic[email]"   # if not already present
python3 -m pytest -q
```

---

## 4. What is LEFT to do (in order) — with implementation guidance

These were intentionally **not** done in the web sandbox because they need the running app +
Postgres to verify safely. Do them in VS Code with the app runnable and tests green.

### Stage ② — Dual-score / single-select  (ask #2)  — NOT STARTED

**Goal:** keep dual-AI scoring; make node **selection** use a single primary model.

**Backend** (`main.py` `recommend-nodes`): currently runs both `recommend_nodes_with_openai`
and `recommend_nodes_with_claude` in a `ThreadPoolExecutor`. Change to run only the user's
chosen selection provider. Add a `selection_model` preference (or reuse the existing
`selected_model` notion used at save). Default to OpenAI.

**Frontend** (the harder part — verify in a browser): the dual-badge / voting selection UX is
woven through `frontend/src/.../TailorCV.jsx` and `SavedCVDetail.jsx`. The frontend reads
`recommendations.openai` and `recommendations.claude`. If you return only one provider, update
the UI to a single-source selection view. **Do not ship this without clicking through it.**
Consider keeping the response shape (`recommendations.<provider>`) but populating only one key,
to minimize frontend churn.

### Stage ⑥ — Structured outputs  (ask #6)  — NOT STARTED

**Goal:** replace "prompt for JSON + repair" with provider-native schema enforcement.

- **OpenAI:** use Structured Outputs (`response_format` with a JSON schema / `json_schema`
  mode) in `openai_wrapper.py` (`call_openai_for_json`). Define schemas for: job-analysis,
  node-selection (`{selected_nodes: [{id, include, confidence, reason, relevance_tags}], selection_summary}`),
  and scoring.
- **Claude:** use **tool-use** with an `input_schema` and force the tool, then read the tool
  input as the structured result (instead of parsing free-text JSON). Update
  `recommend_nodes_with_claude` and the Claude scoring functions.
- Keep the repair logic as a fallback for one release, then delete it.
- These are isolated changes but **must be tested against live API responses** — that's why
  they were deferred out of the sandbox.

### Stage ④ — Dedup + split `main.py` into routers  (ask #4)  — NOT STARTED (highest risk)

**Goal:** break the 5,700-line monolith into FastAPI routers; remove dead serializers.

- Suggested router split: `auth`, `profile`, `tailor` (analyze/score/recommend/refine),
  `applications`, `admin`, `settings`. Use `APIRouter` per module under `backend/routers/`.
- **Now-dead code to remove** once nothing references them: `profile_nodes_to_text` and
  `flatten_nodes_for_analysis` in `ai_tailor_service.py` (grep first — there may be stragglers).
- **Do the safety net FIRST for this stage:** before moving endpoints, get the app running with
  a test DB and add a few integration/endpoint tests (FastAPI `TestClient`) for the critical
  flows (analyze → score → recommend → save → recalculate → download). Move endpoints in small
  batches, keeping tests green between each. This is the stage most likely to cause regressions.

### Stage ⑤ remainder — guardrail UX  — PARTIAL

The backend `integrity` report is returned but the **frontend doesn't surface it yet**. Add UI
in the refine/preview component to show invented-number violations prominently and term
warnings subtly, with an easy "revert to original" (the response already includes
`original_content`). Decide whether invented-number violations should *block* apply or just warn
(current backend default: warn — `hard_violation` flag is advisory).

---

## 5. Conventions & gotchas

- **Versioning:** `python3 bump_version.py backend patch` bumps `backend/VERSION` (currently
  `4.4.21`). Update `CHANGELOG.md` when you bump (the script reminds you).
- **Do not** put the model identifier or internal notes into commit messages / PR bodies.
- **Renderer ids:** AI **input** uses `include_ids=True` (so the model can reference nodes);
  **scoring/export** uses `include_ids=False` (clean text). Don't mix these up.
- **`only_selected`** semantics: `render_profile_outline(only_selected=True)` skips nodes whose
  `is_selected` is falsy (default treats missing as **not** selected). `content_snapshot` nodes
  always carry explicit `is_selected`, so this is safe there.
- **Behavioral invariants** (also in README): keep `content_snapshot` ⇄ `selected_node_ids` in
  sync; never mutate `original_snapshot`; two-metrics/two-inputs rule; one renderer; derived
  structural inclusion; integrity guardrail on refinement.

---

## 6. Git / how this reached you

This session ran in Claude Code **on the web**, where the GitHub integration had **read-only**
access to the repo (confirmed: `git push` → 403, and GitHub API `create_branch` →
"Resource not accessible by integration"). So the commits could not be pushed from the session.
They were delivered to Kamiar as a **git bundle** and a **patch series**, to be pushed manually
from a local clone (which has write access). In VS Code you'll have the real branch once pushed.

To get the branch locally from the bundle:
```bash
git fetch /path/to/agentic_work_profile.bundle \
  claude/youthful-ritchie-XQGBI:claude/youthful-ritchie-XQGBI
git checkout claude/youthful-ritchie-XQGBI
git push -u origin claude/youthful-ritchie-XQGBI   # from a machine with write access
```

---

## 7. TL;DR for the next session

- ✅ Done & tested: one renderer (`profile_render.py`), hierarchy-aware **selection**,
  deterministic structural inclusion, unified **selected-CV scoring**, fit-vs-optimization
  clarified, **refinement integrity guardrail** (`refinement_guards.py`), honest README, 18 tests.
- ⏭️ Next, in order: **② single-select** (backend small, frontend needs browser verification) →
  **⑥ structured outputs** (test vs live APIs) → **④ router split** (write integration tests
  FIRST; highest regression risk) → **⑤ guardrail UI** surfacing the `integrity` report.
- 🧭 Guiding principle: the owner wants **accuracy over speed/cost**. Verify changes by running
  the app, not just by reading code.
