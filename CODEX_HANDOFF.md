# Codex Handoff (Code-Accurate)

This file is the **engineering reference for AI contributors**.
Use it as source of truth before changing code.

## 1) Current Runtime Snapshot

- Backend entrypoint: `backend/main.py`
- Frontend entrypoint: `frontend/src/App.jsx`
- Backend version file: `backend/VERSION` (`4.4.13`)
- Frontend version files: `frontend/VERSION`, `frontend/public/VERSION` (`4.0.8`)
- Local backend start command (from `backend/`): `python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000`
- Local frontend usually runs on Vite default override in this project context (`5174` has been used)

Important:
- Do **not** run `uvicorn src.main:app` in this repo layout.
- API filename headers are used by frontend downloads; `Content-Disposition` is exposed via CORS.

---

## 2) Product Flow (Canonical)

1. **Profile Pool**: user builds master hierarchical profile (`profiles` + `profile_nodes`).
2. **Tailor CV**: dual-model pipeline analyzes job, scores fit, recommends nodes.
3. **Save Tailored CV**: creates snapshot draft in `tailored_cvs`.
4. **CV Portfolio / Tailored CV Detail**: user edits selection/content, recalculates scores, refines sections, previews/exports.
5. **Application Tracker**: finalizes into `job_applications` and tracks pipeline statuses + timestamps.

Keep strict separation:
- Profile Pool = source inventory
- Tailored CV = editable snapshot draft
- Job Application = finalized snapshot for tracking

---

## 3) Data Model and Invariants

## Core tables
- `users`
- `profiles`
- `profile_nodes` (self-referential tree)
- `tailored_cvs`
- `job_applications`

## Critical invariants
- `tailored_cvs.content_snapshot` and `tailored_cvs.selected_node_ids` must stay aligned.
- `tailored_cvs.original_snapshot` is pristine (used by restore).
- Recalculations append to `tailored_cvs.recalculated_scores`; do not overwrite initial scores.
- `job_applications.final_content_snapshot` is final immutable-at-creation snapshot from tailored CV at create time.
- Application status transitions set timestamp fields consistently (`ready_date`, `applied_date`, etc.).

---

## 4) Tailor CV Pipeline Details

Backend routes:
- `POST /api/tailor/analyze-job`
- `POST /api/tailor/score-profile`
- `POST /api/tailor/recommend-nodes`
- `POST /api/tailor/save`

### 4.1 Analyze Job
- OpenAI + Claude run in parallel.
- Uses per-user AI settings (`/api/user/ai-settings`), not hardcoded env-only behavior.
- Prompt template: `JOB_ANALYSIS_PROMPT` in `backend/ai_tailor_service.py`.
- Runtime metadata returned (`requested_model`, `resolved_model`, `api`, duration).

### 4.2 Score Profile
- Both models score in parallel.
- Each provider uses its **own analysis** when available; fallback to generic `job_requirements`.
- Prompt template shared for both providers: `SCORING_PROMPT` in `backend/ai_tailor_service.py`.
- Inputs include both:
  - Raw job description (authoritative)
  - Structured extracted requirements (helper)

### 4.3 Recommend Nodes
- Both models run in parallel.
- Uses provider-specific extracted requirements, plus raw JD.
- Prompt template shared for both providers: `NODE_SELECTION_PROMPT` in `backend/ai_tailor_service.py`.
- Nodes are flattened (`flatten_nodes_for_analysis`) to reduce tokens.
- Post-processing forces structural nodes (`section`/`entry`) to `include=true`.

### 4.4 Frontend Auto-Wizard Behavior (`frontend/src/components/TailorCV.jsx`)
- Job analysis auto-triggers scoring.
- Scoring gate:
  - If any fit/ATS score < 75, auto-advance stops.
  - If all >= 75, recommendations prefetch/trigger automatically.
- `selectedModel` controls recommendation auto-application behavior in UI.
- Save sends `job_analysis`, `recommendations`, scores, and selected nodes to `/api/tailor/save`.

---

## 5) CV Portfolio / Tailored CV Detail

Main component:
- `frontend/src/components/SavedCVDetail.jsx`

Backend routes:
- `GET/PUT/DELETE /api/tailor/{cv_id}`
- `POST /api/tailor/{cv_id}/recalculate-scores`
- `POST /api/tailor/{cv_id}/refine-section`
- `POST /api/tailor/{cv_id}/apply-refinement`
- `POST /api/tailor/{cv_id}/preview-pdf`
- `POST /api/tailor/{cv_id}/preview-metadata`
- `POST /api/tailor/{cv_id}/preview-image`
- `POST /api/tailor/{cv_id}/restore-original`

### 5.1 Autosave and selection
- Selection/content edits autosave with debounce.
- Snapshot updates must preserve selected/unselected state correctly.

### 5.2 Recalculate scores
- Uses same scoring services and prompt template as Tailor CV stage.
- Uses current selected-content snapshot (formatted CV from selected nodes).
- Stores history in `recalculated_scores`.

### 5.3 Section refinement
- Implemented in `refine_section_content_with_openai` (`backend/ai_tailor_service.py`).
- Currently always uses GPT-5.1 path for refinement call.
- Constraints enforce: no invention, edit target section/entry only, optional user instructions.

### 5.4 Personal refinement instruction templates
- Persisted per user in DB field: `users.refinement_instruction_templates`.
- API surface: `GET/PUT /api/user/ai-settings`.
- UI supports add/edit/delete custom templates.

---

## 6) User AI Settings (Per User, Persisted)

Backend:
- Fields on `users`: `openai_model`, `openai_reasoning_effort`, `claude_model`, `refinement_instruction_templates`
- Endpoints:
  - `GET /api/user/ai-settings`
  - `PUT /api/user/ai-settings`
- Startup bootstrap in `backend/main.py`:
  - `_ensure_user_ai_settings_columns()` adds missing columns and defaults.

Frontend:
- `frontend/src/components/ProfilePage.jsx` exposes dropdowns for:
  - OpenAI model (`gpt-4o`, `gpt-5.1`)
  - OpenAI reasoning effort
  - Claude model

---

## 7) Application Tracker Details

Key routes:
- `POST /api/applications/create`
- `GET /api/applications/check-duplicate/{tailored_cv_id}`
- `GET /api/applications/list`
- `GET/PUT/DELETE /api/applications/{application_id}`
- `POST /api/applications/{application_id}/move-to-preparing`
- `POST /api/applications/{application_id}/download-pdf`
- `POST /api/applications/{application_id}/export-pdf`

Behavior highlights:
- On create, backend forces fresh read of tailored CV snapshot before finalizing.
- If recalculated scores exist, latest recalculated scores become `final_*_scores`.
- Tailored CV status moves to `ready_to_apply`.
- Duplicate check exists before create.
- Moving app back to preparing deletes `job_application` and returns tailored CV to draft.

---

## 8) PDF / Filename Rules (Current)

Shared backend filename builder:
- `backend/main.py`:
  - `_sanitize_filename_part`
  - `_build_cv_export_filename`

Current naming format:
- `CV_<job title>_<company>_<full name>.pdf`

Applied consistently to:
- Tailored CV preview PDF
- Application download PDF
- Application export PDF

Frontend fallback download naming follows same format when header is unavailable.

---

## 9) Prompt and Model Control (Where to Edit)

If changing prompts, edit **once** in:
- `backend/ai_tailor_service.py`
  - `JOB_ANALYSIS_PROMPT`
  - `SCORING_PROMPT`
  - `NODE_SELECTION_PROMPT`

OpenAI transport/parsing compatibility:
- `backend/openai_wrapper.py`
  - GPT-4o uses `chat.completions`
  - GPT-5.1 uses `responses.create`
  - tolerant JSON parsing and repairs are centralized here

Claude parsing for node recommendation has extra repair/debug flow:
- `recommend_nodes_with_claude` in `backend/ai_tailor_service.py`

---

## 10) Known Fragile Areas

- Snapshot mutation logic in:
  - `/api/tailor/save`
  - `/api/tailor/{cv_id}` updates
  - `/api/tailor/{cv_id}/apply-refinement`
  - `/api/tailor/{cv_id}/recalculate-scores`
  - `/api/applications/create`
- Structural node forcing in recommendations (do not remove without replacement).
- Model/runtime display fields expected by frontend (`runtime.*`).
- PDF transformation logic appears both as shared helper and endpoint-local versions; keep output behavior consistent when touching either.

---

## 11) Safe Change Checklist (for future Codex sessions)

Before coding:
- Confirm whether change affects Profile Pool, Tailor CV, Portfolio, or Application Tracker.
- Identify if change touches draft snapshot, finalized snapshot, or both.
- Confirm whether prompts or model settings must remain centralized.

After coding:
- Run backend compile check: `python -m py_compile backend/main.py`
- Build frontend: `npm run build` in `frontend/`
- Verify critical paths manually:
  - Tailor flow (analyze -> score -> recommend -> save)
  - Portfolio recalc
  - Refinement + apply
  - Preview/export naming
  - Application create + status update

Versioning:
- Use `python bump_version.py backend|frontend|both patch|minor|major` as appropriate.
- Keep `frontend/VERSION` and `frontend/public/VERSION` aligned.

---

## 12) Practical Note on README

`README.md` is useful for product overview, but this file is the **implementation-level handoff** for contributors and AI agents.
When details conflict, verify code in:
- `backend/main.py`
- `backend/ai_tailor_service.py`
- `backend/openai_wrapper.py`
- `frontend/src/components/TailorCV.jsx`
- `frontend/src/components/SavedCVDetail.jsx`
- `frontend/src/components/ProfilePage.jsx`
