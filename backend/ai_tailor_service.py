"""
AI Service for Tailored CV Analysis
Handles job description analysis, scoring, and node selection recommendations
using both OpenAI and Claude models.
"""

import os
import json
import time
import re
from collections import Counter
from statistics import mean, pstdev
from anthropic import Anthropic
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from openai_wrapper import call_openai_for_json
from logger_config import get_logger
from profile_render import render_profile_outline, compute_included_ids
from ai_schemas import JOB_ANALYSIS_SCHEMA, SCORING_SCHEMA, NODE_SELECTION_SCHEMA, SKILL_WEAVE_SCHEMA, REFINE_ALL_SCHEMA, REFINE_SECTION_SCHEMA, COVER_LETTER_SCHEMA, claude_tool
from refinement_guards import audit_refinement


def _render_nodes_for_prompt(profile_nodes: List[Dict]) -> str:
    """
    Serialize profile nodes for an AI prompt.

    Accepts the hierarchical node tree and renders the CV-like indented outline
    (with stable [#id type] tags) so the model can reason about parent->child
    structure. Falls back to a JSON dump only if a non-tree value is passed.
    """
    if isinstance(profile_nodes, list):
        return render_profile_outline(profile_nodes)
    return json.dumps(profile_nodes, indent=2)


def _extract_claude_tool_input(response: Any) -> Dict[str, Any]:
    """
    Return the ``input`` dict of the first tool_use block in a Claude response.

    With a forced ``tool_choice`` Claude returns a tool_use block, but it may be
    preceded by other content blocks (e.g. a text or thinking block). Scan for
    the tool_use block instead of assuming it is ``content[0]`` so a leading
    non-tool block doesn't raise a misleading "Expected tool_use" error.
    """
    content = getattr(response, "content", None)
    if not content:
        raise ValueError("Claude returned empty content")
    for block in content:
        if getattr(block, "type", None) == "tool_use":
            return block.input
    block_types = [getattr(b, "type", "?") for b in content]
    raise ValueError(f"Claude returned no tool_use block (got blocks: {block_types})")


# Current default OpenAI model. The selectable list is fetched live from the
# provider; this is only the fallback the pipeline uses when none is supplied.
# gpt-4o was deprecated by OpenAI in 2026-02.
DEFAULT_OPENAI_MODEL = os.getenv("OPENAI_MODEL_VERSION", "gpt-5.5")


def _uses_reasoning(model: Optional[str]) -> bool:
    """Whether a model id supports the reasoning-effort parameter (gpt-5.x / o-series)."""
    value = (model or "").strip().lower()
    return value.startswith("gpt-5") or value.startswith("o")


# Initialize logger
logger = get_logger("TailorService")


def sanitize_unicode_for_pdf(text: str) -> str:
    """
    Sanitize Unicode characters from AI-generated text to prevent PDF encoding errors.
    Replaces smart quotes, en-dashes, and other Unicode with ASCII equivalents.
    """
    if not text:
        return text

    replacements = {
        '\u2013': '-',      # EN DASH
        '\u2014': '--',     # EM DASH
        '\u2018': "'",      # LEFT SINGLE QUOTATION MARK
        '\u2019': "'",      # RIGHT SINGLE QUOTATION MARK
        '\u201c': '"',      # LEFT DOUBLE QUOTATION MARK
        '\u201d': '"',      # RIGHT DOUBLE QUOTATION MARK
        '\u2022': '*',      # BULLET
        '\u2026': '...',    # HORIZONTAL ELLIPSIS
        '\u00a0': ' ',      # NON-BREAKING SPACE
        '\u2212': '-',      # MINUS SIGN
    }

    for unicode_char, replacement in replacements.items():
        text = text.replace(unicode_char, replacement)

    # Remove any remaining characters outside latin-1 range
    cleaned_chars = []
    for char in text:
        if ord(char) <= 255:
            cleaned_chars.append(char)
        else:
            # Skip or replace with safe character
            pass

    return ''.join(cleaned_chars)


def strip_ai_dashes(text: str) -> str:
    """
    Remove the em/en dashes and double hyphens that read as 'AI writing'.

    A dash used as a clause separator becomes a comma; real hyphenated words
    ('data-driven') are left intact. Smart quotes/ellipsis are normalized to
    ASCII, but unlike sanitize_unicode_for_pdf the em-dash is NOT turned into
    '--' (which the user explicitly does not want).
    """
    if not text:
        return text

    for ch, repl in {
        '‘': "'", '’': "'", '“': '"', '”': '"',
        '…': '...', ' ': ' ', '−': '-',
    }.items():
        text = text.replace(ch, repl)

    # Em/en dash used as a separator -> comma. Stay within a line so markdown
    # structure (newlines, list markers) survives.
    text = re.sub(r'[ \t]*[—–]+[ \t]*', ', ', text)
    # ASCII double hyphen used as a dash -> comma. Only between non-space chars,
    # so a line-leading "-- " is never touched.
    text = re.sub(r'(?<=\S)[ \t]*--+[ \t]*(?=\S)', ', ', text)
    # " - " (spaced single hyphen) -> comma, but ONLY with a space before the
    # hyphen, so markdown list markers ("\n- item") and tight hyphens inside
    # words ("data-driven") are both left intact.
    text = re.sub(r'(?<=\S)[ \t]+-[ \t]+(?=\S)', ', ', text)

    # Tidy up artifacts within a line (never collapse newlines).
    text = re.sub(r'[ \t]*,[ \t]*,', ',', text)
    text = re.sub(r'[ \t]+([,.;:!?])', r'\1', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    return text.strip().strip(',').strip()

# Initialize AI clients
VALID_REASONING_EFFORT = {"none", "low", "medium", "high"}


def _resolve_reasoning_effort(reasoning_effort: str = None) -> str:
    value = (reasoning_effort or os.getenv("OPENAI_REASONING_EFFORT", "medium")).strip().lower()
    if value not in VALID_REASONING_EFFORT:
        return "medium"
    return value


# Claude "thinking" levels. claude.ai exposes low/medium/high/max for Opus 4.8;
# these map to output_config.effort. "off" disables extended thinking entirely.
# Effort is a separate axis from OpenAI's reasoning_effort and applies only to
# Claude calls. Default is High (deeper thinking, accuracy over speed).
VALID_CLAUDE_EFFORT = {"off", "low", "medium", "high", "max"}
DEFAULT_CLAUDE_EFFORT = (os.getenv("CLAUDE_EFFORT", "high") or "high").strip().lower()
if DEFAULT_CLAUDE_EFFORT not in VALID_CLAUDE_EFFORT:
    DEFAULT_CLAUDE_EFFORT = "high"


def _resolve_claude_effort(effort: Optional[str]) -> str:
    value = (effort or DEFAULT_CLAUDE_EFFORT).strip().lower()
    if value not in VALID_CLAUDE_EFFORT:
        return DEFAULT_CLAUDE_EFFORT
    return value


def _extract_claude_json(response: Any) -> Dict[str, Any]:
    """
    Parse the JSON object from a Claude structured-output response.

    With ``output_config.format`` = json_schema, the structured result is returned
    as a text block (and that approach is compatible with extended thinking, unlike
    forced tool_choice). Any leading thinking block is skipped. A tool_use block is
    still honored if one is present, so this also handles legacy tool-use responses.
    """
    content = getattr(response, "content", None)
    if not content:
        raise ValueError("Claude returned empty content")
    text_parts = []
    for block in content:
        btype = getattr(block, "type", None)
        if btype == "tool_use":
            return block.input
        if btype == "text":
            text_parts.append(getattr(block, "text", "") or "")
    raw = "\n".join(p for p in text_parts if p).strip()
    if not raw:
        block_types = [getattr(b, "type", "?") for b in content]
        raise ValueError(f"Claude returned no text/tool_use block (got blocks: {block_types})")
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z0-9]*\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("{"), raw.rfind("}")
        if start != -1 and end > start:
            return json.loads(raw[start:end + 1])
        raise


# Extended thinking tokens count against ``max_tokens``, so when thinking is on we
# add headroom on top of the answer budget, scaled by effort, capped at the model's
# 128K output limit. Without this, deep thinking (especially at high/max) can
# consume the whole budget and leave no room for the structured answer.
_CLAUDE_THINKING_HEADROOM = {"low": 8000, "medium": 16000, "high": 32000, "max": 48000}
_CLAUDE_MAX_OUTPUT_TOKENS = 120000


def call_claude_structured(
    *,
    api_key: str,
    model: str,
    system: str,
    user_prompt: str,
    schema: Dict[str, Any],
    max_tokens: int = 8192,
    effort: Optional[str] = None,
    timeout: float = 120.0,
):
    """
    Run a Claude structured-output call using ``output_config.format`` (json_schema).

    This is Anthropic's recommended structured-output method and, unlike forced
    ``tool_choice``, it is compatible with extended thinking. ``effort`` ('off' |
    'low' | 'medium' | 'high' | 'max') controls thinking depth, mirroring the
    levels claude.ai shows for Opus 4.8; 'off' disables thinking. The call streams
    so long thinking passes don't trip request timeouts.

    Returns ``(data, resolved_model, effort_used)`` where ``effort_used`` is the
    empty string when thinking is off.
    """
    resolved_effort = _resolve_claude_effort(effort)
    client = Anthropic(api_key=api_key)
    output_config: Dict[str, Any] = {
        "format": {"type": "json_schema", "schema": schema}
    }
    effective_max_tokens = max_tokens
    create_kwargs: Dict[str, Any] = {
        "model": model,
        "system": system,
        "messages": [{"role": "user", "content": user_prompt}],
        "output_config": output_config,
        "timeout": timeout,
    }
    if resolved_effort == "off":
        create_kwargs["thinking"] = {"type": "disabled"}
    else:
        create_kwargs["thinking"] = {"type": "adaptive"}
        output_config["effort"] = resolved_effort
        headroom = _CLAUDE_THINKING_HEADROOM.get(resolved_effort, 16000)
        effective_max_tokens = min(max_tokens + headroom, _CLAUDE_MAX_OUTPUT_TOKENS)
    create_kwargs["max_tokens"] = effective_max_tokens

    # Stream and assemble the final message (avoids request-timeout on long thinking
    # / large structured outputs, per Anthropic guidance for high max_tokens).
    with client.messages.stream(**create_kwargs) as stream:
        response = stream.get_final_message()

    if getattr(response, "stop_reason", None) == "max_tokens":
        raise ValueError(
            "Claude hit the output token limit before finishing the structured answer. "
            "Try a lower Claude thinking effort in AI Settings."
        )
    data = _extract_claude_json(response)
    resolved_model = getattr(response, "model", model)
    return data, resolved_model, ("" if resolved_effort == "off" else resolved_effort)


def _safe_score(value: Any, default: int = 0) -> int:
    """Normalize score-like values to int in [0, 100]."""
    try:
        score = int(round(float(value)))
    except (TypeError, ValueError):
        score = default
    return max(0, min(100, score))


def _safe_list_of_strings(value: Any, max_items: int = 25, max_len: int = 400) -> List[str]:
    """Normalize model output fields into clean string lists."""
    if not isinstance(value, list):
        return []
    out = []
    for item in value:
        if item is None:
            continue
        text = str(item).strip()
        if not text:
            continue
        out.append(text[:max_len])
        if len(out) >= max_items:
            break
    return out


def _normalize_scores_payload(scores: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize scoring output to stable frontend-friendly schema.
    Keeps wizard rendering stable when model outputs slightly drift.
    """
    normalized = {
        "fit_score": _safe_score(scores.get("fit_score")),
        "fit_reasoning": str(scores.get("fit_reasoning", "")).strip(),
        "ats_score": _safe_score(scores.get("ats_score")),
        "ats_reasoning": str(scores.get("ats_reasoning", "")).strip(),
        "verdict": str(scores.get("verdict", "CONSIDER_APPLYING")).strip().upper(),
        "verdict_reasoning": str(scores.get("verdict_reasoning", "")).strip(),
        "strengths": _safe_list_of_strings(scores.get("strengths")),
        "missing_skills": _safe_list_of_strings(scores.get("missing_skills")),
        "critical_gaps": _safe_list_of_strings(scores.get("critical_gaps")),
        "matching_skills": _safe_list_of_strings(scores.get("matching_skills")),
        "recommendations": _safe_list_of_strings(scores.get("recommendations")),
    }

    allowed_verdicts = {"SHOULD_APPLY", "CONSIDER_APPLYING", "SHOULD_NOT_APPLY"}
    if normalized["verdict"] not in allowed_verdicts:
        normalized["verdict"] = "CONSIDER_APPLYING"

    return normalized


def _normalize_recommendations_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize node recommendation payload to stable schema.
    - Coerces id/node_id to int id
    - Coerces confidence to 0..1 (supports 0..100 input)
    - Ensures reason/tags are consistently typed
    """
    selected_nodes = data.get("selected_nodes", [])
    if not isinstance(selected_nodes, list):
        selected_nodes = []

    normalized_nodes = []
    for rec in selected_nodes:
        if not isinstance(rec, dict):
            continue

        rec_id = rec.get("id", rec.get("node_id"))
        try:
            rec_id = int(rec_id)
        except (TypeError, ValueError):
            continue

        include = bool(rec.get("include", False))

        confidence_raw = rec.get("confidence", 0.5)
        try:
            confidence = float(confidence_raw)
        except (TypeError, ValueError):
            confidence = 0.5
        if confidence > 1.0 and confidence <= 100.0:
            confidence = confidence / 100.0
        confidence = max(0.0, min(1.0, confidence))

        reason = str(rec.get("reason", "")).strip()
        relevance_tags = _safe_list_of_strings(rec.get("relevance_tags"), max_items=8, max_len=80)

        normalized_nodes.append({
            "id": rec_id,
            "include": include,
            "confidence": confidence,
            "reason": reason,
            "relevance_tags": relevance_tags
        })

    include_count = sum(1 for n in normalized_nodes if n["include"])
    exclude_count = len(normalized_nodes) - include_count

    selection_summary = data.get("selection_summary", {})
    if not isinstance(selection_summary, dict):
        selection_summary = {}

    def _safe_int(value: Any, default: int) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    normalized_summary = {
        "total_nodes": _safe_int(selection_summary.get("total_nodes"), len(normalized_nodes)),
        "recommended_include": _safe_int(selection_summary.get("recommended_include"), include_count),
        "recommended_exclude": _safe_int(selection_summary.get("recommended_exclude"), exclude_count),
    }

    # Preserve optional informational fields if present
    if "expected_cv_length" in selection_summary:
        normalized_summary["expected_cv_length"] = str(selection_summary.get("expected_cv_length", "")).strip()
    if "tailoring_percentage" in selection_summary:
        normalized_summary["tailoring_percentage"] = str(selection_summary.get("tailoring_percentage", "")).strip()

    return {
        "selected_nodes": normalized_nodes,
        "selection_summary": normalized_summary,
        "tailoring_strategy": str(data.get("tailoring_strategy", "")).strip()
    }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


try:
    HUMANITY_DEFAULT_THRESHOLD = int(os.getenv("HUMANITY_SCORE_BLOCK_THRESHOLD", "70"))
except (TypeError, ValueError):
    HUMANITY_DEFAULT_THRESHOLD = 70
HUMANITY_DEFAULT_THRESHOLD = max(0, min(100, HUMANITY_DEFAULT_THRESHOLD))
HUMANITY_LLM_MODEL = os.getenv("HUMANITY_LLM_MODEL", "gpt-5.5")
HUMANITY_LLM_REASONING = os.getenv("HUMANITY_LLM_REASONING_EFFORT", "low")
HUMANITY_DEEP_MODE_ENABLED = os.getenv("HUMANITY_DEEP_MODE_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}

# Phrases that strongly correlate with synthetic/AI-heavy CV phrasing.
AI_VOICE_PHRASES = [
    "dynamic professional",
    "results-driven",
    "proven track record",
    "highly motivated",
    "fast-paced environment",
    "passionate about",
    "thought leader",
    "synergy",
    "cutting-edge",
    "innovative solutions",
    "leveraged",
    "spearheaded initiatives",
]

GENERIC_FLUFF_PHRASES = [
    "responsible for",
    "worked on",
    "involved in",
    "various projects",
    "excellent communication skills",
    "team player",
    "hardworking",
]

WEAK_BULLET_STARTERS = {
    "responsible for",
    "worked on",
    "helped with",
    "assisted with",
    "involved in",
}


def _extract_numeric_tokens(text: str) -> set:
    if not text:
        return set()
    tokens = re.findall(r"\b\d+(?:\.\d+)?%?\b", text)
    return {t.strip() for t in tokens if t.strip()}


def _truncate_text(text: str, max_len: int = 140) -> str:
    value = (text or "").strip()
    if len(value) <= max_len:
        return value
    return value[: max_len - 3].rstrip() + "..."


def _indexed_non_empty_lines(text: str) -> List[tuple]:
    return [
        (idx + 1, ln.strip())
        for idx, ln in enumerate((text or "").splitlines())
        if ln and ln.strip()
    ]


def _line_evidence(indexed_lines: List[tuple], predicate, max_hits: int = 4) -> List[Dict[str, Any]]:
    hits = []
    for line_no, line_text in indexed_lines:
        if predicate(line_text):
            hits.append({
                "line": line_no,
                "text": _truncate_text(line_text, max_len=160)
            })
        if len(hits) >= max_hits:
            break
    return hits


def _evaluate_humanity_heuristics(
    text: str,
    source_text: str = "",
    threshold: int = HUMANITY_DEFAULT_THRESHOLD
) -> Dict[str, Any]:
    """
    Heuristic guard for human-written tone and grounded claims.
    Returns a stable report for UI + export/refinement enforcement.
    """
    content = (text or "").strip()
    if not content:
        return {
            "score": 0,
            "risk_level": "high",
            "requires_confirmation": True,
            "passes_guard": False,
            "threshold": threshold,
            "critical_violations": 1,
            "total_violations": 1,
            "violations": [{
                "type": "empty_content",
                "severity": "critical",
                "message": "Refined content is empty."
            }],
            "stats": {
                "bullet_count": 0,
                "bullets_with_metrics": 0,
                "metric_ratio": 0.0
            }
        }

    lower = content.lower()
    indexed_lines = _indexed_non_empty_lines(content)
    lines = [ln for _, ln in indexed_lines]
    bullet_indexed = [(line_no, ln) for line_no, ln in indexed_lines if ln.startswith("- ")]
    bullet_lines = [ln for _, ln in bullet_indexed]
    bullet_bodies = [ln[2:].strip().lower() for ln in bullet_lines]

    violations = []
    risk_points = 0

    # 1) AI-voice and fluff phrase checks
    ai_hits = []
    for phrase in AI_VOICE_PHRASES:
        count = len(re.findall(rf"\b{re.escape(phrase)}\b", lower))
        if count > 0:
            ai_hits.append({"phrase": phrase, "count": count})
            risk_points += min(5 * count, 15)
    if ai_hits:
        ai_patterns = [re.compile(rf"\b{re.escape(item['phrase'])}\b", re.IGNORECASE) for item in ai_hits]
        where_hits = _line_evidence(
            indexed_lines,
            lambda ln: any(pattern.search(ln) for pattern in ai_patterns),
            max_hits=4
        )
        violations.append({
            "type": "ai_voice_phrases",
            "severity": "high",
            "message": "Detected phrases often associated with AI-generated or generic writing.",
            "evidence": ai_hits,
            "where": where_hits,
            "how_to_fix": [
                "Replace buzzword-heavy wording with concrete actions you personally did.",
                "Use specific scope, tools, and outcomes instead of generic positioning phrases."
            ]
        })

    generic_hits = []
    for phrase in GENERIC_FLUFF_PHRASES:
        count = len(re.findall(rf"\b{re.escape(phrase)}\b", lower))
        if count > 0:
            generic_hits.append({"phrase": phrase, "count": count})
            risk_points += min(3 * count, 12)
    if generic_hits:
        generic_patterns = [re.compile(rf"\b{re.escape(item['phrase'])}\b", re.IGNORECASE) for item in generic_hits]
        where_hits = _line_evidence(
            indexed_lines,
            lambda ln: any(pattern.search(ln) for pattern in generic_patterns),
            max_hits=4
        )
        violations.append({
            "type": "generic_filler",
            "severity": "medium",
            "message": "Detected generic phrasing that weakens credibility.",
            "evidence": generic_hits,
            "where": where_hits,
            "how_to_fix": [
                "Rewrite each flagged line with a concrete action verb and direct outcome.",
                "Delete filler statements that do not add role-relevant evidence."
            ]
        })

    # 2) Weak bullet openings
    weak_opening_hits = []
    weak_opening_where = []
    starter_by_line = {}
    for body in bullet_bodies:
        for starter in WEAK_BULLET_STARTERS:
            if body.startswith(starter):
                weak_opening_hits.append(starter)
                risk_points += 3
                break
    for line_no, line_text in bullet_indexed:
        normalized = line_text[2:].strip().lower()
        for starter in WEAK_BULLET_STARTERS:
            if normalized.startswith(starter):
                weak_opening_where.append({
                    "line": line_no,
                    "text": _truncate_text(line_text, max_len=160)
                })
                starter_by_line[line_no] = starter
                break
    if weak_opening_hits:
        counts = Counter(weak_opening_hits)
        violations.append({
            "type": "weak_bullet_openings",
            "severity": "medium",
            "message": "Bullets start with weak/generic phrasing. Prefer concrete action verbs.",
            "evidence": [{"starter": k, "count": v} for k, v in counts.items()],
            "where": weak_opening_where[:4],
            "how_to_fix": [
                "Start bullets with a specific action verb (for example: built, optimized, delivered, led).",
                "Follow verb + scope + outcome pattern in one line."
            ]
        })

    # 3) Repetition checks
    normalized_lines = [re.sub(r"\s+", " ", ln.lower()) for ln in lines]
    repeated_lines = [ln for ln, cnt in Counter(normalized_lines).items() if cnt > 1 and len(ln) > 20]
    if repeated_lines:
        risk_points += min(4 * len(repeated_lines), 16)
        repeated_set = set(repeated_lines)
        where_hits = _line_evidence(
            indexed_lines,
            lambda ln: re.sub(r"\s+", " ", ln.lower()) in repeated_set,
            max_hits=5
        )
        violations.append({
            "type": "repetition",
            "severity": "medium",
            "message": "Detected repeated or near-identical lines.",
            "evidence": repeated_lines[:5],
            "where": where_hits,
            "how_to_fix": [
                "Merge duplicate lines into one stronger bullet.",
                "Keep one version with the clearest impact and remove the rest."
            ]
        })

    # 4) Metrics specificity (advisory; not every section requires metrics)
    bullets_with_metrics = sum(
        1 for ln in bullet_lines
        if re.search(r"\b\d+(?:\.\d+)?%?\b", ln) is not None
    )
    metric_ratio = (bullets_with_metrics / len(bullet_lines)) if bullet_lines else 0.0
    if bullet_lines and len(bullet_lines) >= 4 and metric_ratio < 0.20:
        risk_points += 6
        bullet_without_metric = _line_evidence(
            bullet_indexed,
            lambda ln: re.search(r"\b\d+(?:\.\d+)?%?\b", ln) is None,
            max_hits=4
        )
        violations.append({
            "type": "low_specificity",
            "severity": "low",
            "message": "Low proportion of concrete metrics in bullet-heavy content.",
            "evidence": {
                "bullet_count": len(bullet_lines),
                "bullets_with_metrics": bullets_with_metrics
            },
            "where": bullet_without_metric,
            "how_to_fix": [
                "For high-impact bullets, add concrete scope if available (size, volume, frequency, timeline).",
                "If exact numbers are unavailable, use specific non-numeric qualifiers (for example: cross-functional, production-scale, multi-region)."
            ]
        })

    # 5) Grounding check: newly introduced numeric claims
    source_tokens = _extract_numeric_tokens(source_text)
    refined_tokens = _extract_numeric_tokens(content)
    introduced_tokens = sorted(list(refined_tokens - source_tokens))
    if source_text and introduced_tokens:
        risk_points += min(8 + (2 * len(introduced_tokens)), 20)
        where_hits = _line_evidence(
            indexed_lines,
            lambda ln: any(token in ln for token in introduced_tokens),
            max_hits=6
        )
        violations.append({
            "type": "new_numeric_claims",
            "severity": "critical",
            "message": "Detected numeric claims not present in source content.",
            "evidence": introduced_tokens[:20],
            "where": where_hits,
            "how_to_fix": [
                "Remove unsupported numbers or replace them with claims present in selected source items.",
                "If the metric is real, ensure the source profile node includes it before refinement/export."
            ]
        })

    score = max(0, 100 - risk_points)
    critical_violations = sum(1 for v in violations if v.get("severity") == "critical")
    requires_confirmation = score < threshold or critical_violations > 0

    if score >= 85 and critical_violations == 0:
        risk_level = "low"
    elif score >= threshold and critical_violations == 0:
        risk_level = "medium"
    else:
        risk_level = "high"

    return {
        "score": score,
        "risk_level": risk_level,
        "requires_confirmation": requires_confirmation,
        "passes_guard": not requires_confirmation,
        "threshold": threshold,
        "critical_violations": critical_violations,
        "total_violations": len(violations),
        "violations": violations,
        "stats": {
            "bullet_count": len(bullet_lines),
            "bullets_with_metrics": bullets_with_metrics,
            "metric_ratio": round(metric_ratio, 3)
        }
    }


def _tokenize_words(text: str) -> List[str]:
    if not text:
        return []
    return re.findall(r"[A-Za-z][A-Za-z0-9\-']*", text.lower())


def _evaluate_stylometric_signals(text: str) -> Dict[str, Any]:
    """
    Lightweight stylometric checks to supplement phrase heuristics.
    These are not detector-equivalent but help catch overly uniform synthetic style.
    """
    content = (text or "").strip()
    if not content:
        return {
            "score": 0,
            "violations": [{
                "type": "empty_content",
                "severity": "critical",
                "message": "Content is empty."
            }],
            "stats": {
                "sentence_count": 0,
                "avg_sentence_len": 0,
                "sentence_len_std": 0,
                "lexical_diversity": 0
            }
        }

    indexed_lines = _indexed_non_empty_lines(content)

    # Sentence parsing
    sentence_parts = re.split(r"(?<=[.!?])\s+|\n+", content)
    sentences = [s.strip() for s in sentence_parts if s and len(s.strip()) > 0]
    words = _tokenize_words(content)

    sentence_word_counts = []
    sentence_openers = []
    for sentence in sentences:
        sentence_words = _tokenize_words(sentence)
        if sentence_words:
            sentence_word_counts.append(len(sentence_words))
            sentence_openers.append(sentence_words[0])

    avg_len = round(mean(sentence_word_counts), 2) if sentence_word_counts else 0
    std_len = round(pstdev(sentence_word_counts), 2) if len(sentence_word_counts) > 1 else 0
    lexical_diversity = round((len(set(words)) / len(words)), 3) if words else 0

    opener_counts = Counter(sentence_openers)
    repeated_openers = {k: v for k, v in opener_counts.items() if v >= 3}

    risk_points = 0
    violations = []

    if len(sentences) >= 4 and std_len < 4:
        risk_points += 10
        violations.append({
            "type": "uniform_sentence_structure",
            "severity": "medium",
            "message": "Sentence lengths are unusually uniform.",
            "evidence": {"sentence_len_std": std_len},
            "where": [],
            "how_to_fix": [
                "Mix sentence lengths intentionally (short + medium + long).",
                "Split long clauses and vary sentence starts."
            ]
        })

    if len(words) >= 120 and lexical_diversity < 0.36:
        risk_points += 10
        violations.append({
            "type": "low_lexical_diversity",
            "severity": "medium",
            "message": "Vocabulary diversity is low for the text length.",
            "evidence": {"lexical_diversity": lexical_diversity},
            "where": [],
            "how_to_fix": [
                "Avoid repeating the same verbs and qualifiers across bullets.",
                "Use role-specific terminology from your actual selected experience."
            ]
        })

    if repeated_openers:
        risk_points += min(8, len(repeated_openers) * 2)
        repeated_openers_set = set(repeated_openers.keys())
        where_hits = _line_evidence(
            indexed_lines,
            lambda ln: (_tokenize_words(ln)[0] if _tokenize_words(ln) else "") in repeated_openers_set,
            max_hits=5
        )
        violations.append({
            "type": "repetitive_sentence_openers",
            "severity": "low",
            "message": "Many sentences begin with the same words.",
            "evidence": repeated_openers,
            "where": where_hits,
            "how_to_fix": [
                "Vary sentence openers (action, context, result).",
                "Avoid starting consecutive bullets with the same verb."
            ]
        })

    bullet_indexed = [(line_no, ln) for line_no, ln in indexed_lines if ln.startswith("- ")]
    bullet_lines = [ln for _, ln in bullet_indexed]
    if len(bullet_lines) >= 6:
        normalized_bullets = [re.sub(r"\s+", " ", ln[2:].strip().lower()) for ln in bullet_lines]
        dup_bullets = [b for b, cnt in Counter(normalized_bullets).items() if cnt > 1 and len(b) > 18]
        if dup_bullets:
            risk_points += min(10, len(dup_bullets) * 3)
            dup_set = set(dup_bullets)
            where_hits = _line_evidence(
                bullet_indexed,
                lambda ln: re.sub(r"\s+", " ", ln[2:].strip().lower()) in dup_set,
                max_hits=5
            )
            violations.append({
                "type": "repetitive_bullets",
                "severity": "medium",
                "message": "Bullets contain repeated templates or near duplicates.",
                "evidence": dup_bullets[:5],
                "where": where_hits,
                "how_to_fix": [
                    "Keep one strongest bullet per repeated theme and remove duplicates.",
                    "Differentiate remaining bullets by scope, method, or measurable impact."
                ]
            })

    score = max(0, 100 - risk_points)
    return {
        "score": score,
        "violations": violations,
        "stats": {
            "sentence_count": len(sentences),
            "avg_sentence_len": avg_len,
            "sentence_len_std": std_len,
            "lexical_diversity": lexical_diversity
        }
    }


def _evaluate_humanity_with_llm(
    text: str,
    source_text: str = "",
    model: str = HUMANITY_LLM_MODEL,
    reasoning_effort: str = HUMANITY_LLM_REASONING,
    enabled: bool = HUMANITY_DEEP_MODE_ENABLED,
    api_key: str = None
) -> Dict[str, Any]:
    """
    LLM critic layer for deep humanity review.
    Returns normalized risk payload, or a non-fatal error object.
    """
    if not text.strip():
        return {
            "used": False,
            "error": "No text to evaluate"
        }

    if not enabled:
        return {
            "used": False,
            "error": "Deep mode disabled by configuration"
        }
    if not api_key:
        return {
            "used": False,
            "error": "OpenAI API key missing for deep humanity review"
        }

    review_prompt = f"""You are a strict CV writing quality auditor.
Assess whether the TARGET TEXT reads naturally human-written, specific, and grounded.

Return ONLY valid JSON:
{{
  "ai_voice_risk": <integer 0-100, where 100 = very likely AI-sounding>,
  "humanity_confidence": <integer 0-100>,
  "grounding_risk": "low|medium|high",
  "summary": "one short paragraph",
  "issues": [
    {{
      "type": "short_machine_name",
      "severity": "low|medium|high|critical",
      "message": "clear issue description",
      "evidence": "short quote or pattern description",
      "where": ["line/location hint from TARGET TEXT"],
      "how_to_fix": ["specific rewrite action"]
    }}
  ],
  "recommended_actions": ["short actionable fix", "..."]
}}

Judgment rules:
- Penalize generic buzzwords, vague claims, repetitive wording, and inflated marketing tone.
- Penalize any numeric claims in TARGET TEXT not supported by SOURCE TEXT.
- Reward concrete verbs, specific scope, and grounded claims.
- Be conservative and strict.

SOURCE TEXT (for grounding):
{source_text or "(not provided)"}

TARGET TEXT:
{text}
"""
    result = call_openai_for_json(
        system_prompt="You are a rigorous writing evaluator. Respond with JSON only.",
        user_prompt=review_prompt,
        model=model,
        reasoning_effort=reasoning_effort,
        api_key=api_key,
        timeout=90
    )

    if not result.get("success"):
        return {
            "used": False,
            "error": result.get("error", "LLM evaluation failed")
        }

    data = result.get("data", {}) or {}
    try:
        ai_voice_risk = max(0, min(100, int(data.get("ai_voice_risk", 50))))
    except (TypeError, ValueError):
        ai_voice_risk = 50
    try:
        humanity_confidence = max(0, min(100, int(data.get("humanity_confidence", 50))))
    except (TypeError, ValueError):
        humanity_confidence = 50

    issues_raw = data.get("issues", [])
    issues = []
    if isinstance(issues_raw, list):
        for issue in issues_raw[:12]:
            if not isinstance(issue, dict):
                continue
            sev = str(issue.get("severity", "medium")).lower()
            if sev not in {"low", "medium", "high", "critical"}:
                sev = "medium"
            issues.append({
                "type": str(issue.get("type", "llm_issue")).strip() or "llm_issue",
                "severity": sev,
                "message": str(issue.get("message", "Potential AI-like writing pattern detected.")).strip(),
                "evidence": str(issue.get("evidence", "")).strip(),
                "where": _safe_list_of_strings(issue.get("where"), max_items=5, max_len=160),
                "how_to_fix": _safe_list_of_strings(issue.get("how_to_fix"), max_items=5, max_len=180),
            })

    return {
        "used": True,
        "model": result.get("actual_model", model),
        "api": result.get("api_name", ""),
        "ai_voice_risk": ai_voice_risk,
        "score": max(0, 100 - ai_voice_risk),
        "humanity_confidence": humanity_confidence,
        "grounding_risk": str(data.get("grounding_risk", "medium")).lower(),
        "summary": str(data.get("summary", "")).strip(),
        "issues": issues,
        "recommended_actions": _safe_list_of_strings(data.get("recommended_actions"), max_items=8, max_len=180),
    }


def evaluate_humanity_hybrid(
    text: str,
    source_text: str = "",
    threshold: int = HUMANITY_DEFAULT_THRESHOLD,
    mode: str = "quick",
    llm_enabled: bool = HUMANITY_DEEP_MODE_ENABLED,
    llm_model: str = HUMANITY_LLM_MODEL,
    llm_reasoning_effort: str = HUMANITY_LLM_REASONING,
    llm_api_key: str = None
) -> Dict[str, Any]:
    """
    Hybrid humanity scoring:
    - quick: heuristics + stylometric signals
    - deep: quick + LLM critic layer (when available)
    """
    normalized_mode = (mode or "quick").strip().lower()
    if normalized_mode not in {"quick", "deep"}:
        normalized_mode = "quick"

    heuristic = _evaluate_humanity_heuristics(text=text, source_text=source_text, threshold=threshold)
    stylometric = _evaluate_stylometric_signals(text=text)

    llm_review = {"used": False}
    if normalized_mode == "deep":
        llm_review = _evaluate_humanity_with_llm(
            text=text,
            source_text=source_text,
            model=llm_model,
            reasoning_effort=llm_reasoning_effort,
            enabled=llm_enabled,
            api_key=llm_api_key
        )

    heuristic_score = heuristic.get("score", 0)
    stylometric_score = stylometric.get("score", 0)

    if llm_review.get("used"):
        llm_score = llm_review.get("score", 0)
        final_score = round((heuristic_score * 0.45) + (stylometric_score * 0.20) + (llm_score * 0.35))
    else:
        llm_score = None
        final_score = round((heuristic_score * 0.70) + (stylometric_score * 0.30))

    violations = list(heuristic.get("violations", [])) + list(stylometric.get("violations", []))
    if llm_review.get("used"):
        for issue in llm_review.get("issues", []):
            violations.append({
                "type": issue.get("type", "llm_issue"),
                "severity": issue.get("severity", "medium"),
                "message": issue.get("message", "Potential AI-like writing issue"),
                "evidence": issue.get("evidence", ""),
                "where": issue.get("where", []),
                "how_to_fix": issue.get("how_to_fix", []),
            })

    critical_violations = sum(1 for v in violations if str(v.get("severity", "")).lower() == "critical")
    requires_confirmation = final_score < threshold or critical_violations > 0

    if final_score >= 85 and critical_violations == 0:
        risk_level = "low"
    elif final_score >= threshold and critical_violations == 0:
        risk_level = "medium"
    else:
        risk_level = "high"

    return {
        "score": max(0, min(100, int(final_score))),
        "risk_level": risk_level,
        "requires_confirmation": requires_confirmation,
        "passes_guard": not requires_confirmation,
        "threshold": threshold,
        "critical_violations": critical_violations,
        "total_violations": len(violations),
        "violations": violations[:30],
        "mode": normalized_mode,
        "components": {
            "heuristic_score": heuristic_score,
            "stylometric_score": stylometric_score,
            "llm_score": llm_score
        },
        "llm_review": llm_review,
        "stats": {
            **heuristic.get("stats", {}),
            "stylometric": stylometric.get("stats", {})
        }
    }


def evaluate_humanity_text(
    text: str,
    source_text: str = "",
    threshold: int = HUMANITY_DEFAULT_THRESHOLD
) -> Dict[str, Any]:
    """
    Backward-compatible default humanity evaluator.
    Defaults to quick hybrid mode.
    """
    return evaluate_humanity_hybrid(
        text=text,
        source_text=source_text,
        threshold=threshold,
        mode="quick"
    )


def _build_runtime(
    *,
    stage: str,
    provider: str,
    requested_model: str,
    resolved_model: str,
    api_name: str = "",
    reasoning_effort: str = "",
    started_at: str,
    finished_at: str,
    duration_ms: int
) -> Dict[str, Any]:
    return {
        "stage": stage,
        "provider": provider,
        "requested_model": requested_model,
        "resolved_model": resolved_model,
        "api": api_name,
        "reasoning_effort": reasoning_effort,
        "started_at": started_at,
        "finished_at": finished_at,
        "duration_ms": duration_ms
    }


JOB_ANALYSIS_PROMPT = """Analyze this job description and extract key information with critical precision.

Job Description:
{job_description}

Return a JSON object with:
{{
  "job_metadata": {{
    "title": "extracted job title",
    "company": "company name if mentioned, otherwise null",
    "seniority_level": "Entry/Mid/Senior/Lead/Principal/Executive or null",
    "location": "location if mentioned, otherwise null",
    "job_type": "Full-time/Part-time/Contract/etc or null"
  }},
  "requirements": {{
    "technical_skills": ["skill1", "skill2", ...],
    "soft_skills": ["skill1", "skill2", ...],
    "experience_years": "X-Y years or null",
    "education": ["requirement1", ...],
    "certifications": ["cert1", ...],
    "responsibilities": ["resp1", "resp2", ...],
    "key_keywords": ["keyword1", "keyword2", ...]
  }},
  "role_summary": "brief summary of the role",
  "company_culture": "description of company culture hints or null",
  "must_haves": ["critical requirement 1", ...],
  "nice_to_haves": ["optional requirement 1", ...]
}}

Be thorough and extract all relevant requirements."""


SCORING_PROMPT = """You are a brutally honest technical recruiter and career advisor with 15+ years of experience in technical hiring and ATS systems. Analyze this candidate profile against the job requirements with critical precision. Your goal is to save the candidate's time by being factual, direct, and realistic about their chances.

Raw Job Description (source of truth):
{job_description}

Structured Requirements (helper extraction):
{job_requirements}

Candidate Profile:
{profile_content}

Use BOTH inputs:
- The raw job description is authoritative when there is any conflict.
- The structured requirements are for consistency and completeness.

## SCORING METHODOLOGY

### FIT SCORE (0-100): Overall Match Quality

Evaluate how well the candidate matches the role requirements using these weighted components:

**Component Breakdown:**
1. **Must-Have Requirements** (50% of fit_score)
   - Count how many critical/required skills the candidate has
   - Full match = 50 points, partial match = 25 points, no match = 0 points

2. **Nice-to-Have Requirements** (20% of fit_score)
   - Bonus points for additional desired skills
   - Shows versatility and growth potential

3. **Experience Level Alignment** (15% of fit_score)
   - Does the candidate's seniority match the role level?
   - Overqualified, underqualified, or just right?

4. **Domain/Industry Knowledge** (15% of fit_score)
   - Relevant industry experience
   - Domain-specific expertise

**Fit Score Scale:**
- **90-100: EXCEPTIONAL** - Rare perfect match. Candidate exceeds requirements in multiple areas. Strong hire signal.
  - Example: 9/10 must-haves + 80% nice-to-haves + perfect seniority match + deep domain expertise

- **75-89: STRONG FIT** - Excellent match. Candidate meets all or nearly all key requirements. High interview probability.
  - Example: 8/10 must-haves + 50% nice-to-haves + good seniority match + some domain knowledge

- **60-74: GOOD FIT** - Solid match. Candidate meets most important requirements with minor gaps. Reasonable chance.
  - Example: 6-7/10 must-haves + 30% nice-to-haves + acceptable seniority + transferable experience

- **45-59: MODERATE/MARGINAL** - Meets baseline but significant gaps exist. Long shot but not impossible.
  - Example: 5/10 must-haves + few nice-to-haves + some seniority mismatch + limited domain knowledge

- **30-44: BELOW AVERAGE** - Missing several key requirements. Low probability of success. Consider only if desperate.
  - Example: 3-4/10 must-haves + minimal nice-to-haves + wrong seniority level + unrelated background

- **0-29: POOR FIT** - Major gaps in core requirements. Very unlikely to pass screening. Not recommended.
  - Example: <3/10 must-haves + major skill gaps + significant experience mismatch

### ATS SCORE (0-100): Automated Screening Compatibility

Evaluate the likelihood of passing automated applicant tracking systems:

**ATS Scoring Factors:**
1. **Keyword Matching** (40% of ats_score)
   - Count exact keyword matches from job description in candidate profile
   - Include: technologies, tools, methodologies, certifications, job titles
   - Exact match > semantic match > missing

2. **Experience Format** (25% of ats_score)
   - Clear job titles, dates, company names
   - Quantified achievements and metrics
   - Proper role descriptions

3. **Education & Certifications** (20% of ats_score)
   - Required degrees present and clearly stated
   - Relevant certifications mentioned
   - Proper formatting of credentials

4. **Recency & Relevance** (15% of ats_score)
   - Recent experience with required technologies
   - Current/recent job titles matching target role
   - No large unexplained gaps

**ATS Score Scale:**
- **85-100: EXCELLENT** - Will definitely pass ATS. Strong keyword density, perfect format, all checkboxes ticked.
  - Example: 90%+ keyword matches, all required credentials, recent relevant experience

- **70-84: GOOD** - Likely to pass ATS. Most keywords present, good format, minor gaps acceptable.
  - Example: 70-80% keyword matches, most credentials, well-formatted experience

- **55-69: MODERATE** - May pass ATS but not guaranteed. Missing some keywords or format issues.
  - Example: 50-60% keyword matches, some credentials missing, experience less clear

- **40-54: BELOW AVERAGE** - Low probability of passing ATS. Significant keyword gaps or format problems.
  - Example: <50% keyword matches, missing key credentials, poor formatting

- **0-39: POOR** - Very unlikely to pass ATS. Major keyword mismatches, missing critical requirements.
  - Example: <30% keyword matches, no required credentials, incompatible format

## VERDICT DECISION LOGIC

Use this decision matrix based on both scores:

**SHOULD_APPLY** - Recommend proceeding with application:
- fit_score >= 70 AND ats_score >= 60, OR
- fit_score >= 80 (even if ATS is 50-59, worth trying), OR
- fit_score >= 65 AND ats_score >= 75 (great ATS optimization can compensate)

**CONSIDER_APPLYING** - On the fence, depends on candidate's risk tolerance:
- fit_score 55-69 AND ats_score 55-74, OR
- fit_score >= 60 AND ats_score 45-59 (fit is there but ATS is risky), OR
- fit_score 45-59 AND ats_score >= 70 (might get through ATS, then interview skill matters)

**SHOULD_NOT_APPLY** - Not recommended, low probability of success:
- fit_score < 55 AND ats_score < 55, OR
- fit_score < 45 (regardless of ATS), OR
- ats_score < 40 AND fit_score < 70 (won't get past screening)

## CALIBRATION EXAMPLES

**Example 1: Senior Backend Engineer Position**
- Job requires: "5+ years Python, microservices, AWS, Kubernetes, SQL, team leadership"
- Candidate has: 6 years Python, 4 years microservices, 3 years AWS, Kubernetes expert, PostgreSQL, led team of 5
- Must-haves: 5/6 (missing nothing critical)
- Nice-to-haves: Has CI/CD, Docker, Redis (bonus)
- Fit Score: 87 (STRONG FIT)
- ATS Score: 92 (EXCELLENT - all keywords present)
- Verdict: SHOULD_APPLY

**Example 2: Data Scientist Role**
- Job requires: "PhD in CS/Stats, 3+ years ML, Python, TensorFlow, NLP, published research"
- Candidate has: MS in CS (not PhD), 2 years ML, Python expert, PyTorch (not TensorFlow), no NLP, 1 blog post
- Must-haves: 2/6 (missing PhD, insufficient years, wrong framework, no NLP, no publications)
- Fit Score: 38 (BELOW AVERAGE)
- ATS Score: 45 (BELOW AVERAGE - missing key keywords: PhD, TensorFlow, NLP, publications)
- Verdict: SHOULD_NOT_APPLY

**Example 3: Full Stack Developer**
- Job requires: "React, Node.js, TypeScript, REST APIs, MongoDB, 3+ years"
- Candidate has: React (4 years), Node.js (3 years), JavaScript (not TypeScript), REST APIs, MySQL (not MongoDB), 4 years total
- Must-haves: 4/6 (has similar tech but not exact matches)
- Fit Score: 68 (GOOD FIT - close enough, transferable skills)
- ATS Score: 58 (MODERATE - missing exact keywords TypeScript, MongoDB)
- Verdict: CONSIDER_APPLYING (fit is decent, could mention willingness to learn TypeScript/MongoDB in cover letter)

**Example 4: Junior Product Manager**
- Job requires: "1-2 years PM experience, user research, roadmap planning, SQL, analytics tools"
- Candidate has: 3 years as Product Analyst (not PM), extensive user research, data analysis, SQL expert, Tableau/Mixpanel
- Must-haves: 4/5 (related role, has most skills)
- Fit Score: 72 (GOOD FIT - related experience counts)
- ATS Score: 78 (GOOD - keywords present, though job title differs)
- Verdict: SHOULD_APPLY (analyst-to-PM transition is common)

## OUTPUT FORMAT

Return JSON:
{{
  "fit_score": <number 0-100>,
  "fit_reasoning": "Detailed explanation with specific component breakdown. State exactly what matches and what doesn't. Reference the scoring methodology. Example: 'Must-haves: 7/10 (has Python, AWS, React but missing Kubernetes, GraphQL, TypeScript) = 35/50 points. Nice-to-haves: 3/5 = 12/20 points. Experience: Senior level matches = 15/15 points. Domain: fintech background relevant = 12/15 points. Total: 74/100.'",

  "ats_score": <number 0-100>,
  "ats_reasoning": "Specific explanation with keyword analysis. Example: 'Keywords: 18/25 matches (72%). Has exact matches for Python, AWS, microservices, Docker, CI/CD. Missing: Kubernetes, Terraform, Golang. Education: BS in CS present = full points. Format: well-structured with dates and metrics = strong. Recency: all required tech used in last 2 years = excellent. Total: 78/100.'",

  "verdict": "SHOULD_APPLY or CONSIDER_APPLYING or SHOULD_NOT_APPLY",

  "verdict_reasoning": "Clear, direct explanation using the decision matrix. Example: 'fit_score=74 and ats_score=78 both exceed thresholds (70/60). Strong match on core requirements with good keyword density. Recommend applying. Estimated interview probability: 60-70% if application is well-tailored.'",

  "strengths": [
    "Specific strength with evidence and impact. Example: 'Expert in Python with 6 years experience including advanced async programming - exceeds job requirement of 3 years'",
    "Leadership experience managing team of 8 engineers - demonstrates readiness for senior role",
    ...
  ],

  "missing_skills": [
    "Skill required by job but absent from profile. Be specific. Example: 'Kubernetes - listed as required, no evidence in profile'",
    "TypeScript - job requires, candidate only shows JavaScript experience",
    ...
  ],

  "critical_gaps": [
    "Deal-breaker gaps with severity assessment. Example: 'PhD required but candidate has MS - may be automatic disqualification depending on how strict requirement is'",
    "No machine learning experience - this is 60% of the role and cannot be learned quickly",
    ...
  ],

  "matching_skills": [
    "Skills with direct evidence. Example: 'Python (6 years, advanced) - EXACT MATCH'",
    "AWS (4 years, certified) - EXACT MATCH",
    "Microservices architecture (designed 3 systems) - EXACT MATCH",
    ...
  ],

  "recommendations": [
    "Actionable, specific recommendation. Example: 'Highlight Kubernetes experience more prominently if you have any, even from side projects or learning'",
    "Emphasize the 60% latency improvement achievement - quantified results stand out",
    "Consider taking a TypeScript crash course and adding a small project to show learning agility",
    ...
  ]
}}

## IMPORTANT GUIDELINES

- **Be mathematically precise**: Show your scoring calculation, don't just guess numbers
- **Be specific, not generic**: "Has Python" is weak. "6 years Python including async, FastAPI, pytest" is strong
- **No sugar-coating**: If it's a poor fit, say so directly and explain why
- **Consider context**: Junior vs Senior roles have different standards
- **ATS reality check**: Many great candidates get filtered by ATS - be realistic about keyword gaps
- **Provide hope when appropriate**: If score is marginal, suggest how to improve chances
- **Be decisive**: Don't waffle. Use the full scale (not everything is 65-75)
- **Think like a recruiter**: What would make YOU excited to interview this person? What would make you pass?

Focus on:
- Exact skill matches vs. missing requirements (with counts)
- Experience level alignment (over/under/right-qualified)
- Technical depth in required areas (beginner/intermediate/expert)
- Red flags or deal-breakers (hard requirements, cultural mismatch)
- Realistic probability of getting past screening (percentage estimate if possible)
"""


NODE_SELECTION_PROMPT = """You are an expert CV tailoring specialist and ATS optimization consultant. Your task is to recommend which profile nodes should be INCLUDED or EXCLUDED in a tailored CV for a specific job.

Raw Job Description (source of truth):
{job_description}

Structured Requirements (helper extraction):
{job_requirements}

Profile Nodes (indented outline of the candidate's full profile tree):
{profile_nodes}

How to read the profile outline:
- Indentation shows hierarchy: sections (§) contain entries (▸), which contain bullets (•) and paragraphs (¶).
- Each line is tagged with its database id and type, e.g. "▸ [#34 entry] Senior Data Engineer · Acme Corp · 2021–2024".
- Use the number after "#" as the node "id" in your output. A bullet belongs to the entry it is indented under; judge each bullet in the context of its parent role.

Use BOTH inputs:
- Raw job description is authoritative when any conflict exists.
- Structured requirements help consistency and keyword normalization.

## CRITICAL: KEYWORD MATCHING STRATEGY

Before evaluating nodes, carefully extract ALL technical skills, tools, technologies, and keywords from the job requirements. For EACH keyword:

1. **Look for EXACT matches** - Same word/phrase (e.g., "Spark" matches "Spark")
2. **Look for VARIANTS** - Related forms (e.g., "Spark" matches "Apache Spark", "PySpark", "Spark SQL")
3. **Look for SEMANTIC matches** - Related concepts (e.g., "Spark" relates to "distributed computing", "big data processing", "Hadoop ecosystem")
4. **Look for CONTEXTUAL evidence** - Implied usage (e.g., "processed 10TB datasets" implies big data tools like Spark)

**IMPORTANT**: Even if a node doesn't use the EXACT keyword, if it demonstrates the same capability or uses related technologies, it should be considered highly relevant.

Examples of keyword matching:
- Job requires "Spark" → MATCH nodes with: "Spark", "PySpark", "Apache Spark", "Spark SQL", "Spark Streaming", "distributed data processing", "big data frameworks"
- Job requires "machine learning" → MATCH nodes with: "ML", "machine learning", "predictive modeling", "scikit-learn", "TensorFlow", "model training"
- Job requires "cloud" → MATCH nodes with: "AWS", "Azure", "GCP", "cloud infrastructure", "cloud-native", "containerization"

## DECISION CRITERIA

For each node, evaluate these factors:

1. **Direct Relevance** (40% weight)
   - Does this node demonstrate skills/experience explicitly OR implicitly mentioned in the job requirements?
   - Does it use exact keywords, variants, or semantically related terms that will improve ATS matching?
   - Does it address must-have requirements vs nice-to-haves?
   - CHECK THOROUGHLY: Read the entire node content, not just the title - relevant keywords may be buried in descriptions

2. **Impact & Achievement** (30% weight)
   - Does it show measurable results, leadership, or significant contributions?
   - Does it demonstrate progression or mastery in relevant areas?
   - Will it differentiate the candidate from other applicants?

3. **Recency & Context** (20% weight)
   - Is this recent experience (more valuable) or outdated (less valuable)?
   - Does it fit the seniority level of the target role?
   - Does it support the narrative for this specific career direction?

4. **Space Efficiency** (10% weight)
   - Does this node add unique value or is it redundant?
   - Is it concise or verbose relative to its importance?

## CONFIDENCE SCALE DEFINITION

Use this scale to rate your confidence in each inclusion/exclusion decision:

**0.0 - 0.3: WEAK** - Marginal relevance or uncertain value
- Example: A 10-year-old technology that's tangentially related
- Example: A soft skill mentioned once in the job description
- Decision: Usually EXCLUDE unless filling space

**0.3 - 0.5: LOW-MODERATE** - Some relevance but not core to the role
- Example: Adjacent technical skills that show adaptability
- Example: Leadership experience when job emphasizes technical depth
- Decision: INCLUDE if space allows and supports narrative

**0.5 - 0.7: MODERATE-HIGH** - Clear relevance to job requirements
- Example: Required skill demonstrated in older role
- Example: Similar industry/domain experience
- Decision: Usually INCLUDE, forms the supporting content

**0.7 - 0.9: HIGH** - Strong alignment with key requirements
- Example: Direct experience with primary technologies listed
- Example: Exact role type or responsibility mentioned in job
- Decision: Definitely INCLUDE, core CV content

**0.9 - 1.0: CRITICAL** - Perfect match, must-have for this application
- Example: Exact same job title with matching responsibilities
- Example: Rare/specialized skill that's explicitly required
- Decision: MUST INCLUDE, highlights of the CV

## DECISION THRESHOLDS

- **confidence >= 0.85**: MUST INCLUDE - Critical match, forms the core narrative
- **confidence >= 0.60**: SHOULD INCLUDE - Strong relevance, keep unless CV is too long
- **confidence >= 0.40**: MAYBE INCLUDE - Moderate relevance, include if space allows
- **confidence < 0.40**: SHOULD EXCLUDE - Weak relevance, dilutes the focused message

## TAILORING STRATEGY GUIDELINES

- **Aim for focused, not exhaustive**: A tailored CV should be 70-85% of the full profile
- **Quality over quantity**: Better to have 15 highly relevant points than 30 mixed ones
- **Target 1-2 pages**: Recommend INCLUDE count that fits this constraint
- **Prioritize recent**: Weight recent experience higher unless older experience is uniquely relevant
- **Maintain narrative coherence**: Include nodes that tell a consistent story for THIS role

## CALIBRATION EXAMPLES

**Example 1: Software Engineer Role (Exact Match)**
- Node: "Led migration of legacy Java monolith to microservices architecture, reducing latency by 60%"
- Job requires: "Experience with microservices, Java, performance optimization"
- Confidence: 0.95 (HIGH-CRITICAL) - Direct exact match with quantified achievement
- Decision: INCLUDE
- Reasoning: Contains exact keywords "microservices", "Java", and demonstrates "performance optimization" with metrics

**Example 2: Data Engineer Role (Semantic Match - IMPORTANT)**
- Node: "Built distributed data pipelines processing 10TB daily using PySpark and Hadoop"
- Job requires: "Spark, big data processing, ETL pipelines"
- Confidence: 0.92 (HIGH-CRITICAL) - Strong semantic match even though "Spark" isn't exact
- Decision: INCLUDE
- Reasoning: "PySpark" is a variant of "Spark", "10TB daily" demonstrates "big data", "pipelines" matches "ETL pipelines"

**Example 3: Data Scientist Role (Variant Match)**
- Node: "Developed ML models using scikit-learn and TensorFlow for customer churn prediction"
- Job requires: "machine learning, predictive modeling, Python"
- Confidence: 0.90 (HIGH) - Excellent match with variants and related terms
- Decision: INCLUDE
- Reasoning: "ML" is variant of "machine learning", "churn prediction" is example of "predictive modeling", libraries imply Python

**Example 4: Software Engineer Role (Contextual Evidence)**
- Node: "Processed large-scale datasets with distributed computing frameworks, optimizing query performance by 3x"
- Job requires: "Spark, data processing, performance tuning"
- Confidence: 0.75 (HIGH) - Strong contextual match
- Decision: INCLUDE
- Reasoning: "distributed computing frameworks" likely includes Spark, "large-scale datasets" = data processing, "3x performance" = tuning

**Example 5: Software Engineer Role (Weak Relevance)**
- Node: "Volunteered as coding instructor for high school students"
- Job requires: "Strong technical skills, team collaboration"
- Confidence: 0.35 (LOW-MODERATE) - Shows soft skills but not core technical requirement
- Decision: EXCLUDE (unless applying to education-tech or culture-focused company)

**Example 6: Senior Data Scientist Role (Insufficient Depth)**
- Node: "Built Python scripts for data cleaning and preprocessing"
- Job requires: "Expert in ML model development, Python, statistical analysis"
- Confidence: 0.55 (MODERATE-HIGH) - Relevant skill but doesn't show seniority/depth
- Decision: INCLUDE if no stronger Python/data examples exist, otherwise EXCLUDE

**Example 7: Product Manager Role (Exact Match)**
- Node: "Shipped 3 major features with 95% on-time delivery, coordinating 12 engineers"
- Job requires: "Technical product management, cross-functional leadership"
- Confidence: 0.88 (HIGH) - Strong match on leadership and delivery metrics
- Decision: INCLUDE

## OUTPUT FORMAT

Return JSON with node IDs and selection status:
{{
  "selected_nodes": [
    {{
      "id": 123,
      "include": true,
      "confidence": 0.95,
      "reason": "Critical match - demonstrates exact required skill X with quantified impact. Direct keyword match for ATS. Recent experience at target seniority level.",
      "relevance_tags": ["primary_requirement", "ats_keyword", "quantified_achievement"]
    }},
    {{
      "id": 124,
      "include": false,
      "confidence": 0.25,
      "reason": "Outdated technology (10 years old) not mentioned in job requirements. No transferable skills to current role focus. Would dilute focused narrative.",
      "relevance_tags": ["outdated", "low_relevance"]
    }},
    ...
  ],
  "selection_summary": {{
    "total_nodes": 50,
    "recommended_include": 35,
    "recommended_exclude": 15,
    "expected_cv_length": "1.5 pages",
    "tailoring_percentage": "70%"
  }},
  "tailoring_strategy": "Focus on recent microservices and cloud architecture experience (last 5 years) which directly matches 8 of 10 key requirements. Exclude early-career frontend work and non-technical roles to maintain senior backend engineer positioning. Emphasize leadership and scale achievements to match senior-level expectations."
}}

## IMPORTANT REMINDERS

- **CRITICAL**: Use semantic and variant matching! If job requires "Spark", INCLUDE nodes with "PySpark", "Apache Spark", "distributed computing", etc.
- **READ THOROUGHLY**: Don't just scan titles - read the full content of each node for hidden keywords and relevant experience
- Use the "id" field from each node (this is the database primary key) - use it EXACTLY as provided
- Return recommendations for ALL nodes provided (every single one)
- Be decisive: Don't give everything 0.5 confidence - use the full scale (0.0-1.0)
- For technical skills, be GENEROUS with semantic matching - variants and related technologies should score high
- Provide specific, actionable reasons (not generic statements)
- Consider ATS optimization: exact keywords are best, but variants and semantic matches are also valuable
- Think holistically: Does the set of included nodes tell a compelling, focused story?
- When in doubt about relevance, INCLUDE rather than EXCLUDE - better to have related experience than gaps

## WORKFLOW

1. First, extract ALL keywords and requirements from the job description
2. For each keyword, identify exact matches, variants, and semantic equivalents
3. Read EVERY node completely (title, subtitle, content, dates, location)
4. Mark matches based on exact/variant/semantic/contextual criteria
5. Assign confidence scores based on match quality and other factors
6. Write specific reasoning explaining the match type and relevance
"""


def analyze_job_with_openai(
    job_description: str,
    model: str = None,
    reasoning_effort: str = None,
    api_key: str = None
) -> Dict[str, Any]:
    """
    Analyze job description using OpenAI (supports both GPT-4o and GPT-5.1)

    Args:
        job_description: The job description text to analyze
        model: Optional OpenAI model id override (e.g. "gpt-5.5"). Uses the default if not specified.
        reasoning_effort: Optional reasoning effort override for GPT-5.1.
    """
    model_name = model or DEFAULT_OPENAI_MODEL
    resolved_reasoning_effort = _resolve_reasoning_effort(reasoning_effort)
    logger.step(f"Job analysis with OpenAI ({model_name})", step_num=1)
    started_at = _now_iso()
    start_ts = time.time()

    try:
        # Build the exact prompt that will be sent
        user_prompt = JOB_ANALYSIS_PROMPT.format(job_description=job_description)
        logger.info(f"Job description length: {len(job_description)} characters")

        # Use the unified wrapper with structured output schema
        result = call_openai_for_json(
            system_prompt="You are an expert job requirement analyst. Always respond with valid JSON.",
            user_prompt=user_prompt,
            model=model_name,
            reasoning_effort=resolved_reasoning_effort,
            api_key=api_key,
            schema=JOB_ANALYSIS_SCHEMA,
            schema_name="job_analysis"
        )

        if not result["success"]:
            logger.error(f"Job analysis failed: {result['error']}")
            finished_at = _now_iso()
            duration_ms = int((time.time() - start_ts) * 1000)
            resolved_model = result.get("actual_model") or result.get("model", model_name)
            return {
                "success": False,
                "model": f"openai-{resolved_model}",
                "error": result["error"],
                "runtime": _build_runtime(
                    stage="job_analysis",
                    provider="openai",
                    requested_model=model_name,
                    resolved_model=resolved_model,
                    api_name=result.get("api_name", ""),
                    reasoning_effort=resolved_reasoning_effort if _uses_reasoning(model_name) else "",
                    started_at=started_at,
                    finished_at=finished_at,
                    duration_ms=duration_ms
                )
            }

        finished_at = _now_iso()
        duration_ms = int((time.time() - start_ts) * 1000)
        resolved_model = result.get("actual_model") or result["model"]
        logger.success(f"Job analysis complete using {resolved_model}")

        response_data = {
            "success": True,
            "model": f"openai-{resolved_model}",
            "analysis": result["data"],
            "prompt_sent": user_prompt,
            "runtime": _build_runtime(
                stage="job_analysis",
                provider="openai",
                requested_model=result.get("requested_model", model_name),
                resolved_model=resolved_model,
                api_name=result.get("api_name", ""),
                reasoning_effort=resolved_reasoning_effort if _uses_reasoning(result.get("requested_model", model_name)) else "",
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=duration_ms
            )
        }

        # Include reasoning token count for GPT-5.1
        if "reasoning_tokens" in result:
            response_data["reasoning_tokens"] = result["reasoning_tokens"]
            logger.info(f"🧠 Reasoning tokens: {result['reasoning_tokens']}")

        return response_data

    except Exception as e:
        logger.error("Job analysis exception", error=e)
        finished_at = _now_iso()
        duration_ms = int((time.time() - start_ts) * 1000)
        return {
            "success": False,
            "model": f"openai-{model_name}",
            "error": str(e),
            "runtime": _build_runtime(
                stage="job_analysis",
                provider="openai",
                requested_model=model_name,
                resolved_model=model_name,
                api_name="",
                reasoning_effort=resolved_reasoning_effort if _uses_reasoning(model_name) else "",
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=duration_ms
            )
        }


def analyze_job_with_claude(job_description: str, model: str = None, api_key: str = None, effort: str = None) -> Dict[str, Any]:
    """Analyze job description using Claude (structured output + extended thinking)."""
    requested_model = model or os.getenv("CLAUDE_MODEL_VERSION", "claude-opus-4-8")
    logger.step(f"Job analysis with Claude ({requested_model})", step_num=1)
    started_at = _now_iso()
    start_ts = time.time()

    if not api_key:
        logger.error("Claude client not initialized")
        finished_at = _now_iso()
        return {
            "success": False,
            "model": requested_model,
            "error": "Claude API key missing. Add your key in AI Settings.",
            "runtime": _build_runtime(
                stage="job_analysis",
                provider="anthropic",
                requested_model=requested_model,
                resolved_model=requested_model,
                api_name="messages.create",
                reasoning_effort="",
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=int((time.time() - start_ts) * 1000)
            )
        }

    logger.info(f"Job description length: {len(job_description)} characters")

    try:
        # Build the exact prompt that will be sent
        user_prompt = JOB_ANALYSIS_PROMPT.format(job_description=job_description)

        logger.info(f"Calling Claude API ({requested_model}) with structured output + thinking...")

        result, resolved_model, effort_used = call_claude_structured(
            api_key=api_key,
            model=requested_model,
            system="You are an expert job requirement analyst.",
            user_prompt=user_prompt,
            schema=JOB_ANALYSIS_SCHEMA,
            max_tokens=4096,
            effort=effort,
            timeout=180.0,
        )

        finished_at = _now_iso()
        duration_ms = int((time.time() - start_ts) * 1000)
        logger.success(f"Job analysis complete using {resolved_model} in {duration_ms / 1000:.2f}s")

        return {
            "success": True,
            "model": resolved_model,
            "analysis": result,
            "prompt_sent": user_prompt,  # Include the exact prompt sent
            "runtime": _build_runtime(
                stage="job_analysis",
                provider="anthropic",
                requested_model=requested_model,
                resolved_model=resolved_model,
                api_name="messages.create",
                reasoning_effort=effort_used,
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=duration_ms
            )
        }
    except Exception as e:
        finished_at = _now_iso()
        duration_ms = int((time.time() - start_ts) * 1000)
        logger.error(f"Claude analysis failed after {duration_ms / 1000:.2f}s: {str(e)}")
        return {
            "success": False,
            "model": requested_model,
            "error": str(e),
            "runtime": _build_runtime(
                stage="job_analysis",
                provider="anthropic",
                requested_model=requested_model,
                resolved_model=requested_model,
                api_name="messages.create",
                reasoning_effort="",
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=duration_ms
            )
        }


def score_profile_with_openai(
    job_requirements: Dict,
    profile_content: str,
    job_description: str = "",
    model: str = None,
    reasoning_effort: str = None,
    api_key: str = None
) -> Dict[str, Any]:
    """
    Score profile fit using OpenAI (supports both GPT-4o and GPT-5.1)

    Args:
        job_requirements: Extracted job requirements dictionary
        profile_content: Candidate profile text
        model: Optional OpenAI model id override (e.g. "gpt-5.5"). Uses the default if not specified.
    """
    model_name = model or DEFAULT_OPENAI_MODEL
    resolved_reasoning_effort = _resolve_reasoning_effort(reasoning_effort)
    logger.step(f"Profile scoring with OpenAI ({model_name})", step_num=1)
    started_at = _now_iso()
    start_ts = time.time()

    try:
        # Build the exact prompt that will be sent
        user_prompt = SCORING_PROMPT.format(
            job_description=job_description or "(not provided)",
            job_requirements=json.dumps(job_requirements, indent=2),
            profile_content=profile_content
        )
        logger.info(f"Profile content length: {len(profile_content)} characters")

        # Use the unified wrapper with structured output schema
        result = call_openai_for_json(
            system_prompt="You are an expert recruiter and ATS specialist. Always respond with valid JSON.",
            user_prompt=user_prompt,
            model=model_name,
            reasoning_effort=resolved_reasoning_effort,
            api_key=api_key,
            schema=SCORING_SCHEMA,
            schema_name="cv_scoring"
        )

        if not result["success"]:
            logger.error(f"Profile scoring failed: {result['error']}")
            finished_at = _now_iso()
            duration_ms = int((time.time() - start_ts) * 1000)
            resolved_model = result.get("actual_model") or result.get("model", model_name)
            return {
                "success": False,
                "model": f"openai-{resolved_model}",
                "error": result["error"],
                "runtime": _build_runtime(
                    stage="profile_scoring",
                    provider="openai",
                    requested_model=model_name,
                    resolved_model=resolved_model,
                    api_name=result.get("api_name", ""),
                    reasoning_effort=resolved_reasoning_effort if _uses_reasoning(model_name) else "",
                    started_at=started_at,
                    finished_at=finished_at,
                    duration_ms=duration_ms
                )
            }

        # Normalize and log scores
        scores_data = _normalize_scores_payload(result["data"])
        fit_score = scores_data.get("fit_score", "N/A")
        ats_score = scores_data.get("ats_score", "N/A")
        verdict = scores_data.get("verdict", "N/A")
        logger.success(f"Scoring complete: Fit={fit_score}, ATS={ats_score}, Verdict={verdict}")

        finished_at = _now_iso()
        duration_ms = int((time.time() - start_ts) * 1000)
        resolved_model = result.get("actual_model") or result["model"]
        response_data = {
            "success": True,
            "model": f"openai-{resolved_model}",
            "scores": scores_data,
            "prompt_sent": user_prompt,
            "runtime": _build_runtime(
                stage="profile_scoring",
                provider="openai",
                requested_model=result.get("requested_model", model_name),
                resolved_model=resolved_model,
                api_name=result.get("api_name", ""),
                reasoning_effort=resolved_reasoning_effort if _uses_reasoning(result.get("requested_model", model_name)) else "",
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=duration_ms
            )
        }

        # Include reasoning token count for GPT-5.1
        if "reasoning_tokens" in result:
            response_data["reasoning_tokens"] = result["reasoning_tokens"]
            logger.info(f"🧠 Reasoning tokens: {result['reasoning_tokens']}")

        return response_data

    except Exception as e:
        logger.error("Profile scoring exception", error=e)
        finished_at = _now_iso()
        duration_ms = int((time.time() - start_ts) * 1000)
        return {
            "success": False,
            "model": f"openai-{model_name}",
            "error": str(e),
            "runtime": _build_runtime(
                stage="profile_scoring",
                provider="openai",
                requested_model=model_name,
                resolved_model=model_name,
                api_name="",
                reasoning_effort=resolved_reasoning_effort if _uses_reasoning(model_name) else "",
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=duration_ms
            )
        }


def score_profile_with_claude(
    job_requirements: Dict,
    profile_content: str,
    job_description: str = "",
    model: str = None,
    api_key: str = None,
    effort: str = None
) -> Dict[str, Any]:
    """Score profile fit using Claude (structured output + extended thinking)."""
    requested_model = model or os.getenv("CLAUDE_MODEL_VERSION", "claude-opus-4-8")
    logger.step(f"Profile scoring with Claude ({requested_model})", step_num=1)
    started_at = _now_iso()
    start_ts = time.time()

    if not api_key:
        logger.error("Claude client not initialized")
        finished_at = _now_iso()
        return {
            "success": False,
            "model": requested_model,
            "error": "Claude API key missing. Add your key in AI Settings.",
            "runtime": _build_runtime(
                stage="profile_scoring",
                provider="anthropic",
                requested_model=requested_model,
                resolved_model=requested_model,
                api_name="messages.create",
                reasoning_effort="",
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=int((time.time() - start_ts) * 1000)
            )
        }

    logger.info(f"Profile content length: {len(profile_content)} characters")

    try:
        # Build the exact prompt that will be sent
        user_prompt = SCORING_PROMPT.format(
            job_description=job_description or "(not provided)",
            job_requirements=json.dumps(job_requirements, indent=2),
            profile_content=profile_content
        )

        logger.info(f"Calling Claude API ({requested_model}) with structured output + thinking...")

        result, resolved_model, effort_used = call_claude_structured(
            api_key=api_key,
            model=requested_model,
            system="You are an expert recruiter and ATS specialist.",
            user_prompt=user_prompt,
            schema=SCORING_SCHEMA,
            max_tokens=4096,
            effort=effort,
            timeout=180.0,
        )
        result = _normalize_scores_payload(result)

        finished_at = _now_iso()
        duration_ms = int((time.time() - start_ts) * 1000)
        fit_score = result.get('fit_score', 'N/A')
        ats_score = result.get('ats_score', 'N/A')
        verdict = result.get('verdict', 'N/A')
        logger.success(f"Scoring complete: Fit={fit_score}, ATS={ats_score}, Verdict={verdict} in {duration_ms / 1000:.2f}s")

        return {
            "success": True,
            "model": resolved_model,
            "scores": result,
            "prompt_sent": user_prompt,  # Include the exact prompt sent
            "runtime": _build_runtime(
                stage="profile_scoring",
                provider="anthropic",
                requested_model=requested_model,
                resolved_model=resolved_model,
                api_name="messages.create",
                reasoning_effort=effort_used,
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=duration_ms
            )
        }
    except Exception as e:
        finished_at = _now_iso()
        duration_ms = int((time.time() - start_ts) * 1000)
        logger.error(f"Claude scoring failed after {duration_ms / 1000:.2f}s: {str(e)}")
        return {
            "success": False,
            "model": requested_model,
            "error": str(e),
            "runtime": _build_runtime(
                stage="profile_scoring",
                provider="anthropic",
                requested_model=requested_model,
                resolved_model=requested_model,
                api_name="messages.create",
                reasoning_effort="",
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=duration_ms
            )
        }


def recommend_nodes_with_openai(
    job_requirements: Dict,
    profile_nodes: List[Dict],
    job_description: str = "",
    model: str = None,
    reasoning_effort: str = None,
    api_key: str = None
) -> Dict[str, Any]:
    """
    Recommend which nodes to include using OpenAI (supports both GPT-4o and GPT-5.1)

    Args:
        job_requirements: Extracted job requirements dictionary
        profile_nodes: List of profile node dictionaries to evaluate
        model: Optional OpenAI model id override (e.g. "gpt-5.5"). Uses the default if not specified.
    """
    model_name = model or DEFAULT_OPENAI_MODEL
    resolved_reasoning_effort = _resolve_reasoning_effort(reasoning_effort)
    logger.step(f"Node selection with OpenAI ({model_name}) - {len(profile_nodes)} nodes", step_num=1)
    started_at = _now_iso()
    start_ts = time.time()

    try:
        prompt_content = NODE_SELECTION_PROMPT.format(
            job_description=job_description or "(not provided)",
            job_requirements=json.dumps(job_requirements, indent=2),
            profile_nodes=_render_nodes_for_prompt(profile_nodes)
        )
        prompt_length = len(prompt_content)
        logger.info(f"Prompt size: {prompt_length} chars ({prompt_length/1000:.1f}K) | Nodes: {len(profile_nodes)}")

        # Use the unified wrapper with structured output schema (timing is handled in wrapper)
        result = call_openai_for_json(
            system_prompt="You are an expert CV tailoring specialist. Always respond with valid JSON.",
            user_prompt=prompt_content,
            model=model_name,
            reasoning_effort=resolved_reasoning_effort,
            api_key=api_key,
            timeout=180,  # 180 second timeout (3 minutes)
            schema=NODE_SELECTION_SCHEMA,
            schema_name="node_selection"
        )

        if not result["success"]:
            logger.error(f"Node selection failed: {result['error']}")
            finished_at = _now_iso()
            duration_ms = int((time.time() - start_ts) * 1000)
            resolved_model = result.get("actual_model") or result.get("model", model_name)
            return {
                "success": False,
                "model": f"openai-{resolved_model}",
                "error": result["error"],
                "runtime": _build_runtime(
                    stage="node_selection",
                    provider="openai",
                    requested_model=model_name,
                    resolved_model=resolved_model,
                    api_name=result.get("api_name", ""),
                    reasoning_effort=resolved_reasoning_effort if _uses_reasoning(model_name) else "",
                    started_at=started_at,
                    finished_at=finished_at,
                    duration_ms=duration_ms
                )
            }

        normalized_recommendations = _normalize_recommendations_payload(result["data"])
        node_count = len(normalized_recommendations.get('selected_nodes', []))
        recommended_count = sum(1 for node in normalized_recommendations.get('selected_nodes', []) if node.get('include'))
        logger.success(f"Node selection complete: {recommended_count}/{node_count} nodes recommended")

        finished_at = _now_iso()
        duration_ms = int((time.time() - start_ts) * 1000)
        resolved_model = result.get("actual_model") or result["model"]
        response_data = {
            "success": True,
            "model": f"openai-{resolved_model}",
            "recommendations": normalized_recommendations,
            "prompt_sent": prompt_content,
            "runtime": _build_runtime(
                stage="node_selection",
                provider="openai",
                requested_model=result.get("requested_model", model_name),
                resolved_model=resolved_model,
                api_name=result.get("api_name", ""),
                reasoning_effort=resolved_reasoning_effort if _uses_reasoning(result.get("requested_model", model_name)) else "",
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=duration_ms
            )
        }

        # Include reasoning token count for GPT-5.1
        if "reasoning_tokens" in result:
            response_data["reasoning_tokens"] = result["reasoning_tokens"]
            logger.info(f"🧠 Reasoning tokens: {result['reasoning_tokens']}")

        # Log token usage summary
        if "usage" in result:
            logger.tokens_summary(result['model'], result['usage'])

        return response_data

    except Exception as e:
        logger.error(f"Node selection exception", error=e)
        import traceback
        traceback.print_exc()
        finished_at = _now_iso()
        duration_ms = int((time.time() - start_ts) * 1000)
        return {
            "success": False,
            "model": f"openai-{model_name}",
            "error": str(e),
            "runtime": _build_runtime(
                stage="node_selection",
                provider="openai",
                requested_model=model_name,
                resolved_model=model_name,
                api_name="",
                reasoning_effort=resolved_reasoning_effort if _uses_reasoning(model_name) else "",
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=duration_ms
            )
        }


def recommend_nodes_with_claude(
    job_requirements: Dict,
    profile_nodes: List[Dict],
    job_description: str = "",
    model: str = None,
    api_key: str = None,
    effort: str = None
) -> Dict[str, Any]:
    """Recommend which nodes to include using Claude (structured output + thinking)."""
    requested_model = model or os.getenv("CLAUDE_MODEL_VERSION", "claude-opus-4-8")
    logger.step(f"Node selection with Claude ({requested_model}) - {len(profile_nodes)} nodes", step_num=1)
    started_at = _now_iso()
    start_ts = time.time()

    if not api_key:
        logger.error("Claude client not initialized")
        finished_at = _now_iso()
        return {
            "success": False,
            "model": requested_model,
            "error": "Claude API key missing. Add your key in AI Settings.",
            "runtime": _build_runtime(
                stage="node_selection",
                provider="anthropic",
                requested_model=requested_model,
                resolved_model=requested_model,
                api_name="messages.create",
                reasoning_effort="",
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=int((time.time() - start_ts) * 1000)
            )
        }

    try:
        prompt_content = NODE_SELECTION_PROMPT.format(
            job_description=job_description or "(not provided)",
            job_requirements=json.dumps(job_requirements, indent=2),
            profile_nodes=_render_nodes_for_prompt(profile_nodes)
        )
        prompt_length = len(prompt_content)
        logger.info(f"Prompt size: {prompt_length} chars ({prompt_length/1000:.1f}K) | Nodes: {len(profile_nodes)}")
        logger.info(f"Calling Claude API ({requested_model}) with structured output + thinking...")

        result, resolved_model, effort_used = call_claude_structured(
            api_key=api_key,
            model=requested_model,
            system="You are an expert CV tailoring specialist.",
            user_prompt=prompt_content,
            schema=NODE_SELECTION_SCHEMA,
            max_tokens=16384,  # large responses with many nodes
            effort=effort,
            timeout=180.0,  # Claude needs more time for thinking + many nodes
        )

        request_duration = time.time() - start_ts
        normalized_result = _normalize_recommendations_payload(result)
        selected_count = len(normalized_result.get('selected_nodes', []))
        logger.success(f"Node selection complete: {selected_count} nodes recommended in {request_duration:.2f}s")
        finished_at = _now_iso()

        return {
            "success": True,
            "model": resolved_model,
            "recommendations": normalized_result,
            "prompt_sent": prompt_content,  # Include the exact prompt sent
            "runtime": _build_runtime(
                stage="node_selection",
                provider="anthropic",
                requested_model=requested_model,
                resolved_model=resolved_model,
                api_name="messages.create",
                reasoning_effort=effort_used,
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=int(request_duration * 1000)
            )
        }
    except Exception as e:
        request_duration = time.time() - start_ts
        logger.error(f"Claude node selection failed after {request_duration:.2f}s: {str(e)}")
        finished_at = _now_iso()
        return {
            "success": False,
            "model": requested_model,
            "error": str(e),
            "runtime": _build_runtime(
                stage="node_selection",
                provider="anthropic",
                requested_model=requested_model,
                resolved_model=requested_model,
                api_name="messages.create",
                reasoning_effort="",
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=int(request_duration * 1000)
            )
        }


def flatten_nodes_for_analysis(nodes: List[Dict], parent_context: str = "") -> List[Dict]:
    """
    Flatten hierarchical nodes into a minimal list for AI analysis.
    ONLY includes: id (primary key) and content fields (title, subtitle, content, dates, location).
    Removes: global_id, node_type, level, context_path, is_visible.
    This reduces token usage by ~30-40% while keeping all essential content.
    """
    flattened = []

    for node in nodes:
        # Build minimal flat_node with only essential fields
        flat_node = {}

        # ALWAYS include id (primary key - absolutely unique identifier)
        if node.get("id") is not None:
            flat_node["id"] = node["id"]

        # Only include content fields if they have meaningful values
        if node.get("title"):
            flat_node["title"] = node["title"]
        if node.get("subtitle"):
            flat_node["subtitle"] = node["subtitle"]
        if node.get("content"):
            flat_node["content"] = node["content"]
        if node.get("start_date"):
            flat_node["start_date"] = node["start_date"]
        if node.get("end_date"):
            flat_node["end_date"] = node["end_date"]
        if node.get("location"):
            flat_node["location"] = node["location"]

        flattened.append(flat_node)

        # Recursively process children
        # Build context for readability (used in recursion but not sent to AI)
        context = f"{parent_context} > {node.get('title', 'Untitled')}" if parent_context else node.get('title', 'Untitled')
        if node.get("children"):
            flattened.extend(flatten_nodes_for_analysis(node["children"], context))

    return flattened


def profile_nodes_to_text(nodes: List[Dict]) -> str:
    """Convert profile nodes to readable text for AI analysis"""
    text_parts = []

    for node in nodes:
        if node.get("node_type") == "section":
            text_parts.append(f"\n## {node.get('title', 'Section')}\n")
        elif node.get("node_type") == "entry":
            title = node.get("title", "")
            subtitle = node.get("subtitle", "")
            dates = f"{node.get('start_date', '')} - {node.get('end_date', '')}" if node.get("start_date") else ""
            location = node.get("location", "")

            text_parts.append(f"**{title}**")
            if subtitle:
                text_parts.append(f" | {subtitle}")
            if dates:
                text_parts.append(f" | {dates}")
            if location:
                text_parts.append(f" | {location}")
            text_parts.append("\n")

            if node.get("content"):
                text_parts.append(f"{node['content']}\n")
        elif node.get("node_type") in ["bullet", "item"]:
            text_parts.append(f"• {node.get('content', node.get('title', ''))}\n")
        elif node.get("node_type") == "paragraph":
            text_parts.append(f"{node.get('content', '')}\n")

        # Process children
        if node.get("children"):
            text_parts.append(profile_nodes_to_text(node["children"]))

    return "".join(text_parts)


# ============================================================================
# Skill Weave: add a new skill across the whole profile (clarify -> propose)
# ============================================================================

SKILL_WEAVE_SYSTEM = (
    "You help a real job seeker add a skill to their CV in their own honest voice. "
    "You only use facts the person gives you. You never invent numbers, dates, "
    "employers, tools, scope, or results. You write like a real person typing fast: "
    "plain words, short sentences, first person. You never use em-dashes or double "
    "hyphens. You never use cliche AI words."
)

SKILL_WEAVE_PROMPT = """The person wants to add the following skill(s) to their CV, in their own words.

SKILLS AND CONTEXT (the person's own words):
{skills_block}
{answers_block}
Here is their current profile as an indented outline. Each line is tagged [#<id> <type>]. Use those ids to reference existing nodes.
PROFILE OUTLINE:
{profile_outline}

Your job:
1. If the person's words are missing detail needed to write honest, specific lines (for example: which role or company they used it in, roughly when, or what they actually did with it), set needs_clarification=true and put 1 to 4 short, plain questions in clarifying_questions. Return no injections.
2. Otherwise set needs_clarification=false and propose how to weave the skill across the CV:
   - the professional summary (lightly edit it to mention the skill, or add one short line),
   - the most relevant work experience entries (add a short bullet, or lightly edit an existing one),
   - the core skills / skills section (add the skill).
   Only target places where the skill genuinely fits based on the person's words.
3. For each change return one injection:
   - action "edit": set node_id to the existing node's [#id] and original_text to its current text.
   - action "add": set parent_node_id to the [#id] of the section or entry to add under, and new_node_type to "bullet" (under a job), "item" (a skill), or "paragraph".
   - proposed_text: the new human-voice text.
   - rationale: one short reason.
   Set the unused id field to null. original_text is "" for adds.
4. List in facts_used the concrete facts you took from the person's words.

Hard rules for every proposed_text:
- Use ONLY facts the person gave. If you are tempted to add a number, metric, date, employer, or tool they did not state, do not. Ask a question instead.
- Plain spoken English, first person. Short sentences, about 12 to 18 words each.
- No em-dashes. No "--". Avoid words like leveraged, spearheaded, results-driven, passionate about, proven track record, cutting-edge, synergy, dynamic professional.
- It should read like the person quickly wrote it themselves."""


def _coerce_int_or_none(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _build_skill_weave_prompt(skills: List[Dict[str, str]], profile_outline: str,
                              answers: Optional[List[Dict[str, str]]]) -> str:
    skills_block = "\n".join(
        f"- {str((s or {}).get('name', '')).strip()}: {str((s or {}).get('context', '')).strip()}"
        for s in (skills or []) if str((s or {}).get('name', '')).strip()
    ) or "- (none provided)"

    answers_block = ""
    if answers:
        lines = []
        for qa in answers:
            q = str((qa or {}).get("question", "")).strip()
            a = str((qa or {}).get("answer", "")).strip()
            if q or a:
                lines.append(f"- Q: {q}\n  A: {a}")
        if lines:
            answers_block = "\nPREVIOUS CLARIFYING ANSWERS:\n" + "\n".join(lines) + "\n"

    return SKILL_WEAVE_PROMPT.format(
        skills_block=skills_block,
        answers_block=answers_block,
        profile_outline=profile_outline or "(empty profile)"
    )


def _finalize_skill_weave(data: Dict[str, Any], profile_corpus: str) -> Dict[str, Any]:
    """Normalize the model payload, strip AI dashes, attach warn-level guards."""
    needs = bool(data.get("needs_clarification"))
    questions = _safe_list_of_strings(data.get("clarifying_questions"), max_items=6, max_len=300)
    facts = _safe_list_of_strings(data.get("facts_used"), max_items=20, max_len=300)

    injections = []
    for inj in (data.get("injections") or []):
        if not isinstance(inj, dict):
            continue
        proposed = strip_ai_dashes(str(inj.get("proposed_text", "")).strip())
        if not proposed:
            continue
        original = str(inj.get("original_text", "")).strip()
        action = "edit" if str(inj.get("action", "")).strip().lower() == "edit" else "add"
        new_type = inj.get("new_node_type")
        new_type = str(new_type).strip() if new_type else None

        humanity = evaluate_humanity_hybrid(
            proposed, source_text=profile_corpus, mode="quick", llm_enabled=False
        )
        injections.append({
            "target_kind": str(inj.get("target_kind", "other")).strip() or "other",
            "action": action,
            "node_id": _coerce_int_or_none(inj.get("node_id")) if action == "edit" else None,
            "parent_node_id": _coerce_int_or_none(inj.get("parent_node_id")) if action == "add" else None,
            "new_node_type": new_type if action == "add" else None,
            "original_text": original if action == "edit" else "",
            "proposed_text": proposed,
            "rationale": str(inj.get("rationale", "")).strip()[:300],
            "integrity": audit_refinement(original, proposed, profile_corpus=profile_corpus),
            "humanity": {
                "score": humanity.get("score"),
                "risk_level": humanity.get("risk_level"),
                "flags": [v.get("message") for v in (humanity.get("violations") or [])][:4],
            },
        })

    # If the model proposed nothing usable and didn't ask, surface a clarify state.
    if not needs and not injections:
        needs = True
        if not questions:
            questions = ["Can you tell me a bit more about when and where you used this skill?"]

    return {
        "needs_clarification": needs,
        "clarifying_questions": questions if needs else [],
        "facts_used": facts,
        "injections": [] if needs else injections,
    }


def propose_skill_weave(
    provider: str,
    skills: List[Dict[str, str]],
    profile_outline: str,
    profile_corpus: str = "",
    answers: Optional[List[Dict[str, str]]] = None,
    model: str = None,
    reasoning_effort: str = None,
    api_key: str = None,
    claude_effort: str = None,
) -> Dict[str, Any]:
    """
    Ask clarifying questions (if facts are missing) or propose how to weave a new
    skill across the profile. Uses the user-selected provider ('openai'|'claude')
    with the shared SKILL_WEAVE_SCHEMA structured output. ``claude_effort`` sets the
    Claude thinking depth; ``reasoning_effort`` is the OpenAI reasoning effort.
    """
    provider = (provider or "openai").strip().lower()
    user_prompt = _build_skill_weave_prompt(skills, profile_outline, answers)
    started_at = _now_iso()
    start_ts = time.time()

    if not api_key:
        return {
            "success": False,
            "error": f"{'Claude' if provider == 'claude' else 'OpenAI'} API key missing. Add your key in AI Settings.",
        }

    try:
        if provider == "claude":
            requested_model = model or os.getenv("CLAUDE_MODEL_VERSION", "claude-opus-4-8")
            logger.step(f"Skill weave with Claude ({requested_model})", step_num=1)
            data, resolved_model, effort_used = call_claude_structured(
                api_key=api_key,
                model=requested_model,
                system=SKILL_WEAVE_SYSTEM,
                user_prompt=user_prompt,
                schema=SKILL_WEAVE_SCHEMA,
                max_tokens=8192,
                effort=claude_effort,
                timeout=180.0,
            )
            api_name = "messages.create"
            reasoning_used = effort_used
        else:
            requested_model = model or DEFAULT_OPENAI_MODEL
            resolved_reasoning = _resolve_reasoning_effort(reasoning_effort)
            logger.step(f"Skill weave with OpenAI ({requested_model})", step_num=1)
            result = call_openai_for_json(
                system_prompt=SKILL_WEAVE_SYSTEM,
                user_prompt=user_prompt,
                model=requested_model,
                reasoning_effort=resolved_reasoning,
                api_key=api_key,
                timeout=180,
                schema=SKILL_WEAVE_SCHEMA,
                schema_name="skill_weave",
            )
            if not result["success"]:
                return {"success": False, "error": result["error"]}
            data = result["data"]
            resolved_model = result.get("actual_model") or result.get("model", requested_model)
            api_name = result.get("api_name", "")
            reasoning_used = resolved_reasoning if _uses_reasoning(requested_model) else ""

        payload = _finalize_skill_weave(data, profile_corpus)
        duration_ms = int((time.time() - start_ts) * 1000)
        logger.success(
            f"Skill weave done: needs_clarification={payload['needs_clarification']}, "
            f"injections={len(payload['injections'])} in {duration_ms / 1000:.2f}s"
        )
        payload.update({
            "success": True,
            "model": resolved_model,
            "runtime": _build_runtime(
                stage="skill_weave",
                provider="anthropic" if provider == "claude" else "openai",
                requested_model=requested_model,
                resolved_model=resolved_model,
                api_name=api_name,
                reasoning_effort=reasoning_used,
                started_at=started_at,
                finished_at=_now_iso(),
                duration_ms=duration_ms,
            ),
        })
        return payload
    except Exception as e:
        logger.error("Skill weave exception", error=e)
        return {"success": False, "error": str(e)}


# ============================================================================
# Refine-All: one holistic, deduped, tailored, human-voice rewrite of a CV
# ============================================================================

REFINE_ALL_SYSTEM = (
    "You are a senior CV editor producing a final, apply-ready CV tailored to one job. "
    "You write like a real person: plain first-person English, short sentences, concrete. "
    "You never use em-dashes or double hyphens. You never use cliche AI words. "
    "You only use facts already present in the CV. You never invent numbers, dates, "
    "employers, tools, scope, or results."
)

REFINE_ALL_PROMPT = """Polish this whole CV into a final, tailored, apply-ready version for the job below.

You return STRUCTURED edits, not free text. We keep every section title and every entry
header (job title, employer, dates, location) EXACTLY as they are now. You only refine the
bullet / paragraph CONTENT, and decide what to keep, merge, drop, add, and in what order.

JOB DESCRIPTION:
{job_description}

WHAT THE ROLE NEEDS (extracted requirements):
{requirements}

THE CURRENT SELECTED CV (indented outline; each line tagged [#<id> <type>]):
{cv_outline}
{instructions_block}{length_block}
Return a "sections" list. For EACH section node ([#<id> section]) in the CV add one object:
- node_id: that section's [#id].
- If the section is built from ENTRIES ([#<id> entry], e.g. work experience, education, projects):
    * set direct_kind = "none" and direct_items = [].
    * set entries = the entries to KEEP, in their final order, each as:
        {{ "node_id": the entry's [#id], "bullets": [the entry's final bullet lines] }}
    * To DROP an entry, leave it out. To REORDER, change the order in the list.
    * NEVER restate or change an entry header; we keep its title, employer, dates, and location as-is.
    * Refine each entry's bullets: tighten, merge near-duplicates, sort strongest first, drop weak or
      off-topic ones, and you MAY move a bullet to a more fitting entry. Use ONLY facts already in the CV.
- If the section is a SUMMARY / PROFILE paragraph:
    * set direct_kind = "paragraph", direct_items = [ONE tight paragraph, 3 to 4 short sentences], entries = [].
- If the section is a list of SKILLS / short bullet lines:
    * set direct_kind = "bullets", direct_items = [the final, deduped, sorted bullet lines], entries = [].

Hard rules:
- Use ONLY facts already in the CV. Never invent a number, date, employer, tool, or scope.
- Remove duplicates ACROSS the whole CV. Keep the strongest once. Merge near-identical bullets.
- Sort items so the most role-relevant come first. Drop weak, off-topic, or repeated items.
- Keep it honest and human: short sentences (about 12 to 18 words), first person, plain words.
- No em-dashes. No "--". Avoid words like leveraged, spearheaded, results-driven, passionate about, proven track record, cutting-edge, synergy, dynamic professional.
- You may improve profile_title to fit the role (human, plain), or set it to null to leave it.
- List in removed_or_merged the duplicates or weak items you merged or dropped.
- Keep the whole CV within the target length."""


def _finalize_refine_all(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize the structure-preserving holistic payload: keep node ids, strip AI
    dashes from every bullet/paragraph, and drop empty items. Section and entry
    headers are intentionally NOT carried here, the frontend keeps them verbatim
    from the existing snapshot by node_id so formatting never changes.
    """
    sections = []
    for s in (data.get("sections") or []):
        if not isinstance(s, dict):
            continue
        node_id = _coerce_int_or_none(s.get("node_id"))
        if node_id is None:
            continue

        direct_kind = str(s.get("direct_kind", "none")).strip().lower()
        if direct_kind not in {"paragraph", "bullets", "none"}:
            direct_kind = "none"
        direct_items = [
            strip_ai_dashes(x)
            for x in _safe_list_of_strings(s.get("direct_items"), max_items=80, max_len=800)
        ]
        direct_items = [x for x in direct_items if x.strip()]

        entries = []
        for e in (s.get("entries") or []):
            if not isinstance(e, dict):
                continue
            entry_id = _coerce_int_or_none(e.get("node_id"))
            if entry_id is None:
                continue
            bullets = [
                strip_ai_dashes(b)
                for b in _safe_list_of_strings(e.get("bullets"), max_items=40, max_len=800)
            ]
            bullets = [b for b in bullets if b.strip()]
            entries.append({"node_id": entry_id, "bullets": bullets})

        # Skip a section that produced nothing usable.
        if not direct_items and not entries:
            continue
        sections.append({
            "node_id": node_id,
            "direct_kind": direct_kind,
            "direct_items": direct_items,
            "entries": entries,
        })

    title = data.get("profile_title")
    title = strip_ai_dashes(str(title).strip()) if title else None
    return {
        "profile_title": title or None,
        "sections": sections,
        "removed_or_merged": _safe_list_of_strings(data.get("removed_or_merged"), max_items=30, max_len=300),
        "changes_summary": str(data.get("changes_summary", "")).strip()[:600],
    }


def _refine_all_text_for_guards(payload: Dict[str, Any]) -> str:
    """Flatten refined bullets/paragraphs into plain text for humanity/integrity checks."""
    parts: List[str] = []
    for s in payload.get("sections", []):
        parts.extend(s.get("direct_items", []))
        for entry in s.get("entries", []):
            parts.extend(entry.get("bullets", []))
    return "\n".join(p for p in parts if p)


def refine_full_cv(
    provider: str,
    cv_outline: str,
    full_cv_text: str,
    job_description: str = "",
    requirements: Optional[Dict[str, Any]] = None,
    target_pages=None,
    human_strict: bool = True,
    instructions: str = "",
    model: str = None,
    reasoning_effort: str = None,
    api_key: str = None,
    claude_effort: str = None,
) -> Dict[str, Any]:
    """
    One holistic pass over the whole selected CV: dedup across sections, merge,
    unify the summary, sort by relevance, tailor to the role, hit the target
    length, in a human voice using only facts already in the CV. Uses the
    user-selected provider ('openai'|'claude') with REFINE_ALL_SCHEMA. Returns a
    proposal (nothing is written).
    """
    provider = (provider or "openai").strip().lower()
    started_at = _now_iso()
    start_ts = time.time()

    if not api_key:
        return {"success": False, "error": f"{'Claude' if provider == 'claude' else 'OpenAI'} API key missing. Add your key in AI Settings."}

    length_block = ""
    if target_pages in (1, 2):
        length_block = f"\nTARGET LENGTH: the whole CV should fit about {target_pages} page(s). Be concise.\n"
    instructions_block = ""
    if (instructions or "").strip():
        instructions_block = f"\nEXTRA INSTRUCTIONS FROM THE PERSON: {instructions.strip()}\n"

    user_prompt = REFINE_ALL_PROMPT.format(
        job_description=job_description or "(not provided)",
        requirements=json.dumps(requirements or {}, indent=2),
        cv_outline=cv_outline or "(empty)",
        instructions_block=instructions_block,
        length_block=length_block,
    )

    try:
        if provider == "claude":
            requested_model = model or os.getenv("CLAUDE_MODEL_VERSION", "claude-opus-4-8")
            logger.step(f"Refine-all with Claude ({requested_model})", step_num=1)
            data, resolved_model, effort_used = call_claude_structured(
                api_key=api_key,
                model=requested_model,
                system=REFINE_ALL_SYSTEM,
                user_prompt=user_prompt,
                schema=REFINE_ALL_SCHEMA,
                max_tokens=16384,
                effort=claude_effort,
                timeout=240.0,
            )
            api_name = "messages.create"
            reasoning_used = effort_used
        else:
            requested_model = model or DEFAULT_OPENAI_MODEL
            resolved_reasoning = _resolve_reasoning_effort(reasoning_effort)
            logger.step(f"Refine-all with OpenAI ({requested_model})", step_num=1)
            result = call_openai_for_json(
                system_prompt=REFINE_ALL_SYSTEM,
                user_prompt=user_prompt,
                model=requested_model,
                reasoning_effort=resolved_reasoning,
                api_key=api_key,
                timeout=240,
                schema=REFINE_ALL_SCHEMA,
                schema_name="refine_all",
            )
            if not result["success"]:
                return {"success": False, "error": result["error"]}
            data = result["data"]
            resolved_model = result.get("actual_model") or result.get("model", requested_model)
            api_name = result.get("api_name", "")
            reasoning_used = resolved_reasoning if _uses_reasoning(requested_model) else ""

        payload = _finalize_refine_all(data)
        refined_text = _refine_all_text_for_guards(payload)
        payload["integrity"] = audit_refinement(full_cv_text or " ", refined_text, profile_corpus=full_cv_text)
        hum = evaluate_humanity_hybrid(
            refined_text, source_text=full_cv_text,
            mode="deep" if human_strict else "quick", llm_enabled=False
        )
        payload["humanity"] = {
            "score": hum.get("score"),
            "risk_level": hum.get("risk_level"),
            "flags": [v.get("message") for v in (hum.get("violations") or [])][:6],
        }

        duration_ms = int((time.time() - start_ts) * 1000)
        logger.success(f"Refine-all done: {len(payload['sections'])} sections in {duration_ms / 1000:.2f}s")
        payload.update({
            "success": True,
            "model": resolved_model,
            "runtime": _build_runtime(
                stage="refine_all",
                provider="anthropic" if provider == "claude" else "openai",
                requested_model=requested_model,
                resolved_model=resolved_model,
                api_name=api_name,
                reasoning_effort=reasoning_used,
                started_at=started_at,
                finished_at=_now_iso(),
                duration_ms=duration_ms,
            ),
        })
        return payload
    except Exception as e:
        logger.error("Refine-all exception", error=e)
        return {"success": False, "error": str(e)}


# ============================================================================
# Cover Letter: short, human-voice letter from the JD + the candidate's profile
# ============================================================================

COVER_LETTER_SYSTEM = (
    "You write short, honest cover letters in the candidate's own voice. Plain "
    "first-person English, short sentences, concrete. You never use em-dashes or "
    "double hyphens, and you avoid cliche AI words. You use only facts from the CV "
    "and the candidate's own words. You never invent achievements, numbers, tools, "
    "or reasons for wanting the job."
)

COVER_LETTER_PROMPT = """Write a short cover letter for this job, in the candidate's own honest voice.

CANDIDATE NAME: {candidate_name}
JOB TITLE: {job_title}
COMPANY: {company}

JOB DESCRIPTION:
{job_description}

THE CANDIDATE'S CV (use ONLY these facts):
{cv_text}
{extra_block}
Rules:
- Greeting: "Dear {greeting_name}," then 2 to 3 short paragraphs, then sign off with the candidate's name.
- Plain spoken English, first person. Short sentences, about 12 to 18 words each.
- Paragraph 1: why I am a fit for this specific role. Paragraph 2: one or two concrete things I have done that match. Paragraph 3: a brief, grounded close.
- Use ONLY facts from the CV and the person's own words above. Do not invent achievements, numbers, tools, or motivation.
- If the person did not say why they want the role, keep the motivation simple and grounded in the work itself. Do not gush.
- No em-dashes. No "--". Avoid words like leveraged, spearheaded, results-driven, passionate about, proven track record, cutting-edge, synergy, dynamic professional.
- Keep the whole letter under about 250 words.

Return cover_letter (the full letter text) and highlights_used (the CV facts you leaned on)."""


def generate_cover_letter(
    provider: str,
    job_description: str = "",
    job_title: str = "",
    company: str = "",
    candidate_name: str = "",
    cv_text: str = "",
    motivation: str = "",
    emphasis: str = "",
    hiring_manager: str = "",
    model: str = None,
    reasoning_effort: str = None,
    api_key: str = None,
    claude_effort: str = None,
) -> Dict[str, Any]:
    """
    Generate a short, human-voice cover letter from the job description and the
    candidate's profile, using the chosen provider (openai|claude). Optional
    motivation / emphasis / hiring_manager personalize it without inventing facts.
    """
    provider = (provider or "openai").strip().lower()
    started_at = _now_iso()
    start_ts = time.time()
    if not api_key:
        return {"success": False, "error": f"{'Claude' if provider == 'claude' else 'OpenAI'} API key missing. Add your key in AI Settings."}

    extra_lines = []
    if (motivation or "").strip():
        extra_lines.append(f"WHY THE PERSON WANTS THIS ROLE (their words): {motivation.strip()}")
    if (emphasis or "").strip():
        extra_lines.append(f"THINGS TO EMPHASIZE (their words): {emphasis.strip()}")
    extra_block = ("\n" + "\n".join(extra_lines) + "\n") if extra_lines else ""
    greeting_name = hiring_manager.strip() if (hiring_manager or "").strip() else "Hiring Team"

    user_prompt = COVER_LETTER_PROMPT.format(
        candidate_name=candidate_name or "the candidate",
        job_title=job_title or "(not provided)",
        company=company or "(not provided)",
        job_description=job_description or "(not provided)",
        cv_text=cv_text or "(empty)",
        extra_block=extra_block,
        greeting_name=greeting_name,
    )

    try:
        if provider == "claude":
            requested_model = model or os.getenv("CLAUDE_MODEL_VERSION", "claude-opus-4-8")
            logger.step(f"Cover letter with Claude ({requested_model})", step_num=1)
            data, resolved_model, effort_used = call_claude_structured(
                api_key=api_key,
                model=requested_model,
                system=COVER_LETTER_SYSTEM,
                user_prompt=user_prompt,
                schema=COVER_LETTER_SCHEMA,
                max_tokens=4096,
                effort=claude_effort,
                timeout=120.0,
            )
            api_name = "messages.create"
            reasoning_used = effort_used
        else:
            requested_model = model or DEFAULT_OPENAI_MODEL
            resolved_reasoning = _resolve_reasoning_effort(reasoning_effort)
            logger.step(f"Cover letter with OpenAI ({requested_model})", step_num=1)
            result = call_openai_for_json(
                system_prompt=COVER_LETTER_SYSTEM,
                user_prompt=user_prompt,
                model=requested_model,
                reasoning_effort=resolved_reasoning,
                api_key=api_key,
                timeout=120,
                schema=COVER_LETTER_SCHEMA,
                schema_name="cover_letter",
            )
            if not result["success"]:
                return {"success": False, "error": result["error"]}
            data = result["data"]
            resolved_model = result.get("actual_model") or result.get("model", requested_model)
            api_name = result.get("api_name", "")
            reasoning_used = resolved_reasoning if _uses_reasoning(requested_model) else ""

        letter = strip_ai_dashes(str(data.get("cover_letter", "")).strip())
        highlights = _safe_list_of_strings(data.get("highlights_used"), max_items=12, max_len=300)
        corpus = " ".join([cv_text or "", motivation or "", emphasis or ""])
        hum = evaluate_humanity_hybrid(letter, source_text=corpus, mode="quick", llm_enabled=False)
        duration_ms = int((time.time() - start_ts) * 1000)
        logger.success(f"Cover letter done ({len(letter)} chars) in {duration_ms / 1000:.2f}s")
        return {
            "success": True,
            "model": resolved_model,
            "cover_letter": letter,
            "highlights_used": highlights,
            "integrity": audit_refinement(corpus or " ", letter, profile_corpus=corpus),
            "humanity": {
                "score": hum.get("score"),
                "risk_level": hum.get("risk_level"),
                "flags": [v.get("message") for v in (hum.get("violations") or [])][:4],
            },
            "runtime": _build_runtime(
                stage="cover_letter",
                provider="anthropic" if provider == "claude" else "openai",
                requested_model=requested_model,
                resolved_model=resolved_model,
                api_name=api_name,
                reasoning_effort=reasoning_used,
                started_at=started_at,
                finished_at=_now_iso(),
                duration_ms=duration_ms,
            ),
        }
    except Exception as e:
        logger.error("Cover letter exception", error=e)
        return {"success": False, "error": str(e)}


def generate_profile_pool_node_fix_with_openai(
    node_text: str,
    node_type: str,
    node_path: str,
    issue: Dict[str, Any],
    profile_context: str = "",
    user_instructions: str = None,
    model: str = None,
    reasoning_effort: str = None,
    api_key: str = None,
    humanity_llm_enabled: bool = HUMANITY_DEEP_MODE_ENABLED,
    humanity_llm_model: str = HUMANITY_LLM_MODEL,
    humanity_llm_reasoning_effort: str = HUMANITY_LLM_REASONING,
    humanity_llm_api_key: str = None
) -> Dict[str, Any]:
    """
    Generate a human-sounding, fact-preserving rewrite for a single profile-pool node.
    Used by Profile Pool quality "AI Fix" actions.
    """
    text_to_fix = (node_text or "").strip()
    if not text_to_fix:
        return {
            "success": False,
            "error": "No node text provided for AI fix."
        }

    model_to_use = model if (model and (str(model).startswith("gpt-") or str(model).startswith("o"))) else DEFAULT_OPENAI_MODEL
    normalized_reasoning = _resolve_reasoning_effort(reasoning_effort)
    issue_payload = {
        "type": str((issue or {}).get("type", "")).strip().lower(),
        "severity": str((issue or {}).get("severity", "")).strip().lower(),
        "message": str((issue or {}).get("message", "")).strip(),
        "where": _safe_list_of_strings((issue or {}).get("where"), max_items=4, max_len=220),
        "how_to_fix": _safe_list_of_strings((issue or {}).get("how_to_fix"), max_items=4, max_len=220)
    }

    system_prompt = (
        "You are a CV writing-quality fixer for Profile Pool nodes. "
        "Return valid JSON only. "
        "Never invent experience, tools, numbers, scope, titles, or impact."
    )

    prompt = f"""You will rewrite ONE profile-pool node to address a detected writing issue.

Hard constraints:
- Keep factual meaning the same.
- Do not add new achievements, tools, percentages, money, or claims.
- If a number is not already in the original text, do not add it.
- Keep tone human-written, concrete, and concise.
- Remove AI-sounding buzzwords and formulaic phrasing.
- Prefer minimal rewrite: tighten wording first, do not over-edit.

Node metadata:
- node_type: {node_type}
- node_path: {node_path}

Detected issue JSON:
{json.dumps(issue_payload, indent=2)}

Original node text:
{text_to_fix}

Optional user instructions:
{(user_instructions or "None").strip()}

Profile context (for consistency only, not for importing new facts):
{(profile_context or "")[:12000]}

Return JSON with this exact shape:
{{
  "revised_text": "string",
  "change_summary": "1-2 short sentences",
  "confidence": 0-100
}}
"""

    try:
        result = call_openai_for_json(
            system_prompt=system_prompt,
            user_prompt=prompt,
            model=model_to_use,
            reasoning_effort=normalized_reasoning,
            api_key=api_key,
            timeout=90
        )
        if not result.get("success"):
            return {
                "success": False,
                "error": result.get("error", "AI fix failed"),
                "model": model_to_use
            }

        data = result.get("data") or {}
        revised_text = sanitize_unicode_for_pdf(str(data.get("revised_text", "")).strip())
        if not revised_text:
            return {
                "success": False,
                "error": "AI did not return revised_text.",
                "model": model_to_use
            }

        change_summary = sanitize_unicode_for_pdf(str(data.get("change_summary", "")).strip())
        confidence = _safe_score(data.get("confidence"), default=70)

        humanity = evaluate_humanity_hybrid(
            text=revised_text,
            source_text=text_to_fix,
            threshold=HUMANITY_DEFAULT_THRESHOLD,
            mode="deep" if humanity_llm_enabled else "quick",
            llm_enabled=humanity_llm_enabled,
            llm_model=humanity_llm_model,
            llm_reasoning_effort=humanity_llm_reasoning_effort,
            llm_api_key=humanity_llm_api_key
        )
        humanity["mode"] = "deep" if humanity_llm_enabled else "quick"

        return {
            "success": True,
            "model": model_to_use,
            "requested_model": result.get("requested_model", model_to_use),
            "actual_model": result.get("actual_model", model_to_use),
            "api_name": result.get("api_name", "unknown"),
            "reasoning_tokens": result.get("reasoning_tokens"),
            "revised_text": revised_text,
            "change_summary": change_summary,
            "confidence": confidence,
            "humanity": humanity,
            "prompt_sent": prompt
        }
    except Exception as e:
        logger.error("Profile pool AI fix failed", error=e)
        return {
            "success": False,
            "error": str(e),
            "model": model_to_use
        }


def refine_section_content_with_openai(
    section_content: str,
    full_cv_content: str,
    job_description: str,
    user_instructions: str = None,
    node_type: str = "section",
    node_title: str = "",
    reasoning_effort: str = None,
    claude_effort: str = None,
    api_key: str = None,
    model: str = None,
    provider: str = "openai",
    rewrite_mode: str = "minimal",
    human_strict: bool = True,
    target_pages: int = None,
    humanity_llm_enabled: bool = HUMANITY_DEEP_MODE_ENABLED,
    humanity_llm_model: str = HUMANITY_LLM_MODEL,
    humanity_llm_reasoning_effort: str = HUMANITY_LLM_REASONING,
    humanity_llm_api_key: str = None
) -> Dict[str, Any]:
    """
    Refine a single section/entry using the chosen provider (openai|claude).

    The model sees the whole CV for context (so it tailors this section
    coherently and avoids repeating points covered elsewhere) but only rewrites
    the target section.

    Args:
        section_content: Markdown content of the specific section/entry to refine
        full_cv_content: Markdown content of the entire CV (all selected sections) for context
        job_description: The job description for context
        user_instructions: Optional user instructions for refinement
        node_type: Type of node being refined ("section" or "entry")
        node_title: Title of the section/entry being refined (for summary detection)
        rewrite_mode: "minimal" (default) or "standard"
        human_strict: apply stronger human-writing guard constraints
        target_pages: optional final CV page target hint (1 or 2)
        humanity_llm_enabled: whether LLM critic is enabled for humanity scoring
        humanity_llm_model: model used for LLM critic
        humanity_llm_reasoning_effort: reasoning effort for LLM critic

    Returns:
        Dict with refined_content, changes_summary, stats, and prompt_sent
    """
    provider_norm = (provider or "openai").strip().lower()
    if provider_norm == "claude":
        model_to_use = model or os.getenv("CLAUDE_MODEL_VERSION", "claude-opus-4-8")
    else:
        model_to_use = model or DEFAULT_OPENAI_MODEL

    if not api_key:
        return {
            "success": False,
            "error": f"{'Claude' if provider_norm == 'claude' else 'OpenAI'} API key missing. Add your key in AI Settings.",
            "model": model_to_use
        }

    # Build the refinement prompt with full CV context
    refinement_target = "SECTION" if node_type == "section" else "ENTRY"
    refinement_target_lower = refinement_target.lower()

    # Detect if this is a summary-type section
    summary_keywords = ['summary', 'profile', 'overview', 'objective', 'about', 'introduction', 'executive summary', 'professional summary', 'professional profile', 'career summary']
    is_summary = any(keyword in node_title.lower() for keyword in summary_keywords)

    normalized_rewrite_mode = (rewrite_mode or "minimal").strip().lower()
    if normalized_rewrite_mode not in {"minimal", "standard"}:
        normalized_rewrite_mode = "minimal"

    rewrite_mode_instruction = (
        "Rewrite mode is MINIMAL (default): prefer tightening, merging, and reordering existing wording. "
        "Only make substantive wording changes when clarity or job-fit meaningfully improves."
        if normalized_rewrite_mode == "minimal"
        else "Rewrite mode is STANDARD: you may do broader rephrasing while preserving factual grounding."
    )

    target_pages_instruction = ""
    if target_pages in (1, 2):
        target_pages_instruction = (
            f"Final CV target length is {target_pages} page(s). "
            f"Adjust compression/detail in this {refinement_target_lower} so the full CV can realistically fit {target_pages} page(s). "
            "Do not pad with generic filler."
        )

    # Build summary-specific instructions
    summary_instructions = ""
    if is_summary:
        summary_instructions = """
═══════════════════════════════════════════════════════════════════════════
⚠️  CRITICAL CONSTRAINT FOR SUMMARY/PROFILE SECTIONS - READ THIS FIRST  ⚠️
═══════════════════════════════════════════════════════════════════════════

This is a summary/profile section. You MUST choose ONE format and STRICTLY follow its rules.

STEP 1: CHOOSE EXACTLY ONE FORMAT (pick the best fit for the content and role):

┌─────────────────────────────────────────────────────────────────────────┐
│ FORMAT A: PARAGRAPH ONLY                                                │
│ Rules if you choose this:                                               │
│ ✓ Output EXACTLY ONE paragraph, maximum 7 lines                         │
│ ✗ ZERO bullets - not a single bullet point allowed                      │
│ ✗ ZERO additional paragraphs - just ONE paragraph total                 │
│                                                                          │
│ ❌ FAILURE CONDITIONS:                                                   │
│    - If you output ANY bullets → FAILED                                 │
│    - If you output 2+ paragraphs → FAILED                               │
│    - If paragraph exceeds 7 lines → FAILED                              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ FORMAT B: BULLETS ONLY                                                  │
│ Rules if you choose this:                                               │
│ ✓ Output ONLY bullet points - maximum 5 bullets                         │
│ ✓ Each bullet maximum 3 lines                                           │
│ ✗ ZERO paragraph text - no prose before, after, or between bullets      │
│                                                                          │
│ ❌ FAILURE CONDITIONS:                                                   │
│    - If you output ANY paragraph text → FAILED                          │
│    - If you output 6+ bullets → FAILED                                  │
│    - If any bullet exceeds 3 lines → FAILED                             │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ FORMAT C: HYBRID (PARAGRAPH + BULLETS)                                  │
│ Rules if you choose this:                                               │
│ ✓ Start with EXACTLY ONE paragraph (4-5 sentences, max 5 lines)         │
│ ✓ Follow with maximum 4 bullets (each 1-2 lines max)                    │
│                                                                          │
│ ❌ FAILURE CONDITIONS:                                                   │
│    - If paragraph is missing → FAILED                                   │
│    - If bullets are missing → FAILED                                    │
│    - If you output 2+ paragraphs → FAILED                               │
│    - If you output 5+ bullets → FAILED                                  │
│    - If paragraph exceeds 5 lines → FAILED                              │
│    - If any bullet exceeds 2 lines → FAILED                             │
└─────────────────────────────────────────────────────────────────────────┘

STEP 2: BEFORE YOU OUTPUT - MANDATORY VERIFICATION CHECKLIST:

Ask yourself these questions BEFORE generating output:
1. Which format did I choose? (A, B, or C)
2. How many paragraphs am I outputting? (Count them)
3. How many bullets am I outputting? (Count them)
4. How many lines is each element? (Count lines)
5. Do ALL these counts match my chosen format's rules?

If the answer to #5 is NO → STOP and reduce content to meet limits

QUALITY RULES (apply to all formats):
• Be specific and quantifiable - avoid generic phrases like "seasoned professional"
• Focus ONLY on qualifications most relevant to THIS specific role
• This is the first thing recruiters see - every word must add value
• Use concrete numbers, technologies, and achievements where possible
• Avoid AI-sounding fluff - write like a confident human professional

═══════════════════════════════════════════════════════════════════════════
🚫 YOUR OUTPUT WILL BE REJECTED AND DISCARDED IF:
   - You mix formats (e.g., output bullets when you chose paragraph-only)
   - You exceed maximum counts for your chosen format
   - You output multiple paragraphs in non-hybrid format
   - You output generic AI fluff instead of specific qualifications
   - You forget to verify your counts before outputting
═══════════════════════════════════════════════════════════════════════════
"""

    human_strict_instruction = ""
    if human_strict:
        human_strict_instruction = """
Human-writing guardrails (strict):
- Do NOT use generic AI-style phrases such as: results-driven, dynamic professional, proven track record, fast-paced environment, cutting-edge, synergy.
- Prefer concrete, factual language with specific action verbs.
- Do NOT introduce new numeric claims/percentages unless they already exist in the target section.
- Keep tone natural and direct. Avoid inflated marketing language.
"""

    refinement_prompt = f"""I will paste:
1) The full tailored CV content (all selected sections and their children)
2) A job description
3) A specific CV {refinement_target_lower} to refine

You are a senior hiring manager and CV editor.

Your job:
{rewrite_mode_instruction}
Apply editing to the {refinement_target} ONLY to make it as strong a fit as possible for THIS specific role, while strictly respecting the constraints below AND reducing length by merging/removing redundancies.

Important context rules:
- The FULL CV content is provided for CONTEXT ONLY - to help you understand what information might be redundant or covered elsewhere in the CV.
- You must ONLY refine, rephrase, merge, shorten, or reorder content that ALREADY EXISTS in the "{refinement_target} TO REFINE" section below.
- You are NOT allowed to pull content from other sections of the full CV into this {refinement_target_lower}.
- You may NOT add new responsibilities, achievements, technologies, or domains that are not already mentioned in the "{refinement_target} TO REFINE" section.

🚨 CRITICAL CONSTRAINT - READ THIS CAREFULLY:
You can ONLY work with the content that appears in the "{refinement_target} TO REFINE" section.
- If something appears in the FULL CV but NOT in the {refinement_target} TO REFINE section → DO NOT ADD IT
- If something appears in the {refinement_target} TO REFINE section → You may refine, merge, shorten, or rephrase it
- The FULL CV is ONLY for understanding what's redundant elsewhere, NOT for pulling new content

Hard constraints (must follow all):
- Do NOT pull content from other parts of the full CV into this {refinement_target_lower}.
- You may ONLY work with content that already exists in the "{refinement_target} TO REFINE" section below.
- You may MERGE redundant bullets and REMOVE low-impact or less relevant items. Prefer fewer, denser bullets over many similar ones.
- You may do small wording adjustments to improve clarity, flow, and alignment with the job description.
- You may introduce job-description keywords ONLY when they accurately describe something already present in the {refinement_target} TO REFINE section (e.g., rephrasing "vector search on embeddings" as "retrieval system with vector indexes" is acceptable if the content clearly supports it).
- Do NOT exaggerate scope, impact, seniority, or team size beyond what is clearly implied in the {refinement_target} TO REFINE section.
- Do NOT introduce generic AI-sounding fluff or buzzwords. Keep language human, grounded, and concrete.
- Keep the tone humble but confident, and professional.
- Do NOT add content from other sections; you are ONLY editing what's already in the {refinement_target} TO REFINE section.
- Preserve the {refinement_target_lower} heading and general structure (e.g., role title, company, dates); you may reorder bullets inside the {refinement_target_lower} for relevance.

Length & compression rules:
- Actively shorten this {refinement_target_lower} while preserving all major signals that are relevant to this specific role.
- Merge bullets wherever two or more bullets express related ideas that can be combined without losing important information.
- It is encouraged to drop or heavily compress bullets that are clearly low-relevance for this role or duplicative of stronger bullets already in this {refinement_target_lower} or elsewhere in the CV.
- Aim for a noticeable reduction in total characters and bullet count in this {refinement_target_lower}, but do NOT remove unique, high-value content that clearly matches the job description or is important to my profile.
{target_pages_instruction}

ATS / job-fit optimization rules:
- Prioritize and, if needed, slightly rephrase bullets so they align with the MUST-HAVE parts of the job description.
- Make sure important skills from the full CV that match the job description (e.g., leadership, ML/LLM, MLOps, experimentation, cloud, stakeholder management, product ownership) are easy to spot in this {refinement_target_lower} and use wording that an ATS and a human recruiter will both recognize.
- Preserve tense consistency and a clean, readable Markdown format.

{summary_instructions}
{human_strict_instruction}

{f"Additional user instructions: {user_instructions}" if user_instructions else ""}

Output format (important):
Return ONLY a JSON object with this exact structure:

{{
  "refined_content": "The improved {refinement_target} ONLY in markdown format with bullets, ready to paste back into my CV",
  "changes_summary": "2-4 sentences summarizing the main edits you made (e.g., merged redundant bullets, tightened wording, reordered for relevance, removed low-relevance items). Do NOT mention the job description explicitly here.",
  "stats": {{
    "original_character_count_estimate": <integer count of characters in the original {refinement_target_lower}>,
    "refined_character_count_estimate": <integer count of characters in the refined {refinement_target_lower}>,
    "characters_reduced_estimate": <original minus refined>,
    "original_bullet_count_estimate": <integer count of bullets in the original {refinement_target_lower}>,
    "refined_bullet_count_estimate": <integer count of bullets in the refined {refinement_target_lower}>,
    "bullets_removed_or_merged_estimate": <original minus refined, or your best estimate>
  }}
}}

Fill in the numeric stats fields with your best estimates based on the {refinement_target} text.

Now I will provide:

FULL CV Content (for context, do NOT rewrite this as a whole):
{full_cv_content}

Job Description (for relevance context):
{job_description}

{refinement_target} TO REFINE (this is the ONLY part you should rewrite):
{section_content}

Remember: Return ONLY the JSON object, no other text."""

    # Log the refinement operation
    logger.step(f"Refining {refinement_target_lower} with {model_to_use}", step_num=1)
    logger.info(f"Content length: {len(section_content)} chars | Type: {node_type}")
    logger.info(f"Rewrite mode: {normalized_rewrite_mode} | Human strict: {human_strict}")
    if target_pages in (1, 2):
        logger.info(f"Target CV pages: {target_pages}")
    if reasoning_effort:
        logger.info(f"Reasoning effort: {reasoning_effort}")

    # Shared system prompt: human voice, no AI dashes, holistic (context) awareness.
    refine_system = (
        "You are a senior hiring manager and CV editor. You write like a real person: "
        "plain language, short sentences, first person where natural. You never use "
        "em-dashes or double hyphens, and you avoid cliche AI words. You can see the whole "
        "CV for context: keep this section consistent with the rest and do not repeat points "
        "already covered well elsewhere. Use only facts already present. Respond with valid JSON."
    )

    try:
        if provider_norm == "claude":
            data, claude_model_resolved, _effort_used = call_claude_structured(
                api_key=api_key,
                model=model_to_use,
                system=refine_system,
                user_prompt=refinement_prompt,
                schema=REFINE_SECTION_SCHEMA,
                max_tokens=8192,
                effort=claude_effort,
                timeout=120.0,
            )
            result = {"success": True, "data": data, "actual_model": claude_model_resolved}
        else:
            # Pass reasoning_effort directly (including "none") - wrapper will handle it
            result = call_openai_for_json(
                system_prompt=refine_system,
                user_prompt=refinement_prompt,
                model=model_to_use,
                reasoning_effort=reasoning_effort,  # Can be none, low, medium, high, or None
                api_key=api_key,
                timeout=120,  # 2 minute timeout for refinement
                schema=REFINE_SECTION_SCHEMA,
                schema_name="refine_section",
            )
            if not result["success"]:
                logger.error(f"Refinement failed: {result['error']}")
                return {
                    "success": False,
                    "error": result["error"],
                    "model": model_to_use,
                    "prompt_sent": refinement_prompt
                }
            data = result["data"]

        # Sanitize Unicode for PDF, then strip AI dashes so no em-dash / "--" survives.
        if data.get("refined_content"):
            data["refined_content"] = strip_ai_dashes(sanitize_unicode_for_pdf(data["refined_content"]))
        if data.get("changes_summary"):
            data["changes_summary"] = strip_ai_dashes(sanitize_unicode_for_pdf(data["changes_summary"]))

        # Log the results
        stats = data.get("stats", {})
        chars_before = stats.get("original_character_count_estimate", "N/A")
        chars_after = stats.get("refined_character_count_estimate", "N/A")
        chars_saved = stats.get("characters_reduced_estimate", "N/A")
        logger.success(f"Refinement complete: {chars_before} → {chars_after} chars ({chars_saved} saved)")

        if "reasoning_tokens" in result:
            logger.info(f"Reasoning tokens: {result['reasoning_tokens']}")

        humanity = evaluate_humanity_hybrid(
            text=data.get("refined_content", ""),
            source_text=section_content if human_strict else "",
            threshold=HUMANITY_DEFAULT_THRESHOLD,
            mode="deep" if human_strict else "quick",
            llm_enabled=humanity_llm_enabled,
            llm_model=humanity_llm_model,
            llm_reasoning_effort=humanity_llm_reasoning_effort,
            llm_api_key=humanity_llm_api_key
        )
        humanity["mode"] = "strict" if human_strict else "advisory"
        humanity["rewrite_mode"] = normalized_rewrite_mode
        if target_pages in (1, 2):
            humanity["target_pages"] = target_pages

        return {
            "success": True,
            "model": model_to_use,
            "refined_content": data.get("refined_content", ""),
            "changes_summary": data.get("changes_summary", ""),
            "stats": stats,
            "prompt_sent": refinement_prompt,
            "reasoning_tokens": result.get("reasoning_tokens"),
            "humanity": humanity
        }

    except Exception as e:
        logger.error("Refinement exception", error=e)
        return {
            "success": False,
            "error": str(e),
            "model": model_to_use,
            "prompt_sent": refinement_prompt
        }
