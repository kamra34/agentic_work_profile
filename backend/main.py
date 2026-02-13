"""
FastAPI backend with universal hierarchical node structure.
Generic endpoints handle all profile content through ProfileNode model.
"""

from fastapi import FastAPI, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, func, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.orm.attributes import flag_modified
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
from typing import List, Optional, Dict, Any
from collections import Counter, defaultdict
import os
import re
import hashlib
from dotenv import load_dotenv
import uuid
from pathlib import Path
import asyncio
from concurrent.futures import ThreadPoolExecutor
import json

# Load .env from project root (parent directory)
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

from models import User, Profile, ProfileNode, TailoredCV, JobApplication
from schemas import (
    UserRegister, UserLogin, Token, UserResponse,
    UserProfileInfo, UserProfileInfoUpdate, UserAISettings, UserAISettingsUpdate,
    ProfileResponse, ProfileCreate, ProfileUpdate,
    ProfileNodeResponse, ProfileNodeCreate, ProfileNodeUpdate,
    JobApplicationCreate, JobApplicationUpdate, JobApplicationResponse
)
import ai_tailor_service
import pdf_service
from logger_config import get_logger

# ============================================================================
# SHARED HELPER FUNCTIONS
# ============================================================================

def transform_nodes_to_sections(nodes):
    """
    Transform hierarchical nodes into flat sections with entries - ONLY SELECTED NODES.
    Handles any nesting level dynamically (not hardcoded to specific levels).

    This is the SINGLE SOURCE OF TRUTH for node transformation used by:
    - /api/tailor/{cv_id}/preview-pdf (CV Portfolio download)
    - /api/tailor/{cv_id}/preview-metadata (Live preview stats)
    - /api/tailor/{cv_id}/preview-image (Live preview images)
    - /api/applications/{application_id}/download-pdf (Application Tracker download)

    Using the same function ensures consistent PDF output across all endpoints.
    """
    sections = []

    # Helper function to recursively collect all bullets from any depth
    def collect_bullets_recursively(node, depth=0):
        """Recursively collect all selected bullets/paragraphs from this node and its children"""
        bullets = []

        for child in node.get('children', []):
            if not child.get('is_selected', False):
                continue  # Skip unselected nodes

            child_type = child.get('node_type')

            # If this child is a bullet/paragraph, add it
            if child_type in ['bullet', 'paragraph']:
                bullets.append({
                    'id': child.get('id', 0),
                    'content': child.get('content', ''),
                    'order': child.get('order', 0),
                    'node_type': child_type  # Preserve node_type for PDF rendering
                })

            # If this child is an entry, treat it as a sub-entry
            elif child_type == 'entry':
                # Recursively collect bullets from this entry
                sub_bullets = collect_bullets_recursively(child, depth + 1)
                if sub_bullets:
                    # This is a sub-entry with its own bullets
                    bullets.append({
                        'type': 'sub_entry',
                        'title': child.get('title'),
                        'items': sub_bullets
                    })
                elif child.get('content'):
                    # Entry with just content, no bullets
                    bullets.append({
                        'id': child.get('id', 0),
                        'content': child.get('content', ''),
                        'order': child.get('order', 0),
                        'node_type': child_type  # Preserve node_type for PDF rendering
                    })

            # For any other type, recurse into children
            else:
                sub_bullets = collect_bullets_recursively(child, depth + 1)
                bullets.extend(sub_bullets)

        return bullets

    for node in nodes:
        # Level 0 must always be 'section'
        if node.get('node_type') != 'section' or not node.get('is_selected', False):
            continue

        section = {
            'title': node.get('title', ''),
            'section_type': node.get('title', '').lower().replace(' ', '_'),
            'entries': []
        }

        # Process all children dynamically - could be entries, bullets, paragraphs at any level
        for child in node.get('children', []):
            if not child.get('is_selected', False):
                continue

            child_type = child.get('node_type')

            # If it's a bullet/paragraph directly under section
            if child_type in ['bullet', 'paragraph']:
                # Create a simple entry with just this bullet
                section['entries'].append({
                    'title': None,
                    'subtitle': None,
                    'start_date': None,
                    'end_date': None,
                    'location': None,
                    'description': None,
                    'items': [{
                        'id': child.get('id', 0),
                        'content': child.get('content', ''),
                        'order': child.get('order', 0),
                        'node_type': child_type  # Preserve node_type for PDF rendering
                    }],
                    'sub_entries': []
                })

            # If it's an entry directly under section
            elif child_type == 'entry':
                # Collect all bullets recursively from this entry
                all_bullets = collect_bullets_recursively(child)

                # Separate regular bullets from sub-entries
                regular_bullets = [b for b in all_bullets if not isinstance(b, dict) or b.get('type') != 'sub_entry']
                sub_entries_data = [b for b in all_bullets if isinstance(b, dict) and b.get('type') == 'sub_entry']

                entry = {
                    'title': child.get('title'),
                    'subtitle': child.get('subtitle'),
                    'start_date': child.get('start_date'),
                    'end_date': child.get('end_date'),
                    'location': child.get('location'),
                    'description': child.get('content') if child.get('content') else None,
                    'items': regular_bullets,
                    'sub_entries': sub_entries_data
                }
                section['entries'].append(entry)

            # Handle any other node type by recursing
            else:
                bullets = collect_bullets_recursively(child)
                if bullets:
                    section['entries'].append({
                        'title': None,
                        'subtitle': None,
                        'start_date': None,
                        'end_date': None,
                        'location': None,
                        'description': None,
                        'items': bullets,
                        'sub_entries': []
                    })

        # Add section even if empty (some templates may need it)
        sections.append(section)

    return sections


def _sanitize_filename_part(value: Optional[str], fallback: str) -> str:
    """Keep original text style; only remove filesystem-invalid filename chars."""
    text = (value or "").strip()
    if not text:
        text = fallback

    text = (
        text
        .replace("â€“", "-")
        .replace("â€”", "-")
        .replace("–", "-")
        .replace("—", "-")
    )
    # Windows-invalid filename chars: <>:"/\|?* and control chars
    text = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "-", text)
    # Trim trailing spaces/dots (Windows restriction)
    text = text.strip().strip(".")
    return text or fallback


def _build_cv_export_filename(job_title: Optional[str], company_name: Optional[str], full_name: Optional[str]) -> str:
    safe_job_title = _sanitize_filename_part(job_title, "Job")
    safe_company = _sanitize_filename_part(company_name, "Company")
    safe_full_name = _sanitize_filename_part(full_name, "User")
    return f"CV_{safe_job_title}_{safe_company}_{safe_full_name}.pdf"


def _humanity_threshold() -> int:
    raw = os.getenv("HUMANITY_SCORE_BLOCK_THRESHOLD", "70")
    try:
        return max(0, min(100, int(raw)))
    except (TypeError, ValueError):
        return 70


def _evaluate_humanity_for_nodes(
    nodes: Optional[list],
    source_text: str = "",
    mode: str = "quick",
    ai_settings: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    markdown_text = extract_full_cv_content_as_markdown(nodes or [])
    settings = ai_settings or {}
    report = ai_tailor_service.evaluate_humanity_hybrid(
        text=markdown_text,
        source_text=source_text or "",
        threshold=_humanity_threshold(),
        mode=mode,
        llm_enabled=bool(settings.get("humanity_deep_mode_enabled", DEFAULT_HUMANITY_DEEP_MODE_ENABLED)),
        llm_model=str(settings.get("humanity_llm_model", DEFAULT_HUMANITY_LLM_MODEL)),
        llm_reasoning_effort=str(settings.get("humanity_llm_reasoning_effort", DEFAULT_HUMANITY_LLM_REASONING))
    )
    report["character_count"] = len(markdown_text)
    return report


def _humanity_nodes_fingerprint(nodes: Optional[list]) -> str:
    serialized = json.dumps(nodes or [], sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _pack_humanity_cache(report: Dict[str, Any], nodes: Optional[list], mode: str) -> Dict[str, Any]:
    return {
        "report": report,
        "nodes_fingerprint": _humanity_nodes_fingerprint(nodes),
        "mode": mode,
        "updated_at": datetime.utcnow().isoformat()
    }


def _get_cached_humanity_report(tailored_cv: TailoredCV, nodes: Optional[list]) -> Optional[Dict[str, Any]]:
    cache = getattr(tailored_cv, "latest_humanity_report", None)
    if not isinstance(cache, dict):
        return None

    # Backward compatibility if report was previously stored without wrapper metadata.
    if "report" not in cache and "score" in cache and "risk_level" in cache:
        return cache

    cached_report = cache.get("report")
    cached_fingerprint = cache.get("nodes_fingerprint")
    if not isinstance(cached_report, dict) or not isinstance(cached_fingerprint, str):
        return None

    if cached_fingerprint != _humanity_nodes_fingerprint(nodes):
        return None
    return cached_report


def _raise_if_humanity_blocked(report: Dict[str, Any], force_export: bool = False):
    if report.get("requires_confirmation") and not force_export:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Humanity guard requires confirmation before export.",
                "requires_confirmation": True,
                "humanity": report
            }
        )


QUALITY_WEAK_OPENERS = (
    "responsible for",
    "worked on",
    "involved in",
    "helped with",
    "assisted with",
)

QUALITY_BUZZWORDS = (
    "results-driven",
    "dynamic professional",
    "proven track record",
    "cutting-edge",
    "synergy",
    "innovative solutions",
    "passionate about",
    "thought leader",
    "highly motivated",
)

QUALITY_AI_TEMPLATE_PHRASES = (
    "to drive",
    "to deliver",
    "to enhance",
    "to optimize",
    "to improve outcomes",
    "cross-functional teams",
    "fast-paced environment",
    "end-to-end",
    "strategic impact",
    "transformative",
    "industry-leading",
    "best-in-class",
)

QUALITY_SPECIFICITY_HINTS = (
    "using", "with", "via", "through", "across", "for", "to", "by", "in",
    "python", "sql", "aws", "gcp", "azure", "spark", "airflow", "kubernetes",
    "product", "platform", "pipeline", "model", "service"
)

QUALITY_METRIC_CONTEXT_HINTS = (
    "%", "percent", "kpi", "latency", "revenue", "cost", "users", "requests",
    "transactions", "months", "years", "days", "sla", "uptime", "throughput"
)

QUALITY_STOP_OPENERS = {"the", "a", "an", "and", "with", "for", "to", "in", "on", "at"}

QUALITY_ACTION_VERBS = {
    "built", "designed", "implemented", "developed", "shipped", "delivered",
    "launched", "migrated", "automated", "deployed", "configured", "integrated",
    "optimized", "debugged", "refactored", "analyzed", "modeled", "trained",
    "validated", "orchestrated", "led", "managed", "owned", "defined", "improved",
    "reduced", "increased", "scaled", "supported", "mentored", "collaborated",
    "created", "established", "resolved", "instrumented"
}

QUALITY_VARIANT_FRIENDLY_PATH_HINTS = (
    "summary",
    "profile",
    "overview",
    "objective",
    "about",
    "headline"
)

QUALITY_BASE_VOCAB = {
    "i", "we", "you", "they", "he", "she", "my", "our", "their", "the", "a", "an",
    "and", "or", "but", "for", "to", "with", "without", "across", "through", "via",
    "in", "on", "at", "from", "into", "during", "while", "before", "after", "over",
    "under", "within", "between", "as", "is", "are", "was", "were", "be", "been",
    "this", "that", "these", "those", "it", "its", "who", "which",
    "team", "teams", "project", "projects", "product", "products", "platform", "platforms",
    "service", "services", "system", "systems", "application", "applications", "feature", "features",
    "data", "dataset", "datasets", "model", "models", "pipeline", "pipelines", "workflow", "workflows",
    "analysis", "analytics", "report", "reports", "customer", "customers", "client", "clients",
    "user", "users", "stakeholder", "stakeholders", "roadmap", "delivery", "quality",
    "performance", "latency", "throughput", "availability", "uptime", "cost", "revenue",
    "testing", "monitoring", "automation", "deployment", "integration", "migration",
    "python", "sql", "aws", "gcp", "azure", "spark", "airflow", "kubernetes", "docker",
    "terraform", "pytorch", "tensorflow", "pandas", "numpy", "scikit", "fastapi",
    "api", "apis", "backend", "frontend", "ml", "llm", "nlp", "etl", "ci", "cd"
}

QUALITY_SEVERITY_WEIGHT = {
    "low": 6,
    "medium": 12,
    "high": 20,
    "critical": 35
}


def _quality_truncate(text: str, max_len: int = 160) -> str:
    value = (text or "").strip()
    if len(value) <= max_len:
        return value
    return value[: max_len - 3].rstrip() + "..."


def _quality_find_phrase_hits(lower_text: str, phrases: tuple, limit: int = 6) -> List[str]:
    hits: List[str] = []
    for phrase in phrases:
        if phrase in lower_text:
            hits.append(phrase)
            if len(hits) >= limit:
                break
    return hits


def _quality_path_is_variant_friendly(path: str) -> bool:
    lower_path = (path or "").lower()
    return any(hint in lower_path for hint in QUALITY_VARIANT_FRIENDLY_PATH_HINTS)


def _quality_contains_action_verb(words: List[str]) -> bool:
    return any(word in QUALITY_ACTION_VERBS for word in words[:6])


def _quality_metric_has_unit_context(text: str) -> bool:
    return bool(re.search(
        r"\b\d+(?:\.\d+)?\s*(%|ms|s|sec|seconds?|minutes?|hours?|days?|weeks?|months?|years?|"
        r"k|m|b|users?|requests?|transactions?|records?|pipelines?|models?|projects?|"
        r"teams?|engineers?|clients?|customers?|usd|\$|€)\b",
        text.lower()
    ))


def _quality_repeated_ngram_ratio(words: List[str], n: int = 3) -> float:
    if len(words) < n * 2:
        return 0.0
    ngrams = [" ".join(words[idx: idx + n]) for idx in range(0, len(words) - n + 1)]
    if not ngrams:
        return 0.0
    counts = Counter(ngrams)
    repeated = sum(count for count in counts.values() if count > 1)
    return repeated / len(ngrams)


def _quality_is_suspicious_token(token: str) -> bool:
    if not token:
        return False
    t = token.lower().strip()
    if len(t) <= 3:
        return False
    if re.search(r"(.)\1\1", t):
        return True
    if re.search(r"[bcdfghjklmnpqrstvwxyz]{5,}", t):
        return True
    vowel_count = sum(1 for ch in t if ch in "aeiou")
    if vowel_count == 0:
        return True
    vowel_ratio = vowel_count / len(t)
    if len(t) >= 5 and (vowel_ratio < 0.2 or vowel_ratio > 0.88):
        return True
    return False


def _quality_known_token_ratio(words: List[str]) -> float:
    if not words:
        return 0.0
    known_tokens = QUALITY_BASE_VOCAB.union(QUALITY_ACTION_VERBS).union(set(QUALITY_SPECIFICITY_HINTS))
    known_count = sum(1 for word in words if word in known_tokens)
    return known_count / len(words)


def _quality_normalize_key(text: str) -> str:
    normalized = re.sub(r"[^a-z0-9\s]", " ", (text or "").lower())
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def _quality_tokenize(text: str) -> List[str]:
    return re.findall(r"[a-zA-Z][a-zA-Z0-9\-']*", (text or "").lower())


def _quality_sentence_split(text: str) -> List[str]:
    parts = re.split(r"(?<=[.!?;])\s+|\n+", text or "")
    return [part.strip() for part in parts if part and part.strip()]


def _quality_extract_node_text(node: Dict[str, Any]) -> str:
    node_type = (node.get("node_type") or "").lower()
    content = (node.get("content") or "").strip()
    title = (node.get("title") or "").strip()

    if node_type == "section":
        return ""
    if content:
        return content
    if node_type in {"entry", "item", "custom"} and title:
        return title
    return ""


def _serialize_profile_node_for_quality(node: ProfileNode) -> Dict[str, Any]:
    children = sorted(list(node.children or []), key=lambda c: c.order or 0)
    return {
        "id": node.id,
        "parent_id": node.parent_id,
        "level": node.level,
        "node_type": node.node_type,
        "title": node.title,
        "subtitle": node.subtitle,
        "content": node.content,
        "children": [_serialize_profile_node_for_quality(child) for child in children]
    }


def _flatten_profile_nodes_for_quality(nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    flat: List[Dict[str, Any]] = []

    def walk(current_nodes: List[Dict[str, Any]], path_titles: List[str]):
        for node in current_nodes:
            node_type = node.get("node_type") or ""
            title = (node.get("title") or "").strip()
            label = title or node_type or "node"
            current_path = path_titles + [label]
            text_value = _quality_extract_node_text(node)
            flat.append({
                "id": node.get("id"),
                "parent_id": node.get("parent_id"),
                "level": int(node.get("level") or 0),
                "node_type": node_type,
                "title": title,
                "text": text_value,
                "path": " > ".join([part for part in current_path if part]),
            })
            walk(node.get("children") or [], current_path)

    walk(nodes or [], [])
    return flat


def _quality_add_violation(report: Dict[str, Any], violation: Dict[str, Any]):
    existing = report.get("violations", [])
    key = (
        str(violation.get("type", "")).lower(),
        str(violation.get("message", "")).strip().lower()
    )
    for item in existing:
        current_key = (
            str(item.get("type", "")).lower(),
            str(item.get("message", "")).strip().lower()
        )
        if key == current_key:
            return
    report.setdefault("violations", []).append(violation)


def _quality_finalize_node_report(report: Dict[str, Any]) -> Dict[str, Any]:
    violations = report.get("violations", [])
    critical_count = 0
    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    violation_types: List[str] = []
    for violation in violations:
        severity = str(violation.get("severity", "medium")).lower()
        if severity not in severity_counts:
            severity = "medium"
        severity_counts[severity] += 1
        violation_types.append(str(violation.get("type", "")).strip().lower())
        if severity == "critical":
            critical_count += 1

    # Diminishing penalty for many low-severity warnings to avoid over-punishing noisy text.
    low_count = severity_counts["low"]
    risk_points = (
        severity_counts["critical"] * QUALITY_SEVERITY_WEIGHT["critical"]
        + severity_counts["high"] * QUALITY_SEVERITY_WEIGHT["high"]
        + severity_counts["medium"] * QUALITY_SEVERITY_WEIGHT["medium"]
        + min(low_count, 2) * QUALITY_SEVERITY_WEIGHT["low"]
        + max(0, low_count - 2) * 3
    )

    # Combined "AI voice" pattern deserves stronger penalty.
    ai_voice_combo = {"weak_openers", "buzzword_density", "ai_template_pattern", "low_specificity"}
    combo_hits = len(ai_voice_combo.intersection(set(violation_types)))
    if combo_hits >= 3:
        risk_points += 8
    elif combo_hits == 2:
        risk_points += 4

    # Safety caps by severity class so score stays interpretable.
    if severity_counts["critical"] == 0 and severity_counts["high"] == 0:
        risk_points = min(risk_points, 45)
    elif severity_counts["critical"] == 0:
        risk_points = min(risk_points, 70)

    score = max(0, 100 - int(round(risk_points)))
    if critical_count > 0 or score < 70:
        risk_level = "high"
    elif score < 85:
        risk_level = "medium"
    else:
        risk_level = "low"

    report["score"] = int(score)
    report["risk_level"] = risk_level
    report["critical_violations"] = critical_count
    report["total_violations"] = len(violations)
    report["severity_counts"] = severity_counts
    report["score_components"] = {
        "deduction_points": int(round(risk_points)),
        "combo_penalty_applied": combo_hits >= 2
    }
    return report


def _build_profile_pool_quality_report(profile_tree_nodes: List[Dict[str, Any]]) -> Dict[str, Any]:
    flat_nodes = _flatten_profile_nodes_for_quality(profile_tree_nodes)
    indexed_nodes = {node["id"]: node for node in flat_nodes if node.get("id") is not None}
    node_reports: Dict[int, Dict[str, Any]] = {}

    for node in flat_nodes:
        node_id = node.get("id")
        text_value = (node.get("text") or "").strip()
        if node_id is None or not text_value:
            continue

        lower_text = text_value.lower()
        words = _quality_tokenize(text_value)
        sentences = _quality_sentence_split(text_value)
        is_variant_friendly = _quality_path_is_variant_friendly(str(node.get("path") or ""))
        node_reports[node_id] = {
            "node_id": node_id,
            "node_type": node.get("node_type"),
            "path": node.get("path"),
            "violations": []
        }
        report = node_reports[node_id]

        for opener in QUALITY_WEAK_OPENERS:
            if lower_text.startswith(opener):
                _quality_add_violation(report, {
                    "type": "weak_openers",
                    "severity": "medium" if len(words) >= 8 else "low",
                    "message": "Starts with a weak/generic opener.",
                    "where": [f"Line: {_quality_truncate(text_value)}"],
                    "how_to_fix": [
                        "Start with a specific action verb and concrete scope.",
                        "Use outcome-oriented wording instead of generic opener phrases."
                    ]
                })
                break

        buzz_hits = _quality_find_phrase_hits(lower_text, QUALITY_BUZZWORDS, limit=8)
        if buzz_hits:
            buzz_density = len(buzz_hits) / max(len(words), 1)
            if len(buzz_hits) >= 4 or buzz_density >= 0.10:
                buzz_severity = "high"
            elif len(buzz_hits) >= 2:
                buzz_severity = "medium"
            else:
                buzz_severity = "low"
            _quality_add_violation(report, {
                "type": "buzzword_density",
                "severity": buzz_severity,
                "message": "Contains generic buzzword-heavy language.",
                "where": [f"Phrases: {', '.join(buzz_hits[:4])}"],
                "how_to_fix": [
                    "Replace buzzwords with concrete responsibilities and outcomes.",
                    "Keep wording factual and role-specific."
                ]
            })

        template_hits = _quality_find_phrase_hits(lower_text, QUALITY_AI_TEMPLATE_PHRASES, limit=8)
        if len(template_hits) >= 2:
            _quality_add_violation(report, {
                "type": "ai_template_pattern",
                "severity": "high" if len(template_hits) >= 4 else "medium",
                "message": "Uses formulaic AI-style phrasing patterns.",
                "where": [f"Patterns: {', '.join(template_hits[:4])}"],
                "how_to_fix": [
                    "Rewrite with direct, factual wording about what you actually did.",
                    "Remove template phrases and keep one clear idea per sentence."
                ]
            })

        has_metric = bool(re.search(r"\b\d+(?:\.\d+)?%?\b", text_value))
        has_specificity_hint = any(f" {hint} " in f" {lower_text} " for hint in QUALITY_SPECIFICITY_HINTS)
        has_action_verb = _quality_contains_action_verb(words)
        has_proper_noun = bool(re.search(r"\b[A-Z][a-zA-Z0-9+/#-]{2,}\b", text_value))
        specificity_signals = int(has_metric) + int(has_specificity_hint) + int(has_action_verb) + int(has_proper_noun)
        if (len(words) >= 8 and specificity_signals < 2) or (len(words) >= 5 and specificity_signals == 0):
            _quality_add_violation(report, {
                "type": "low_specificity",
                "severity": "medium" if len(words) >= 18 else "low",
                "message": "Statement is vague and lacks concrete scope/tool/context.",
                "where": [f"Line: {_quality_truncate(text_value)}"],
                "how_to_fix": [
                    "Add concrete context: tool, scope, or objective.",
                    "If available, add measurable outcome from your real experience."
                ]
            })

        opener_counter = Counter()
        for sentence in sentences:
            sentence_words = _quality_tokenize(sentence)
            if sentence_words:
                opener_counter[sentence_words[0]] += 1
        repeated_openers = [token for token, count in opener_counter.items() if count >= 2 and token not in QUALITY_STOP_OPENERS]
        if repeated_openers and len(sentences) >= 3:
            _quality_add_violation(report, {
                "type": "repetitive_sentence_openers",
                "severity": "medium" if len(repeated_openers) >= 2 else "low",
                "message": "Multiple sentences start with similar words.",
                "where": [f"Openers repeated: {', '.join(repeated_openers[:3])}"],
                "how_to_fix": [
                    "Vary sentence openings across bullets and lines.",
                    "Alternate action-first, context-first, and outcome-first constructions."
                ]
            })

        suspicious_tokens = [token for token in words if _quality_is_suspicious_token(token)]
        suspicious_ratio = (len(suspicious_tokens) / len(words)) if words else 0.0
        known_ratio = _quality_known_token_ratio(words)
        proper_noun_count = len(re.findall(r"\b[A-Z][a-zA-Z0-9+/#-]{2,}\b", text_value))
        if len(words) >= 4:
            if known_ratio < 0.15 and suspicious_ratio >= 0.34 and proper_noun_count == 0:
                _quality_add_violation(report, {
                    "type": "semantic_noise",
                    "severity": "high",
                    "message": "Text appears low-meaning or nonsensical.",
                    "where": [f"Tokens: {', '.join(suspicious_tokens[:4])}"],
                    "how_to_fix": [
                        "Rewrite with concrete, meaningful wording describing real work.",
                        "Use clear subject-action-context phrasing."
                    ]
                })
            elif known_ratio < 0.20 and suspicious_ratio >= 0.26 and proper_noun_count == 0 and len(words) >= 6:
                _quality_add_violation(report, {
                    "type": "semantic_noise",
                    "severity": "medium",
                    "message": "Text has weak semantic clarity and looks noisy.",
                    "where": [f"Tokens: {', '.join(suspicious_tokens[:4])}"],
                    "how_to_fix": [
                        "Replace unclear tokens with precise terms from your real experience.",
                        "Use an action verb and specific context."
                    ]
                })

        long_sentences = [sentence for sentence in sentences if len(_quality_tokenize(sentence)) >= 28]
        comma_dense = [sentence for sentence in sentences if sentence.count(",") >= 3]
        if long_sentences or comma_dense:
            longest_sentence_len = max((len(_quality_tokenize(sentence)) for sentence in long_sentences), default=0)
            comma_peak = max((sentence.count(",") for sentence in comma_dense), default=0)
            _quality_add_violation(report, {
                "type": "readability",
                "severity": "high" if longest_sentence_len >= 40 or comma_peak >= 5 else "medium",
                "message": "Contains long multi-clause phrasing that reduces readability.",
                "where": [_quality_truncate((long_sentences or comma_dense)[0])],
                "how_to_fix": [
                    "Split long sentence into 1-2 concise statements.",
                    "Remove stacked clauses and keep one idea per bullet."
                ]
            })

        ngram_ratio = _quality_repeated_ngram_ratio(words, n=3)
        if ngram_ratio >= 0.24 and len(words) >= 16:
            _quality_add_violation(report, {
                "type": "repetitive_structure",
                "severity": "medium" if ngram_ratio >= 0.35 else "low",
                "message": "Phrase structure repeats within the same statement.",
                "where": [f"Repeated phrase ratio: {round(ngram_ratio, 2)}"],
                "how_to_fix": [
                    "Reduce repeated phrase patterns.",
                    "Rewrite with simpler sentence structure."
                ]
            })

        numeric_tokens = re.findall(r"\b\d+(?:\.\d+)?%?\b", text_value)
        has_metric_context = any(hint in lower_text for hint in QUALITY_METRIC_CONTEXT_HINTS) or _quality_metric_has_unit_context(text_value)
        if numeric_tokens and not has_metric_context:
            _quality_add_violation(report, {
                "type": "factual_hygiene",
                "severity": "medium" if len(numeric_tokens) >= 2 else "low",
                "message": "Numeric claim lacks nearby context or unit.",
                "where": [f"Numeric values: {', '.join(numeric_tokens[:4])}"],
                "how_to_fix": [
                    "Add nearby context (what the number represents, over what scope/timeframe).",
                    "Ensure metric wording is clear and verifiable."
                ]
            })

        if is_variant_friendly and report.get("violations"):
            # Summary/profile variants are intentionally redundant in many workflows.
            # Keep detection but soften one level for non-critical warnings.
            for violation in report["violations"]:
                severity = str(violation.get("severity", "low")).lower()
                violation_type = str(violation.get("type", "")).strip().lower()
                if severity == "medium" and violation_type not in {"semantic_noise"}:
                    violation["severity"] = "low"

    global_issues = []
    text_nodes = [node for node in flat_nodes if (node.get("text") or "").strip()]
    node_path_map = {
        node.get("id"): str(node.get("path") or "")
        for node in text_nodes
        if node.get("id") is not None
    }
    variant_friendly_map = {
        node_id: _quality_path_is_variant_friendly(path)
        for node_id, path in node_path_map.items()
    }
    normalized_groups: Dict[str, List[int]] = defaultdict(list)
    for node in text_nodes:
        node_id = node.get("id")
        if node_id is None:
            continue
        normalized = _quality_normalize_key(node.get("text") or "")
        if len(normalized) >= 24:
            normalized_groups[normalized].append(node_id)

    for normalized, node_ids in normalized_groups.items():
        if len(node_ids) < 2:
            continue
        variant_friendly_all = all(variant_friendly_map.get(node_id, False) for node_id in node_ids)
        sample_text = _quality_truncate(normalized, max_len=130)
        cluster_severity = "low" if variant_friendly_all and len(node_ids) <= 4 else ("high" if len(node_ids) >= 5 else "medium")
        cluster_message = (
            "Similar summary/profile variants detected (often intentional)."
            if variant_friendly_all
            else "Near-identical statements found in multiple nodes."
        )
        global_issues.append({
            "type": "repetition_cluster",
            "severity": cluster_severity,
            "message": cluster_message,
            "node_ids": node_ids,
            "sample": sample_text,
            "how_to_fix": [
                "Keep one strongest version and remove/merge duplicates.",
                "Differentiate the remaining bullets by scope, method, or outcome."
            ]
        })
        # Do not penalize likely intentional summary/profile variants at node level.
        if variant_friendly_all and len(node_ids) <= 4:
            continue

        for node_id in node_ids:
            report = node_reports.setdefault(node_id, {
                "node_id": node_id,
                "node_type": indexed_nodes.get(node_id, {}).get("node_type"),
                "path": indexed_nodes.get(node_id, {}).get("path"),
                "violations": []
            })
            _quality_add_violation(report, {
                "type": "repetitive_structure",
                "severity": "low" if variant_friendly_map.get(node_id, False) else "medium",
                "message": "Very similar content appears in other nodes.",
                "where": [f"Similar cluster: {sample_text}"],
                "how_to_fix": [
                    "Consolidate duplicates into one concise bullet.",
                    "Use distinct evidence per bullet if multiple bullets remain."
                ]
            })

    token_sets: Dict[int, set] = {}
    candidate_ids: List[int] = []
    for node in text_nodes:
        node_id = node.get("id")
        if node_id is None:
            continue
        tokens = set(_quality_tokenize(node.get("text") or ""))
        if len(tokens) >= 8:
            token_sets[node_id] = tokens
            candidate_ids.append(node_id)

    near_pairs = []
    for idx, left_id in enumerate(candidate_ids):
        left_tokens = token_sets.get(left_id, set())
        for right_id in candidate_ids[idx + 1:]:
            right_tokens = token_sets.get(right_id, set())
            if not left_tokens or not right_tokens:
                continue
            intersection = len(left_tokens.intersection(right_tokens))
            union = len(left_tokens.union(right_tokens))
            if union == 0:
                continue
            similarity = intersection / union
            if similarity >= 0.82:
                near_pairs.append((left_id, right_id, similarity))

    for left_id, right_id, similarity in near_pairs[:30]:
        left_node = indexed_nodes.get(left_id, {})
        right_node = indexed_nodes.get(right_id, {})
        pair_variant_friendly = variant_friendly_map.get(left_id, False) and variant_friendly_map.get(right_id, False)
        message = "Multiple bullets share highly similar structure across the profile."
        global_issues.append({
            "type": "near_duplicate_pair",
            "severity": "low" if pair_variant_friendly else "medium",
            "message": "Similar summary variants detected." if pair_variant_friendly else message,
            "node_ids": [left_id, right_id],
            "sample": f"{_quality_truncate(left_node.get('text', ''), 75)} || {_quality_truncate(right_node.get('text', ''), 75)}",
            "similarity": round(similarity, 2),
            "how_to_fix": [
                "Rewrite one bullet to focus on a distinct contribution or outcome.",
                "Merge both bullets if they describe the same work."
            ]
        })
        if pair_variant_friendly:
            continue

        for current_id, other_node in ((left_id, right_node), (right_id, left_node)):
            report = node_reports.setdefault(current_id, {
                "node_id": current_id,
                "node_type": indexed_nodes.get(current_id, {}).get("node_type"),
                "path": indexed_nodes.get(current_id, {}).get("path"),
                "violations": []
            })
            other_path = other_node.get("path") or f"node-{other_node.get('id')}"
            _quality_add_violation(report, {
                "type": "repetitive_structure",
                "severity": "medium",
                "message": message,
                "where": [f"Similar to: {other_path}"],
                "how_to_fix": [
                    "Differentiate the bullets by scope, approach, or measured impact.",
                    "Remove one if both express the same achievement."
                ]
            })

    opener_groups: Dict[str, List[int]] = defaultdict(list)
    for node in text_nodes:
        node_id = node.get("id")
        if node_id is None:
            continue
        tokens = _quality_tokenize(node.get("text") or "")
        if not tokens:
            continue
        opener = tokens[0]
        if len(opener) < 4 or opener in QUALITY_STOP_OPENERS:
            continue
        opener_groups[opener].append(node_id)

    repeated_openers = {token: ids for token, ids in opener_groups.items() if len(ids) >= 3}
    for opener, ids in repeated_openers.items():
        variant_friendly_all = all(variant_friendly_map.get(node_id, False) for node_id in ids)
        issue_severity = "low" if variant_friendly_all else ("medium" if len(ids) >= 6 else "low")
        global_issues.append({
            "type": "repetitive_sentence_openers",
            "severity": issue_severity,
            "message": f"Many nodes start with '{opener}'.",
            "node_ids": ids[:10],
            "how_to_fix": [
                "Vary opener verbs to avoid repetitive tone.",
                "Use mixed sentence patterns across bullets."
            ]
        })
        if variant_friendly_all:
            continue

        for node_id in ids:
            report = node_reports.setdefault(node_id, {
                "node_id": node_id,
                "node_type": indexed_nodes.get(node_id, {}).get("node_type"),
                "path": indexed_nodes.get(node_id, {}).get("path"),
                "violations": []
            })
            _quality_add_violation(report, {
                "type": "repetitive_sentence_openers",
                "severity": "low",
                "message": "Opening verb pattern repeats across the profile.",
                "where": [f"Repeated opener: {opener}"],
                "how_to_fix": [
                    "Use different action verbs to diversify tone.",
                    "Reorder sentence structure to avoid repeated starts."
                ]
            })

    # Finalize content node reports
    for node_id, report in list(node_reports.items()):
        node_reports[node_id] = _quality_finalize_node_report(report)

    # Aggregate score/risk for structural nodes based on direct children
    direct_children_map: Dict[int, List[int]] = defaultdict(list)
    for node in flat_nodes:
        node_id = node.get("id")
        parent_id = node.get("parent_id")
        if node_id is not None and parent_id is not None:
            direct_children_map[parent_id].append(node_id)

    sorted_by_level = sorted(flat_nodes, key=lambda n: n.get("level", 0), reverse=True)
    for node in sorted_by_level:
        node_id = node.get("id")
        if node_id is None or node_id in node_reports:
            continue
        child_reports = [node_reports.get(child_id) for child_id in direct_children_map.get(node_id, [])]
        child_reports = [item for item in child_reports if isinstance(item, dict)]
        if not child_reports:
            continue
        avg_score = round(sum(item.get("score", 0) for item in child_reports) / len(child_reports))
        total_violations = sum(item.get("total_violations", 0) for item in child_reports)
        critical_count = sum(item.get("critical_violations", 0) for item in child_reports)
        if critical_count > 0 or avg_score < 70:
            risk_level = "high"
        elif avg_score < 85:
            risk_level = "medium"
        else:
            risk_level = "low"
        node_reports[node_id] = {
            "node_id": node_id,
            "node_type": node.get("node_type"),
            "path": node.get("path"),
            "score": int(avg_score),
            "risk_level": risk_level,
            "critical_violations": int(critical_count),
            "total_violations": int(total_violations),
            "severity_counts": {"critical": critical_count, "high": 0, "medium": 0, "low": 0},
            "violations": [],
            "aggregated_from_children": True
        }

    scored_reports = [item for item in node_reports.values() if not item.get("aggregated_from_children")]
    reports_for_overall = scored_reports or list(node_reports.values())

    if reports_for_overall:
        overall_score = round(sum(item.get("score", 0) for item in reports_for_overall) / len(reports_for_overall))
    else:
        overall_score = 100

    critical_total = sum(item.get("critical_violations", 0) for item in reports_for_overall)
    if critical_total > 0 or overall_score < 70:
        overall_risk = "high"
    elif overall_score < 85:
        overall_risk = "medium"
    else:
        overall_risk = "low"

    severity_totals = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for report in reports_for_overall:
        counts = report.get("severity_counts", {})
        for key in severity_totals:
            severity_totals[key] += int(counts.get(key, 0))

    return {
        "overall_score": int(overall_score),
        "overall_risk": overall_risk,
        "total_nodes_checked": len(reports_for_overall),
        "severity_totals": severity_totals,
        "global_issues": global_issues[:20],
        "node_reports": {str(node_id): report for node_id, report in node_reports.items()},
        "updated_at": datetime.utcnow().isoformat()
    }


def _serialize_profile_node_for_ai_context(node: ProfileNode) -> Dict[str, Any]:
    """Serialize profile node tree for profile-pool AI-fix context prompts."""
    children = sorted(list(node.children or []), key=lambda c: c.order or 0)
    return {
        "id": node.id,
        "node_type": node.node_type,
        "title": node.title,
        "subtitle": node.subtitle,
        "content": node.content,
        "start_date": node.start_date,
        "end_date": node.end_date,
        "location": node.location,
        "children": [_serialize_profile_node_for_ai_context(child) for child in children]
    }


def _extract_fixable_text_from_node(node: ProfileNode) -> tuple[str, str]:
    """
    Return tuple: (editable_field_name, editable_text).
    We prioritize content. If content is empty, allow entry/item/custom title edits.
    """
    content_value = (node.content or "").strip()
    if content_value:
        return "content", content_value

    title_value = (node.title or "").strip()
    if (node.node_type or "").lower() in {"entry", "item", "custom"} and title_value:
        return "title", title_value

    return "", ""


def _resolve_quality_issue_for_node(
    quality_report: Dict[str, Any],
    node_id: int,
    request_issue: Optional[Dict[str, Any]] = None
) -> Optional[Dict[str, Any]]:
    """Resolve a node-level issue from quality report, preferring requested issue type."""
    node_reports = (quality_report or {}).get("node_reports") or {}
    node_report = node_reports.get(str(node_id)) or node_reports.get(node_id) or {}
    violations = node_report.get("violations") if isinstance(node_report, dict) else []
    if not isinstance(violations, list) or not violations:
        return None

    requested_type = str((request_issue or {}).get("type", "")).strip().lower()
    requested_message = str((request_issue or {}).get("message", "")).strip().lower()

    if requested_type or requested_message:
        for issue in violations:
            issue_type = str(issue.get("type", "")).strip().lower()
            issue_message = str(issue.get("message", "")).strip().lower()
            if requested_type and issue_type == requested_type:
                return issue
            if requested_message and issue_message == requested_message:
                return issue

    return violations[0]

# ============================================================================
# DATABASE & SECURITY SETUP
# ============================================================================

# Database
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not found in environment")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# AI model settings defaults (used to initialize user settings and as safety fallback)
VALID_OPENAI_MODELS = {"gpt-4o", "gpt-5.1"}
VALID_REASONING_EFFORT = {"none", "low", "medium", "high"}
DEFAULT_OPENAI_MODEL = os.getenv("OPENAI_MODEL_VERSION", "gpt-4o")
if DEFAULT_OPENAI_MODEL not in VALID_OPENAI_MODELS:
    DEFAULT_OPENAI_MODEL = "gpt-4o"

DEFAULT_OPENAI_REASONING = os.getenv("OPENAI_REASONING_EFFORT", "medium").lower()
if DEFAULT_OPENAI_REASONING not in VALID_REASONING_EFFORT:
    DEFAULT_OPENAI_REASONING = "medium"

DEFAULT_CLAUDE_MODEL = os.getenv("CLAUDE_MODEL_VERSION", "claude-sonnet-4-20250514")
DEFAULT_HUMANITY_DEEP_MODE_ENABLED = os.getenv("HUMANITY_DEEP_MODE_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
DEFAULT_HUMANITY_LLM_MODEL = os.getenv("HUMANITY_LLM_MODEL", "gpt-4o")
if DEFAULT_HUMANITY_LLM_MODEL not in VALID_OPENAI_MODELS:
    DEFAULT_HUMANITY_LLM_MODEL = "gpt-4o"
DEFAULT_HUMANITY_LLM_REASONING = os.getenv("HUMANITY_LLM_REASONING_EFFORT", "low").lower()
if DEFAULT_HUMANITY_LLM_REASONING not in VALID_REASONING_EFFORT:
    DEFAULT_HUMANITY_LLM_REASONING = "low"


def _normalize_openai_model(model: Optional[str]) -> str:
    value = (model or "").strip()
    if value in VALID_OPENAI_MODELS:
        return value
    return DEFAULT_OPENAI_MODEL


def _normalize_reasoning_effort(effort: Optional[str]) -> str:
    value = (effort or "").strip().lower()
    if value in VALID_REASONING_EFFORT:
        return value
    return DEFAULT_OPENAI_REASONING


def _normalize_claude_model(model: Optional[str]) -> str:
    value = (model or "").strip()
    if value and value.startswith("claude-"):
        return value
    return DEFAULT_CLAUDE_MODEL


def _normalize_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return bool(value)
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "on"}:
        return True
    if text in {"0", "false", "no", "off"}:
        return False
    return default


def _normalize_humanity_llm_model(model: Optional[str]) -> str:
    value = (model or "").strip()
    if value in VALID_OPENAI_MODELS:
        return value
    return DEFAULT_HUMANITY_LLM_MODEL


def _normalize_humanity_reasoning_effort(effort: Optional[str]) -> str:
    value = (effort or "").strip().lower()
    if value in VALID_REASONING_EFFORT:
        return value
    return DEFAULT_HUMANITY_LLM_REASONING


def _normalize_instruction_templates(templates: Optional[list]) -> List[Dict[str, str]]:
    if not isinstance(templates, list):
        return []

    cleaned: List[Dict[str, str]] = []
    for idx, item in enumerate(templates):
        label_value = ""
        instruction_value = ""

        # Backward compatibility: old payload may be a plain string
        if isinstance(item, str):
            instruction_value = item.strip()
            label_value = f"My Template {idx + 1}"
        elif isinstance(item, dict):
            label_value = str(item.get("label", "")).strip()
            instruction_value = str(item.get("instruction", "")).strip()
        else:
            continue

        if not instruction_value:
            continue
        if not label_value:
            label_value = f"My Template {len(cleaned) + 1}"

        cleaned.append({
            "label": label_value[:40],
            "instruction": instruction_value[:400]
        })
        if len(cleaned) >= 12:
            break
    return cleaned


def get_user_ai_settings(user: User) -> Dict[str, Any]:
    """Return sanitized per-user AI settings."""
    return {
        "openai_model": _normalize_openai_model(getattr(user, "openai_model", None)),
        "openai_reasoning_effort": _normalize_reasoning_effort(getattr(user, "openai_reasoning_effort", None)),
        "claude_model": _normalize_claude_model(getattr(user, "claude_model", None)),
        "humanity_deep_mode_enabled": _normalize_bool(
            getattr(user, "humanity_deep_mode_enabled", None),
            DEFAULT_HUMANITY_DEEP_MODE_ENABLED
        ),
        "humanity_llm_model": _normalize_humanity_llm_model(getattr(user, "humanity_llm_model", None)),
        "humanity_llm_reasoning_effort": _normalize_humanity_reasoning_effort(
            getattr(user, "humanity_llm_reasoning_effort", None)
        ),
        "refinement_instruction_templates": _normalize_instruction_templates(
            getattr(user, "refinement_instruction_templates", None)
        ),
    }


def _ensure_user_ai_settings_columns():
    """Best-effort schema bootstrap so local/prod both have AI settings columns."""
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS openai_model VARCHAR(50)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS openai_reasoning_effort VARCHAR(20)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS claude_model VARCHAR(80)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS humanity_deep_mode_enabled BOOLEAN"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS humanity_llm_model VARCHAR(50)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS humanity_llm_reasoning_effort VARCHAR(20)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS refinement_instruction_templates JSON"))
        conn.execute(
            text(
                "UPDATE users SET openai_model = :model "
                "WHERE openai_model IS NULL OR TRIM(openai_model) = ''"
            ),
            {"model": DEFAULT_OPENAI_MODEL},
        )
        conn.execute(
            text(
                "UPDATE users SET openai_reasoning_effort = :effort "
                "WHERE openai_reasoning_effort IS NULL OR TRIM(openai_reasoning_effort) = ''"
            ),
            {"effort": DEFAULT_OPENAI_REASONING},
        )
        conn.execute(
            text(
                "UPDATE users SET claude_model = :model "
                "WHERE claude_model IS NULL OR TRIM(claude_model) = ''"
            ),
            {"model": DEFAULT_CLAUDE_MODEL},
        )
        conn.execute(
            text(
                "UPDATE users SET humanity_deep_mode_enabled = :enabled "
                "WHERE humanity_deep_mode_enabled IS NULL"
            ),
            {"enabled": DEFAULT_HUMANITY_DEEP_MODE_ENABLED},
        )
        conn.execute(
            text(
                "UPDATE users SET humanity_llm_model = :model "
                "WHERE humanity_llm_model IS NULL OR TRIM(humanity_llm_model) = ''"
            ),
            {"model": DEFAULT_HUMANITY_LLM_MODEL},
        )
        conn.execute(
            text(
                "UPDATE users SET humanity_llm_reasoning_effort = :effort "
                "WHERE humanity_llm_reasoning_effort IS NULL OR TRIM(humanity_llm_reasoning_effort) = ''"
            ),
            {"effort": DEFAULT_HUMANITY_LLM_REASONING},
        )
        conn.execute(
            text(
                "UPDATE users SET refinement_instruction_templates = '[]' "
                "WHERE refinement_instruction_templates IS NULL"
            )
        )


_ensure_user_ai_settings_columns()


def _ensure_tailored_cv_runtime_columns():
    """Best-effort schema bootstrap for Tailored CV runtime metadata columns."""
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE tailored_cvs ADD COLUMN IF NOT EXISTS latest_humanity_report JSON"))


_ensure_tailored_cv_runtime_columns()

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours to prevent interruptions during active work

security = HTTPBearer()

app = FastAPI(title="Work Profile API - Hierarchical v3.0")

# Initialize logger for API endpoints
api_logger = get_logger("API")

# CORS - Allow frontend origins from environment variable
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


# ============================================================================
# Dependencies
# ============================================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = int(user_id_str)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user


# ============================================================================
# Auth Endpoints
# ============================================================================

@app.post("/api/register", response_model=UserResponse)
@app.post("/auth/register", response_model=UserResponse)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register new user"""
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=pwd_context.hash(user_data.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create default profile
    profile = Profile(user_id=user.id, title="My Profile", is_default=True)
    db.add(profile)
    db.commit()

    return user


@app.post("/api/login", response_model=Token)
@app.post("/auth/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Login user"""
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not pwd_context.verify(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/api/refresh-token", response_model=Token)
def refresh_token(current_user: User = Depends(get_current_user)):
    """Refresh access token - extends the session for active users"""
    access_token = create_access_token(data={"sub": str(current_user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/me", response_model=UserResponse)
@app.get("/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current user"""
    return current_user


# ============================================================================
# User Profile Info Endpoints (Personal Details Page)
# ============================================================================

@app.get("/api/user/profile-info", response_model=UserProfileInfo)
def get_user_profile_info(
    current_user: User = Depends(get_current_user)
):
    """Get user's personal profile information"""
    return current_user


@app.put("/api/user/profile-info", response_model=UserProfileInfo)
def update_user_profile_info(
    profile_data: UserProfileInfoUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user's personal profile information"""
    # Update only provided fields
    update_data = profile_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)

    return current_user


@app.get("/api/user/ai-settings", response_model=UserAISettings)
def get_user_ai_settings_endpoint(
    current_user: User = Depends(get_current_user)
):
    """Get current user's AI model settings."""
    return get_user_ai_settings(current_user)


@app.put("/api/user/ai-settings", response_model=UserAISettings)
def update_user_ai_settings_endpoint(
    settings_data: UserAISettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's AI model settings used by Tailor CV."""
    updates = settings_data.model_dump(exclude_unset=True)

    if "openai_model" in updates:
        current_user.openai_model = _normalize_openai_model(updates.get("openai_model"))
    if "openai_reasoning_effort" in updates:
        current_user.openai_reasoning_effort = _normalize_reasoning_effort(updates.get("openai_reasoning_effort"))
    if "claude_model" in updates:
        current_user.claude_model = _normalize_claude_model(updates.get("claude_model"))
    if "humanity_deep_mode_enabled" in updates:
        current_user.humanity_deep_mode_enabled = _normalize_bool(
            updates.get("humanity_deep_mode_enabled"),
            DEFAULT_HUMANITY_DEEP_MODE_ENABLED
        )
    if "humanity_llm_model" in updates:
        current_user.humanity_llm_model = _normalize_humanity_llm_model(updates.get("humanity_llm_model"))
    if "humanity_llm_reasoning_effort" in updates:
        current_user.humanity_llm_reasoning_effort = _normalize_humanity_reasoning_effort(
            updates.get("humanity_llm_reasoning_effort")
        )
    if "refinement_instruction_templates" in updates:
        current_user.refinement_instruction_templates = _normalize_instruction_templates(
            updates.get("refinement_instruction_templates")
        )

    db.commit()
    db.refresh(current_user)

    return get_user_ai_settings(current_user)


# ============================================================================
# Profile Endpoints
# ============================================================================

@app.get("/profiles", response_model=List[ProfileResponse])
def get_profiles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all profiles for current user"""
    profiles = db.query(Profile).filter(Profile.user_id == current_user.id).all()
    # Only return root nodes, sorted by order
    for profile in profiles:
        profile.nodes = sorted([n for n in profile.nodes if n.parent_id is None], key=lambda x: x.order)
    return profiles


@app.get("/profiles/{profile_id}", response_model=ProfileResponse)
def get_profile(
    profile_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific profile with all nodes"""
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Only return root nodes (children loaded via relationship)
    # Sort by order to ensure correct display
    profile.nodes = sorted([n for n in profile.nodes if n.parent_id is None], key=lambda x: x.order)
    return profile


@app.get("/profiles/{profile_id}/quality")
def get_profile_pool_quality(
    profile_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Run profile-pool quality checks (node-level + cross-profile) without changing hierarchy."""
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    root_nodes = sorted([n for n in profile.nodes if n.parent_id is None], key=lambda x: x.order or 0)
    serialized_nodes = [_serialize_profile_node_for_quality(node) for node in root_nodes]
    quality = _build_profile_pool_quality_report(serialized_nodes)
    return {
        "success": True,
        "profile_id": profile_id,
        "quality": quality
    }


@app.post("/profiles/{profile_id}/quality/ai-fix-preview")
def preview_profile_pool_ai_fix(
    profile_id: int,
    request_data: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate AI fix suggestion for one profile-pool node issue.
    This endpoint is non-destructive (preview only).
    """
    node_id_raw = request_data.get("node_id")
    try:
        node_id = int(node_id_raw)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="node_id is required")

    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    node = db.query(ProfileNode).filter(
        ProfileNode.id == node_id,
        ProfileNode.profile_id == profile_id
    ).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found in this profile")

    editable_field, original_text = _extract_fixable_text_from_node(node)
    if not editable_field or not original_text:
        raise HTTPException(
            status_code=400,
            detail="Node has no fixable text. Add text content first."
        )

    root_nodes = sorted([n for n in profile.nodes if n.parent_id is None], key=lambda x: x.order or 0)
    serialized_nodes = [_serialize_profile_node_for_quality(root) for root in root_nodes]
    quality_report = _build_profile_pool_quality_report(serialized_nodes)

    issue = _resolve_quality_issue_for_node(
        quality_report=quality_report,
        node_id=node_id,
        request_issue=request_data.get("issue")
    )
    if not issue:
        raise HTTPException(
            status_code=400,
            detail="No node-level quality issue found for this node."
        )

    node_report = (quality_report.get("node_reports") or {}).get(str(node_id), {})
    node_path = str(node_report.get("path") or f"node-{node_id}")
    context_nodes = [_serialize_profile_node_for_ai_context(root) for root in root_nodes]
    profile_context = ai_tailor_service.profile_nodes_to_text(context_nodes)
    ai_settings = get_user_ai_settings(current_user)

    result = ai_tailor_service.generate_profile_pool_node_fix_with_openai(
        node_text=original_text,
        node_type=str(node.node_type or ""),
        node_path=node_path,
        issue=issue,
        profile_context=profile_context,
        user_instructions=str(request_data.get("user_instructions", "")).strip() or None,
        model=ai_settings["openai_model"],
        reasoning_effort=ai_settings["openai_reasoning_effort"],
        humanity_llm_enabled=ai_settings["humanity_deep_mode_enabled"],
        humanity_llm_model=ai_settings["humanity_llm_model"],
        humanity_llm_reasoning_effort=ai_settings["humanity_llm_reasoning_effort"]
    )
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "AI fix preview failed"))

    return {
        "success": True,
        "profile_id": profile_id,
        "node_id": node_id,
        "target_field": editable_field,
        "node_path": node_path,
        "issue": issue,
        "original_text": original_text,
        "revised_text": result.get("revised_text", ""),
        "change_summary": result.get("change_summary", ""),
        "confidence": result.get("confidence"),
        "humanity": result.get("humanity"),
        "runtime": {
            "requested_model": result.get("requested_model", result.get("model")),
            "actual_model": result.get("actual_model", result.get("model")),
            "api_name": result.get("api_name"),
            "reasoning_tokens": result.get("reasoning_tokens")
        }
    }


@app.post("/profiles/{profile_id}/quality/ai-fix-apply")
def apply_profile_pool_ai_fix(
    profile_id: int,
    request_data: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Apply edited AI suggestion to a single profile node text field."""
    node_id_raw = request_data.get("node_id")
    revised_text = str(request_data.get("revised_text", "")).strip()
    if not revised_text:
        raise HTTPException(status_code=400, detail="revised_text is required")
    try:
        node_id = int(node_id_raw)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="node_id is required")

    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    node = db.query(ProfileNode).filter(
        ProfileNode.id == node_id,
        ProfileNode.profile_id == profile_id
    ).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found in this profile")

    editable_field, original_text = _extract_fixable_text_from_node(node)
    if not editable_field:
        raise HTTPException(
            status_code=400,
            detail="Node has no editable text field for this AI fix."
        )

    setattr(node, editable_field, revised_text)

    issue_payload = request_data.get("issue") if isinstance(request_data.get("issue"), dict) else {}
    model_payload = request_data.get("runtime") if isinstance(request_data.get("runtime"), dict) else {}
    quality_meta = (node.meta_info or {}) if isinstance(node.meta_info, dict) else {}
    quality_meta_quality = quality_meta.get("quality") if isinstance(quality_meta.get("quality"), dict) else {}
    quality_meta_quality.update({
        "last_ai_fix_at": datetime.utcnow().isoformat(),
        "last_ai_fix_field": editable_field,
        "last_ai_fix_issue_type": str(issue_payload.get("type", "")).strip().lower(),
        "last_ai_fix_issue_message": str(issue_payload.get("message", "")).strip(),
        "last_ai_fix_requested_model": str(model_payload.get("requested_model", "")).strip(),
        "last_ai_fix_actual_model": str(model_payload.get("actual_model", "")).strip(),
        "last_ai_fix_chars_delta": len(revised_text) - len(original_text or "")
    })
    quality_meta["quality"] = quality_meta_quality
    node.meta_info = quality_meta
    flag_modified(node, "meta_info")

    db.commit()
    db.refresh(node)

    return {
        "success": True,
        "profile_id": profile_id,
        "node_id": node_id,
        "target_field": editable_field,
        "updated_text": revised_text,
        "meta_info": node.meta_info
    }


@app.post("/profiles", response_model=ProfileResponse)
def create_profile(
    profile_data: ProfileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new profile"""
    profile = Profile(
        user_id=current_user.id,
        **profile_data.model_dump()
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@app.put("/profiles/{profile_id}", response_model=ProfileResponse)
def update_profile(
    profile_id: int,
    profile_data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update profile"""
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    for field, value in profile_data.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    profile.nodes = [n for n in profile.nodes if n.parent_id is None]
    return profile


# ============================================================================
# ProfileNode Endpoints (Universal - handles ALL content)
# ============================================================================

@app.get("/profiles/{profile_id}/nodes", response_model=List[ProfileNodeResponse])
def get_nodes(
    profile_id: int,
    parent_id: Optional[int] = None,
    node_type: Optional[str] = None,
    flat: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get nodes for a profile.
    - parent_id: filter by parent (None = root nodes)
    - node_type: filter by type (section, entry, item, etc.)
    - flat: if True, return flat list; if False, return tree
    """
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    query = db.query(ProfileNode).filter(ProfileNode.profile_id == profile_id)

    if not flat:
        query = query.filter(ProfileNode.parent_id == parent_id)
    if node_type:
        query = query.filter(ProfileNode.node_type == node_type)

    nodes = query.order_by(ProfileNode.order).all()
    return nodes


@app.get("/nodes/{node_id}", response_model=ProfileNodeResponse)
def get_node(
    node_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific node by ID"""
    node = db.query(ProfileNode).filter(ProfileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Verify ownership
    profile = db.query(Profile).filter(
        Profile.id == node.profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=403, detail="Access denied")

    return node


@app.post("/profiles/{profile_id}/nodes", response_model=ProfileNodeResponse)
def create_node(
    profile_id: int,
    node_data: ProfileNodeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new node (section, entry, item, etc.)"""
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Compute level and root_id based on parent
    level = 0
    root_id = None
    if node_data.parent_id is not None:
        parent = db.query(ProfileNode).filter(ProfileNode.id == node_data.parent_id).first()
        if parent:
            level = parent.level + 1
            root_id = parent.root_id if parent.root_id is not None else parent.id

    # Calculate next order value for siblings
    # Get max order among siblings (nodes with same parent_id)
    max_order = db.query(func.max(ProfileNode.order)).filter(
        ProfileNode.profile_id == profile_id,
        ProfileNode.parent_id == node_data.parent_id
    ).scalar()
    # If no siblings exist (max_order is None), start at 0, otherwise increment
    next_order = 0 if max_order is None else max_order + 1

    # Create node
    node = ProfileNode(
        global_id=str(uuid.uuid4()),
        profile_id=profile_id,
        level=level,
        root_id=root_id,
        order=next_order,
        **node_data.model_dump(exclude={"parent_id", "children", "level", "root_id", "order"})
    )
    if node_data.parent_id is not None:
        node.parent_id = node_data.parent_id

    db.add(node)
    db.commit()
    db.refresh(node)

    # If this is a root node, set root_id to itself
    if node.parent_id is None:
        node.root_id = node.id
        db.commit()
        db.refresh(node)

    # Recursively create children if provided
    if node_data.children:
        _create_children_recursive(db, node.id, profile_id, node_data.children)
        db.refresh(node)

    return node


@app.put("/nodes/{node_id}", response_model=ProfileNodeResponse)
def update_node(
    node_id: int,
    node_data: ProfileNodeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update any node"""
    node = db.query(ProfileNode).filter(ProfileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Verify ownership
    profile = db.query(Profile).filter(
        Profile.id == node.profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=403, detail="Access denied")

    # Update fields
    for field, value in node_data.model_dump(exclude_unset=True).items():
        setattr(node, field, value)

    db.commit()
    db.refresh(node)
    return node


@app.delete("/nodes/{node_id}")
def delete_node(
    node_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete node and all its children (cascade)"""
    node = db.query(ProfileNode).filter(ProfileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Verify ownership
    profile = db.query(Profile).filter(
        Profile.id == node.profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(node)
    db.commit()
    return {"message": "Node deleted successfully"}


@app.post("/nodes/{node_id}/move")
def move_node(
    node_id: int,
    move_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Move node to different parent or reorder"""
    node = db.query(ProfileNode).filter(ProfileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Verify ownership
    profile = db.query(Profile).filter(
        Profile.id == node.profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=403, detail="Access denied")

    new_parent_id = move_data.get('new_parent_id')
    new_order = move_data.get('new_order')

    print(f"🔄 Moving node {node_id}")
    print(f"   Current: parent_id={node.parent_id}, order={node.order}")
    print(f"   New: parent_id={new_parent_id}, order={new_order}")

    if new_parent_id is not None:
        node.parent_id = new_parent_id
    if new_order is not None:
        node.order = new_order

    db.commit()

    # Normalize orders for all siblings (sequential 0, 1, 2...)
    siblings = db.query(ProfileNode).filter(
        ProfileNode.profile_id == node.profile_id,
        ProfileNode.parent_id == node.parent_id
    ).order_by(ProfileNode.order).all()

    print(f"   Found {len(siblings)} siblings to normalize")
    for idx, sibling in enumerate(siblings):
        print(f"   - Node {sibling.id} ({sibling.title}): {sibling.order} -> {idx}")
        sibling.order = idx

    db.commit()
    db.refresh(node)
    print(f"✅ Node {node_id} moved successfully, new order: {node.order}")
    return node


@app.post("/profiles/download-pdf")
async def download_profile_pdf(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate and download the full profile pool as a PDF.
    This shows ALL content from the user's default profile.
    """
    # Get the user's default profile
    profile = db.query(Profile).filter(
        Profile.user_id == current_user.id,
        Profile.is_default == True
    ).first()

    if not profile:
        # Fallback to any profile if no default
        profile = db.query(Profile).filter(
            Profile.user_id == current_user.id
        ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="No profile found")

    # Helper function to convert ProfileNode ORM objects to dictionaries recursively
    def node_to_dict(node):
        """Convert ProfileNode ORM object to dictionary with children"""
        node_dict = {
            'id': node.id,
            'global_id': node.global_id,
            'profile_id': node.profile_id,
            'parent_id': node.parent_id,
            'node_type': node.node_type,
            'title': node.title,
            'subtitle': node.subtitle,
            'content': node.content,
            'content_type': node.content_type,
            'start_date': node.start_date,
            'end_date': node.end_date,
            'location': node.location,
            'icon': node.icon,
            'order': node.order,
            'is_visible': node.is_visible,
            'is_selected': True,  # For profile pool, everything is selected by default
            'level': node.level,
            'root_id': node.root_id,
            'children': []
        }

        # Recursively convert children
        if node.children:
            node_dict['children'] = [node_to_dict(child) for child in sorted(node.children, key=lambda x: x.order)]

        return node_dict

    # Get all root nodes for this profile
    root_nodes = db.query(ProfileNode).filter(
        ProfileNode.profile_id == profile.id,
        ProfileNode.parent_id == None
    ).order_by(ProfileNode.order).all()

    # Convert ORM objects to dictionaries
    nodes_as_dicts = [node_to_dict(node) for node in root_nodes]

    # Transform nodes to sections for PDF generation
    sections = transform_nodes_to_sections(nodes_as_dicts)

    # Build contact info with user's full name and current date
    contact_info = profile.contact_info or {}
    # Add a header title for the profile snapshot - use 'full_name' key as that's what PDF template expects
    contact_info_with_header = {
        **contact_info,
        'full_name': f"{current_user.full_name} - Full Profile Snapshot ({datetime.now().strftime('%B %d, %Y')})"
    }

    # Build selected_content structure
    selected_content = {
        'contact_info': contact_info_with_header,
        'sections': sections
    }

    cv_data = {
        "selected_content": selected_content
    }

    # Generate PDF using default professional template
    try:
        generator = pdf_service.CVPDFGenerator(
            template_name="professional",
            customizations={}
        )
        pdf_buffer = generator.generate_pdf(cv_data, hidden_items=[])

        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="Profile_Pool_CV.pdf"'
            }
        )

    except Exception as e:
        print(f"Error generating profile PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")


# ============================================================================
# Helper Functions
# ============================================================================

def _create_children_recursive(db: Session, parent_id: int, profile_id: int, children: List[ProfileNodeCreate]):
    """Recursively create child nodes with proper level and root_id tracking"""
    # Get parent to compute level and root_id
    parent = db.query(ProfileNode).filter(ProfileNode.id == parent_id).first()
    if not parent:
        return

    for child_data in children:
        level = parent.level + 1
        root_id = parent.root_id if parent.root_id is not None else parent.id

        child = ProfileNode(
            global_id=str(uuid.uuid4()),
            profile_id=profile_id,
            parent_id=parent_id,
            level=level,
            root_id=root_id,
            **child_data.model_dump(exclude={"parent_id", "children", "level", "root_id"})
        )
        db.add(child)
        db.commit()
        db.refresh(child)

        if child_data.children:
            _create_children_recursive(db, child.id, profile_id, child_data.children)


# ============================================================================
# Tailored CV Routes
# ============================================================================

@app.post("/api/tailor/analyze-job")
async def analyze_job_description(
    request: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Analyze job description with both OpenAI and Claude.
    Returns extracted requirements from both models.
    """
    job_description = request.get("job_description", "")

    if not job_description or len(job_description.strip()) < 50:
        raise HTTPException(status_code=400, detail="Job description too short (minimum 50 characters)")

    ai_settings = get_user_ai_settings(current_user)

    api_logger.step("Starting job description analysis with dual models", step_num=1)
    api_logger.parallel_execution_start(["OpenAI", "Claude"])

    # Call both AI models in parallel using asyncio
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor(max_workers=2) as executor:
        openai_future = loop.run_in_executor(
            executor,
            ai_tailor_service.analyze_job_with_openai,
            job_description,
            ai_settings["openai_model"],
            ai_settings["openai_reasoning_effort"]
        )
        claude_future = loop.run_in_executor(
            executor,
            ai_tailor_service.analyze_job_with_claude,
            job_description,
            ai_settings["claude_model"]
        )

        # Wait for both to complete
        openai_result, claude_result = await asyncio.gather(openai_future, claude_future)

    # Log summary
    api_logger.dual_analysis_summary({
        "openai": openai_result,
        "claude": claude_result
    })
    api_logger.success("Job analysis complete")

    return {
        "openai": openai_result,
        "claude": claude_result,
        "job_description": job_description
    }


@app.post("/api/tailor/score-profile")
async def score_profile_fit(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Score how well the profile matches job requirements.
    Returns fit scores and ATS scores from both models.
    """
    job_requirements = request.get("job_requirements")
    job_analysis_payload = request.get("job_analysis") or {}
    profile_id = request.get("profile_id")
    job_description = request.get("job_description", "")

    if (not job_requirements and not job_analysis_payload) or not profile_id:
        raise HTTPException(status_code=400, detail="Missing analysis input (job_requirements/job_analysis) or profile_id")

    ai_settings = get_user_ai_settings(current_user)

    def get_requirements_for_provider(provider: str, fallback: dict):
        provider_payload = job_analysis_payload.get(provider) if isinstance(job_analysis_payload, dict) else None
        if isinstance(provider_payload, dict) and provider_payload.get("success") and isinstance(provider_payload.get("analysis"), dict):
            return provider_payload["analysis"], f"{provider}_analysis"
        return fallback, "fallback_job_requirements"

    fallback_requirements = job_requirements if isinstance(job_requirements, dict) else {}
    openai_requirements, openai_requirements_source = get_requirements_for_provider("openai", fallback_requirements)
    claude_requirements, claude_requirements_source = get_requirements_for_provider("claude", fallback_requirements)

    # Get profile with nodes
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Convert nodes to text for scoring
    def node_to_dict(node):
        return {
            "id": node.id,
            "global_id": node.global_id,
            "node_type": node.node_type,
            "title": node.title,
            "subtitle": node.subtitle,
            "content": node.content,
            "start_date": node.start_date,
            "end_date": node.end_date,
            "location": node.location,
            "level": node.level,
            "is_visible": node.is_visible,
            "children": [node_to_dict(child) for child in node.children] if node.children else []
        }

    nodes_list = [node_to_dict(node) for node in profile.nodes if node.parent_id is None]
    profile_text = ai_tailor_service.profile_nodes_to_text(nodes_list)

    api_logger.step("Starting profile scoring with dual models", step_num=1)
    api_logger.parallel_execution_start(["OpenAI", "Claude"])

    # Score with both models in parallel using asyncio
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor(max_workers=2) as executor:
        openai_future = loop.run_in_executor(
            executor,
            ai_tailor_service.score_profile_with_openai,
            openai_requirements,
            profile_text,
            job_description,
            ai_settings["openai_model"],
            ai_settings["openai_reasoning_effort"]
        )
        claude_future = loop.run_in_executor(
            executor,
            ai_tailor_service.score_profile_with_claude,
            claude_requirements,
            profile_text,
            job_description,
            ai_settings["claude_model"]
        )

        # Wait for both to complete
        openai_scores, claude_scores = await asyncio.gather(openai_future, claude_future)

    # Log summary
    api_logger.dual_analysis_summary({
        "openai": openai_scores,
        "claude": claude_scores
    })
    api_logger.success("Profile scoring complete")

    return {
        "openai": openai_scores,
        "claude": claude_scores,
        "profile_id": profile_id,
        "requirements_source": {
            "openai": openai_requirements_source,
            "claude": claude_requirements_source
        }
    }


@app.post("/api/tailor/recommend-nodes")
async def recommend_node_selection(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get AI recommendations for which nodes to include/exclude.
    Returns recommendations from both models.
    """
    import time
    start_time = time.time()
    print(f"\n🚀 [RECOMMEND-NODES] Request received from user {current_user.id}")

    job_requirements = request.get("job_requirements")
    job_analysis_payload = request.get("job_analysis") or {}
    profile_id = request.get("profile_id")
    job_description = request.get("job_description", "")

    if (not job_requirements and not job_analysis_payload) or not profile_id:
        print(f"❌ [RECOMMEND-NODES] Missing requirements or profile_id")
        raise HTTPException(status_code=400, detail="Missing analysis input (job_requirements/job_analysis) or profile_id")

    ai_settings = get_user_ai_settings(current_user)

    print(f"📋 [RECOMMEND-NODES] Profile ID: {profile_id}")

    # Get profile with nodes
    db_start = time.time()
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()
    print(f"⏱️ [RECOMMEND-NODES] Database query took {time.time() - db_start:.2f}s")

    if not profile:
        print(f"❌ [RECOMMEND-NODES] Profile {profile_id} not found")
        raise HTTPException(status_code=404, detail="Profile not found")

    # Convert nodes to flat list for AI analysis
    print(f"🔄 [RECOMMEND-NODES] Converting {len(profile.nodes)} nodes to dict...")
    convert_start = time.time()

    def clean_dict(d):
        """Remove null, empty string, and empty array values to reduce token usage"""
        if not isinstance(d, dict):
            return d

        cleaned = {}
        for key, value in d.items():
            # Skip null, empty strings, and empty lists
            if value is None or value == "" or (isinstance(value, list) and len(value) == 0):
                continue

            # Recursively clean nested dicts
            if isinstance(value, dict):
                cleaned_value = clean_dict(value)
                if cleaned_value:  # Only include if not empty after cleaning
                    cleaned[key] = cleaned_value
            # Clean lists of dicts
            elif isinstance(value, list):
                if all(isinstance(item, dict) for item in value):
                    cleaned_list = [clean_dict(item) for item in value]
                    cleaned_list = [item for item in cleaned_list if item]  # Remove empty dicts
                    if cleaned_list:
                        cleaned[key] = cleaned_list
                else:
                    cleaned[key] = value
            else:
                cleaned[key] = value

        return cleaned

    def node_to_dict(node):
        data = {
            "id": node.id,
            "global_id": node.global_id,
            "node_type": node.node_type,
            "title": node.title,
            "subtitle": node.subtitle,
            "content": node.content,
            "start_date": node.start_date,
            "end_date": node.end_date,
            "location": node.location,
            "level": node.level,
            "is_visible": node.is_visible,
        }
        cleaned = clean_dict(data)
        if node.children:
            children = [node_to_dict(child) for child in node.children]
            if children:
                cleaned["children"] = children
        return cleaned

    nodes_list = [node_to_dict(node) for node in profile.nodes if node.parent_id is None]

    # Resolve provider-specific requirements (prefer each model's own analysis)
    def get_requirements_for_provider(provider: str, fallback: dict):
        provider_payload = job_analysis_payload.get(provider) if isinstance(job_analysis_payload, dict) else None
        if isinstance(provider_payload, dict) and provider_payload.get("success") and isinstance(provider_payload.get("analysis"), dict):
            return clean_dict(provider_payload["analysis"]), f"{provider}_analysis"
        return clean_dict(fallback), "fallback_job_requirements"

    fallback_requirements = job_requirements if isinstance(job_requirements, dict) else {}
    openai_requirements, openai_requirements_source = get_requirements_for_provider("openai", fallback_requirements)
    claude_requirements, claude_requirements_source = get_requirements_for_provider("claude", fallback_requirements)

    # Calculate original size (before flattening with cleaned structure)
    import json
    original_size = max(
        len(json.dumps({"job_requirements": openai_requirements, "profile_nodes": nodes_list})),
        len(json.dumps({"job_requirements": claude_requirements, "profile_nodes": nodes_list}))
    )

    flat_nodes = ai_tailor_service.flatten_nodes_for_analysis(nodes_list)
    print(f"✅ [RECOMMEND-NODES] Converted to {len(flat_nodes)} flat nodes in {time.time() - convert_start:.2f}s")

    # Show size reduction
    cleaned_size = max(
        len(json.dumps({"job_requirements": openai_requirements, "profile_nodes": flat_nodes})),
        len(json.dumps({"job_requirements": claude_requirements, "profile_nodes": flat_nodes}))
    )
    reduction = original_size - cleaned_size
    reduction_pct = (reduction / original_size * 100) if original_size > 0 else 0
    print(f"📊 [RECOMMEND-NODES] Data size: {original_size:,} → {cleaned_size:,} characters ({cleaned_size/1000:.1f}K)")
    print(f"📉 [RECOMMEND-NODES] Reduction: {reduction:,} characters ({reduction_pct:.1f}%)")

    # Get recommendations from both models IN PARALLEL
    print(f"🤖 [RECOMMEND-NODES] Calling OpenAI and Claude IN PARALLEL...")
    api_logger.step("Starting node recommendations with dual models", step_num=1)
    api_logger.parallel_execution_start(["OpenAI", "Claude"])
    parallel_start = time.time()

    # Run both AI calls in parallel using ThreadPoolExecutor
    # This allows both models to process simultaneously
    with ThreadPoolExecutor(max_workers=2) as executor:
        # Submit both tasks
        openai_future = executor.submit(
            ai_tailor_service.recommend_nodes_with_openai,
            openai_requirements,
            flat_nodes,
            job_description,
            ai_settings["openai_model"],
            ai_settings["openai_reasoning_effort"]
        )
        claude_future = executor.submit(
            ai_tailor_service.recommend_nodes_with_claude,
            claude_requirements,
            flat_nodes,
            job_description,
            ai_settings["claude_model"]
        )

        # Wait for OpenAI result
        openai_start = time.time()
        try:
            openai_recommendations = openai_future.result()
            openai_duration = time.time() - openai_start
            openai_runtime_ms = ((openai_recommendations.get("runtime") or {}).get("duration_ms"))
            if openai_runtime_ms is not None:
                print(f"✅ [RECOMMEND-NODES] OpenAI completed in {openai_runtime_ms/1000:.2f}s (model runtime), success: {openai_recommendations.get('success')}")
            else:
                print(f"✅ [RECOMMEND-NODES] OpenAI completed in {openai_duration:.2f}s (wait time), success: {openai_recommendations.get('success')}")
        except Exception as e:
            openai_duration = time.time() - openai_start
            print(f"❌ [RECOMMEND-NODES] OpenAI failed after {openai_duration:.2f}s: {str(e)}")
            openai_recommendations = {"success": False, "error": str(e)}

        # Wait for Claude result
        claude_start = time.time()
        try:
            claude_recommendations = claude_future.result()
            claude_duration = time.time() - claude_start
            claude_runtime_ms = ((claude_recommendations.get("runtime") or {}).get("duration_ms"))
            if claude_runtime_ms is not None:
                print(f"✅ [RECOMMEND-NODES] Claude completed in {claude_runtime_ms/1000:.2f}s (model runtime), success: {claude_recommendations.get('success')}")
            else:
                print(f"✅ [RECOMMEND-NODES] Claude completed in {claude_duration:.2f}s (wait time), success: {claude_recommendations.get('success')}")
        except Exception as e:
            claude_duration = time.time() - claude_start
            print(f"❌ [RECOMMEND-NODES] Claude failed after {claude_duration:.2f}s: {str(e)}")
            claude_recommendations = {"success": False, "error": str(e)}

    parallel_duration = time.time() - parallel_start
    openai_runtime = ((openai_recommendations.get("runtime") or {}).get("duration_ms") or int(openai_duration * 1000)) / 1000
    claude_runtime = ((claude_recommendations.get("runtime") or {}).get("duration_ms") or int(claude_duration * 1000)) / 1000
    sequential_estimate = openai_runtime + claude_runtime
    print(f"⚡ [RECOMMEND-NODES] Both models completed in parallel in {parallel_duration:.2f}s (vs {sequential_estimate:.2f}s estimated sequential)")
    print(f"💰 [RECOMMEND-NODES] Estimated time saved: {(sequential_estimate - parallel_duration):.2f}s")

    # POST-PROCESS: Force include structural nodes (sections/entries)
    # Build map of node_id -> node_type for quick lookup
    node_type_map = {}
    def map_node_types(nodes):
        for node in nodes:
            if node.get("id") is not None:
                node_type_map[node["id"]] = node.get("node_type", "").lower()
            if node.get("children"):
                map_node_types(node["children"])

    map_node_types(nodes_list)
    print(f"📊 [RECOMMEND-NODES] Mapped {len(node_type_map)} node types")

    def force_structural_nodes(recommendations_data):
        """Force all section/entry nodes to include: true"""
        if not recommendations_data.get("success") or not recommendations_data.get("recommendations"):
            return recommendations_data

        selected_nodes = recommendations_data["recommendations"].get("selected_nodes", [])
        forced_count = 0
        added_count = 0

        # Create a set of existing node IDs in recommendations
        existing_ids = {rec.get("id") for rec in selected_nodes if rec.get("id") is not None}

        # Force structural nodes to include: true
        for rec in selected_nodes:
            node_id = rec.get("id")
            if node_id in node_type_map:
                node_type = node_type_map[node_id]
                if node_type in ["section", "entry"]:
                    if not rec.get("include"):
                        rec["include"] = True
                        rec["confidence"] = 1.0
                        rec["reason"] = "Structural node (auto-included to preserve CV hierarchy)"
                        rec["relevance_tags"] = rec.get("relevance_tags", []) + ["structural"]
                        forced_count += 1

        # Add missing structural nodes that AI didn't return
        for node_id, node_type in node_type_map.items():
            if node_type in ["section", "entry"] and node_id not in existing_ids:
                selected_nodes.append({
                    "id": node_id,
                    "include": True,
                    "confidence": 1.0,
                    "reason": "Structural node (auto-included to preserve CV hierarchy)",
                    "relevance_tags": ["structural"]
                })
                added_count += 1

        if forced_count > 0 or added_count > 0:
            print(f"   📌 Forced {forced_count} section/entry nodes to include=true, added {added_count} missing structural nodes")
            # Update summary
            if "selection_summary" in recommendations_data["recommendations"]:
                summary = recommendations_data["recommendations"]["selection_summary"]
                summary["recommended_include"] = sum(1 for rec in selected_nodes if rec.get("include"))
                summary["recommended_exclude"] = sum(1 for rec in selected_nodes if not rec.get("include"))
                summary["total_nodes"] = len(selected_nodes)

        return recommendations_data

    # Apply to both models
    print(f"🔧 [RECOMMEND-NODES] Post-processing: forcing structural nodes (sections/entries) to include=true")
    openai_recommendations = force_structural_nodes(openai_recommendations)
    claude_recommendations = force_structural_nodes(claude_recommendations)

    total_time = time.time() - start_time
    print(f"🏁 [RECOMMEND-NODES] Total request time: {total_time:.2f}s")

    # Log summary
    api_logger.dual_analysis_summary({
        "openai": openai_recommendations,
        "claude": claude_recommendations
    })
    api_logger.success(f"Node recommendations complete in {total_time:.2f}s")

    # Prepare response
    response_data = {
        "openai": openai_recommendations,
        "claude": claude_recommendations,
        "total_nodes": len(flat_nodes),
        "requirements_source": {
            "openai": openai_requirements_source,
            "claude": claude_requirements_source
        }
    }

    return response_data


@app.post("/api/tailor/save")
async def save_tailored_cv(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save a tailored CV with complete snapshot of selected nodes.

    This creates a frozen-in-time version of the CV that can always be reconstructed
    exactly as it was, even if the master profile is later modified.
    """
    profile_id = request.get("profile_id")
    job_title = request.get("job_title")
    company_name = request.get("company_name")
    job_description = request.get("job_description")
    selected_node_ids = request.get("selected_node_ids", [])  # List of global_ids
    fit_scores = request.get("fit_scores")
    ats_scores = request.get("ats_scores")
    recommendations = request.get("recommendations")
    job_analysis = request.get("job_analysis")
    selected_model = request.get("selected_model", "openai")  # Which AI model was used
    status = request.get("status", "draft")

    if not profile_id or not job_title:
        raise HTTPException(status_code=400, detail="Missing required fields: profile_id, job_title")

    # Verify profile ownership
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    print(f"📋 [SAVE-CV] Saving tailored CV: {job_title} at {company_name}")
    print(f"📋 [SAVE-CV] Selected {len(selected_node_ids)} nodes from profile {profile.title}")

    # Build complete node lookup map: global_id -> node object
    def build_node_map(node, node_map):
        node_map[node.global_id] = node
        for child in node.children:
            build_node_map(child, node_map)

    node_lookup = {}
    for node in profile.nodes:
        build_node_map(node, node_lookup)

    # Convert node to complete dict with ALL fields from profile_nodes table
    def node_to_complete_dict(node, include_children=True):
        """
        Convert SQLAlchemy node to complete dictionary with ALL fields.
        This ensures we can perfectly reconstruct the CV even if master profile changes.
        """
        node_dict = {
            # Identity
            "id": node.id,
            "global_id": node.global_id,
            "profile_id": node.profile_id,
            "parent_id": node.parent_id,

            # Hierarchy
            "level": node.level,
            "root_id": node.root_id,

            # Type
            "node_type": node.node_type,

            # Content
            "title": node.title,
            "subtitle": node.subtitle,
            "content": node.content,
            "content_type": node.content_type,

            # Optional metadata
            "start_date": node.start_date,
            "end_date": node.end_date,
            "location": node.location,

            # Display and organization
            "order": node.order,
            "is_visible": node.is_visible,
            "icon": node.icon,

            # Flexible extensions
            "attributes": node.attributes,
            "meta_info": node.meta_info,

            # Tracking
            "created_at": node.created_at.isoformat() if node.created_at else None,
            "updated_at": node.updated_at.isoformat() if node.updated_at else None,
        }

        if include_children and node.children:
            node_dict["children"] = [node_to_complete_dict(child) for child in node.children]
        else:
            node_dict["children"] = []

        return node_dict

    # Build hierarchical structure of ONLY selected nodes
    selected_nodes_set = set(selected_node_ids)

    def filter_and_build_hierarchy(node):
        """
        Recursively filter nodes to include only selected ones and their necessary parents.
        Returns the node dict if it or any descendant is selected, None otherwise.
        """
        # Check if any children should be included
        filtered_children = []
        if node.children:
            for child in node.children:
                filtered_child = filter_and_build_hierarchy(child)
                if filtered_child:
                    filtered_children.append(filtered_child)

        # Include this node if it's selected OR has selected descendants
        if node.global_id in selected_nodes_set or filtered_children:
            node_dict = node_to_complete_dict(node, include_children=False)
            node_dict["children"] = filtered_children
            node_dict["is_selected"] = node.global_id in selected_nodes_set
            return node_dict

        return None

    # Build filtered hierarchy starting from root nodes
    filtered_root_nodes = []
    for node in profile.nodes:
        if node.parent_id is None:  # Root node
            filtered_node = filter_and_build_hierarchy(node)
            if filtered_node:
                filtered_root_nodes.append(filtered_node)

    # Save COMPLETE AI recommendations from BOTH models
    # This includes ALL nodes (not just selected) so we have full context
    complete_recommendations = {}
    if recommendations:
        for model_name in ['openai', 'claude']:
            if model_name in recommendations:
                model_data = recommendations[model_name]
                if model_data.get('success') and model_data.get('recommendations'):
                    complete_recommendations[model_name] = {
                        'success': model_data.get('success'),
                        'model': model_data.get('model'),
                        'recommendations': {
                            'selected_nodes': model_data['recommendations'].get('selected_nodes', []),
                            'selection_summary': model_data['recommendations'].get('selection_summary', {}),
                            'tailoring_strategy': model_data['recommendations'].get('tailoring_strategy', ''),
                            'profile_fit_score': model_data['recommendations'].get('profile_fit_score'),
                            'ats_score': model_data['recommendations'].get('ats_score')
                        }
                    }
                else:
                    # Save error info if model failed
                    complete_recommendations[model_name] = {
                        'success': False,
                        'error': model_data.get('error', 'Unknown error')
                    }

    # Read backend version
    backend_version = "unknown"
    try:
        from pathlib import Path
        version_file = Path(__file__).parent / "VERSION"
        if version_file.exists():
            backend_version = version_file.read_text().strip()
    except Exception:
        pass

    # Get user contact info from User model (My Profile page)
    user_contact_info = {
        "full_name": current_user.full_name,
        "email": current_user.email,
        "phone_number": current_user.phone_number,
        "country": current_user.country,
        "city": current_user.city,
        "linkedin_url": current_user.linkedin_url,
        "github_url": current_user.github_url,
        "portfolio_url": current_user.portfolio_url,
        "professional_title": current_user.professional_title
    }

    # Initialize _active_fields based on which fields have values
    active_fields = {}
    for key, value in user_contact_info.items():
        active_fields[key] = bool(value)  # True if field has a value, False otherwise
    user_contact_info["_active_fields"] = active_fields

    # Create complete content snapshot
    content_snapshot = {
        "nodes": filtered_root_nodes,  # Hierarchical structure with only selected nodes
        "contact_info": user_contact_info,  # User's contact info from My Profile
        "profile_contact_info": profile.contact_info,  # Legacy profile contact (if any)
        "profile_title": profile.title,
        "profile_id": profile.id,
        "backend_version": backend_version,
        "created_at": datetime.now().isoformat(),
        "selected_count": len(selected_node_ids),
        "total_nodes_in_profile": len(node_lookup)
    }

    # Build selected_node_ids list with both id and global_id for reference
    selected_nodes_with_ids = []
    for global_id in selected_node_ids:
        node = node_lookup.get(global_id)
        if node:
            selected_nodes_with_ids.append({
                "id": node.id,
                "global_id": node.global_id
            })

    print(f"📋 [SAVE-CV] Built snapshot with {len(filtered_root_nodes)} root sections")
    print(f"📋 [SAVE-CV] Selected model: {selected_model}")
    print(f"📋 [SAVE-CV] Saving recommendations from both models: {list(complete_recommendations.keys())}")

    # Create tailored CV record with complete snapshot
    # Save ORIGINAL snapshot as a pristine copy for "restore to original" functionality
    import copy
    original_snapshot = copy.deepcopy(content_snapshot)

    tailored_cv = TailoredCV(
        user_id=current_user.id,
        profile_id=profile_id,
        job_title=job_title,
        company_name=company_name,
        job_description=job_description,
        fit_scores=fit_scores,
        ats_scores=ats_scores,
        selected_node_ids=selected_nodes_with_ids,
        content_snapshot=content_snapshot,
        original_snapshot=original_snapshot,  # Store pristine copy for restoration
        recommendations=complete_recommendations,  # Complete recommendations from BOTH models
        job_analysis=job_analysis,  # Job requirements from BOTH models
        status=status
    )

    # Add selected_model to the record (we'll need to add this field to the model)
    # For now, store it in content_snapshot
    content_snapshot["selected_ai_model"] = selected_model

    db.add(tailored_cv)
    db.commit()
    db.refresh(tailored_cv)

    print(f"✅ [SAVE-CV] Tailored CV saved with ID: {tailored_cv.id}")

    return {
        "success": True,
        "tailored_cv_id": tailored_cv.id,
        "message": "Tailored CV saved successfully",
        "summary": {
            "selected_nodes": len(selected_node_ids),
            "root_sections": len(filtered_root_nodes),
            "ai_model": selected_model
        }
    }


@app.get("/api/tailor/list")
async def list_tailored_cvs(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all tailored CVs for the current user with version tracking

    Args:
        status: Optional status filter (e.g., 'draft', 'applied', etc.)
    """
    query = db.query(TailoredCV).filter(TailoredCV.user_id == current_user.id)

    # Apply status filter if provided
    if status:
        query = query.filter(TailoredCV.status == status)

    tailored_cvs = query.order_by(TailoredCV.created_at.desc()).all()

    # Calculate version numbers for each job+company combination
    # Group by (job_title, company_name) and assign version numbers
    job_company_versions = {}

    # First pass: count how many CVs exist for each job+company
    for cv in tailored_cvs:
        # Normalize company name (empty string or None treated as same)
        company_key = (cv.company_name or "").strip().lower()
        job_key = (cv.job_title or "").strip().lower()
        key = (job_key, company_key)

        if key not in job_company_versions:
            job_company_versions[key] = []
        job_company_versions[key].append(cv)

    # Sort each group by created_at (oldest first) to assign version numbers
    for key in job_company_versions:
        job_company_versions[key].sort(key=lambda x: x.created_at)

    # Build response with version info
    result = []
    for cv in tailored_cvs:
        company_key = (cv.company_name or "").strip().lower()
        job_key = (cv.job_title or "").strip().lower()
        key = (job_key, company_key)

        versions_list = job_company_versions[key]
        total_versions = len(versions_list)
        version_number = versions_list.index(cv) + 1  # 1-indexed
        is_latest = version_number == total_versions

        result.append({
            "id": cv.id,
            "job_title": cv.job_title,
            "company_name": cv.company_name,
            "status": cv.status,
            "fit_scores": cv.fit_scores,
            "ats_scores": cv.ats_scores,
            "created_at": cv.created_at.isoformat(),
            "updated_at": cv.updated_at.isoformat(),
            "version": version_number,
            "total_versions": total_versions,
            "is_latest": is_latest
        })

    return result


@app.get("/api/tailor/{cv_id}")
async def get_tailored_cv(
    cv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific tailored CV with full details including version info"""
    # CRITICAL: Expire all cached objects to ensure we get fresh data from DB
    db.expire_all()

    tailored_cv = db.query(TailoredCV).filter(
        TailoredCV.id == cv_id,
        TailoredCV.user_id == current_user.id
    ).first()

    if not tailored_cv:
        raise HTTPException(status_code=404, detail="Tailored CV not found")

    # Force refresh of JSONB columns to ensure we get the latest data
    db.refresh(tailored_cv)

    # Calculate version info for this CV
    company_key = (tailored_cv.company_name or "").strip().lower()
    job_key = (tailored_cv.job_title or "").strip().lower()

    # Get all CVs for same job+company
    same_job_cvs = db.query(TailoredCV).filter(
        TailoredCV.user_id == current_user.id
    ).all()

    # Filter to same job+company and sort by created_at
    matching_cvs = [
        cv for cv in same_job_cvs
        if (cv.job_title or "").strip().lower() == job_key
        and (cv.company_name or "").strip().lower() == company_key
    ]
    matching_cvs.sort(key=lambda x: x.created_at)

    total_versions = len(matching_cvs)
    version_number = matching_cvs.index(tailored_cv) + 1 if tailored_cv in matching_cvs else 1
    is_latest = version_number == total_versions
    nodes = (tailored_cv.content_snapshot or {}).get("nodes", [])
    humanity_report = _get_cached_humanity_report(tailored_cv, nodes)
    if not humanity_report:
        ai_settings = get_user_ai_settings(current_user)
        humanity_report = _evaluate_humanity_for_nodes(
            nodes,
            mode="quick",
            ai_settings=ai_settings
        )

    return {
        "id": tailored_cv.id,
        "profile_id": tailored_cv.profile_id,
        "job_title": tailored_cv.job_title,
        "company_name": tailored_cv.company_name,
        "job_description": tailored_cv.job_description,
        "fit_scores": tailored_cv.fit_scores,
        "ats_scores": tailored_cv.ats_scores,
        "recalculated_scores": tailored_cv.recalculated_scores or [],
        "selected_node_ids": tailored_cv.selected_node_ids,
        "content_snapshot": tailored_cv.content_snapshot,
        "original_snapshot": tailored_cv.original_snapshot,
        "recommendations": tailored_cv.recommendations,
        "version": version_number,
        "total_versions": total_versions,
        "is_latest": is_latest,
        "job_analysis": tailored_cv.job_analysis,
        "humanity": humanity_report,
        "status": tailored_cv.status,
        "created_at": tailored_cv.created_at.isoformat(),
        "updated_at": tailored_cv.updated_at.isoformat()
    }


@app.post("/api/tailor/{cv_id}/humanity-check")
async def check_tailored_cv_humanity(
    cv_id: int,
    request_data: Optional[dict] = Body(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Run humanity guard checks on current (or provided) CV snapshot content."""
    tailored_cv = db.query(TailoredCV).filter(
        TailoredCV.id == cv_id,
        TailoredCV.user_id == current_user.id
    ).first()

    if not tailored_cv:
        raise HTTPException(status_code=404, detail="Tailored CV not found")

    incoming_snapshot = (request_data or {}).get("content_snapshot")
    snapshot = incoming_snapshot if isinstance(incoming_snapshot, dict) else (tailored_cv.content_snapshot or {})
    nodes = snapshot.get("nodes", [])

    requested_mode = str((request_data or {}).get("mode", "quick")).strip().lower()
    if requested_mode not in {"quick", "deep"}:
        requested_mode = "quick"
    persist_result = bool((request_data or {}).get("persist", requested_mode == "deep"))

    ai_settings = get_user_ai_settings(current_user)
    humanity = _evaluate_humanity_for_nodes(nodes, mode=requested_mode, ai_settings=ai_settings)

    if persist_result and isinstance(incoming_snapshot, dict):
        tailored_cv.content_snapshot = incoming_snapshot
        flag_modified(tailored_cv, "content_snapshot")

    if persist_result:
        tailored_cv.latest_humanity_report = _pack_humanity_cache(humanity, nodes, requested_mode)
        flag_modified(tailored_cv, "latest_humanity_report")
        db.commit()

    return {
        "success": True,
        "humanity": humanity
    }


@app.put("/api/tailor/{cv_id}")
async def update_tailored_cv(
    cv_id: int,
    update_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a tailored CV (node selections, status, notes, etc.)"""
    print(f"[UpdateTailoredCV] Starting - cv_id: {cv_id}")
    print(f"[UpdateTailoredCV] Received update_data keys: {update_data.keys()}")

    tailored_cv = db.query(TailoredCV).filter(
        TailoredCV.id == cv_id,
        TailoredCV.user_id == current_user.id
    ).first()

    if not tailored_cv:
        raise HTTPException(status_code=404, detail="Tailored CV not found")

    # Update content_snapshot with new node selections if provided
    if "content_snapshot" in update_data:
        new_snapshot = update_data['content_snapshot']

        # Count selected nodes for verification
        def count_selected(nodes):
            count = 0
            for node in nodes:
                if node.get('is_selected', False):
                    count += 1
                if node.get('children'):
                    count += count_selected(node.get('children', []))
            return count

        selected_count = count_selected(new_snapshot.get('nodes', [])) if new_snapshot else 0

        print(f"[UpdateTailoredCV] Updating content_snapshot:")
        print(f"  - New snapshot hash: {str(new_snapshot)[:100]}")
        print(f"  - Total nodes: {len(new_snapshot.get('nodes', []))}")
        print(f"  - Selected nodes count: {selected_count}")
        print(f"  - Has contact_info: {bool(new_snapshot.get('contact_info'))}")

        tailored_cv.content_snapshot = new_snapshot

        # Mark as modified for SQLAlchemy to detect JSON changes
        flag_modified(tailored_cv, "content_snapshot")

    # Update selected_node_ids if provided
    if "selected_node_ids" in update_data:
        print(f"[UpdateTailoredCV] Updating selected_node_ids: {len(update_data['selected_node_ids'])} nodes")
        tailored_cv.selected_node_ids = update_data["selected_node_ids"]

    # Update status if provided
    if "status" in update_data:
        tailored_cv.status = update_data["status"]

    # Update notes if provided
    if "notes" in update_data:
        tailored_cv.notes = update_data["notes"]

    tailored_cv.updated_at = datetime.utcnow()

    # Commit and flush to ensure data is written to DB
    db.commit()
    db.flush()

    # Refresh to get the committed state
    db.refresh(tailored_cv)

    print(f"[UpdateTailoredCV] Successfully COMMITTED to DB:")
    print(f"  - Updated at: {tailored_cv.updated_at}")
    print(f"  - Snapshot in DB now has {len(tailored_cv.content_snapshot.get('nodes', []))} nodes" if tailored_cv.content_snapshot else "  - No snapshot")

    return {
        "success": True,
        "message": "Tailored CV updated",
        "updated_at": tailored_cv.updated_at.isoformat()
    }


@app.put("/api/tailor/{cv_id}/contact-info")
async def update_cv_contact_info(
    cv_id: int,
    contact_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update contact information for a specific tailored CV.
    This allows customizing contact details per-CV without affecting the master profile.
    """
    tailored_cv = db.query(TailoredCV).filter(
        TailoredCV.id == cv_id,
        TailoredCV.user_id == current_user.id
    ).first()

    if not tailored_cv:
        raise HTTPException(status_code=404, detail="Tailored CV not found")

    # Update contact_info in content_snapshot
    if not tailored_cv.content_snapshot:
        tailored_cv.content_snapshot = {}

    tailored_cv.content_snapshot['contact_info'] = contact_data

    # Mark the JSON column as modified (important for SQLAlchemy to detect changes)
    flag_modified(tailored_cv, "content_snapshot")

    tailored_cv.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(tailored_cv)

    return {
        "success": True,
        "message": "Contact info updated successfully",
        "contact_info": tailored_cv.content_snapshot.get('contact_info'),
        "updated_at": tailored_cv.updated_at.isoformat()
    }


@app.post("/api/tailor/{cv_id}/contact-info/reset")
async def reset_cv_contact_info(
    cv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reset contact information for a CV to the user's current profile defaults.
    """
    tailored_cv = db.query(TailoredCV).filter(
        TailoredCV.id == cv_id,
        TailoredCV.user_id == current_user.id
    ).first()

    if not tailored_cv:
        raise HTTPException(status_code=404, detail="Tailored CV not found")

    # Get current user contact info
    user_contact_info = {
        "full_name": current_user.full_name,
        "email": current_user.email,
        "phone_number": current_user.phone_number,
        "country": current_user.country,
        "city": current_user.city,
        "linkedin_url": current_user.linkedin_url,
        "github_url": current_user.github_url,
        "portfolio_url": current_user.portfolio_url,
        "professional_title": current_user.professional_title
    }

    # Initialize _active_fields based on which fields have values
    active_fields = {}
    for key, value in user_contact_info.items():
        active_fields[key] = bool(value)
    user_contact_info["_active_fields"] = active_fields

    # Reset to current profile defaults
    if not tailored_cv.content_snapshot:
        tailored_cv.content_snapshot = {}

    tailored_cv.content_snapshot['contact_info'] = user_contact_info

    flag_modified(tailored_cv, "content_snapshot")
    tailored_cv.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(tailored_cv)

    return {
        "success": True,
        "message": "Contact info reset to profile defaults",
        "contact_info": user_contact_info,
        "updated_at": tailored_cv.updated_at.isoformat()
    }


@app.post("/api/tailor/{cv_id}/restore-original")
async def restore_original_snapshot(
    cv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Restore the CV to its original state by reverting content_snapshot to original_snapshot.
    This removes all AI refinements and manual edits, returning to the pristine state.
    """
    tailored_cv = db.query(TailoredCV).filter(
        TailoredCV.id == cv_id,
        TailoredCV.user_id == current_user.id
    ).first()

    if not tailored_cv:
        raise HTTPException(status_code=404, detail="Tailored CV not found")

    if not tailored_cv.original_snapshot:
        raise HTTPException(
            status_code=400,
            detail="No original snapshot available for this CV. This CV may have been created before the restore feature was added."
        )

    print(f"[RestoreOriginal] Restoring CV {cv_id} to original state")

    # Create a deep copy of original_snapshot to avoid reference issues
    import copy
    restored_snapshot = copy.deepcopy(tailored_cv.original_snapshot)

    # Replace content_snapshot with the original
    tailored_cv.content_snapshot = restored_snapshot

    # Rebuild selected_node_ids from the original snapshot's nodes
    def collect_selected_nodes(nodes, selected_list):
        """Recursively collect all nodes marked as selected"""
        for node in nodes:
            if node.get('is_selected') and node.get('global_id'):
                selected_list.append({
                    "id": node.get('id'),
                    "global_id": node.get('global_id')
                })
            if node.get('children'):
                collect_selected_nodes(node['children'], selected_list)

    selected_nodes_list = []
    if restored_snapshot.get('nodes'):
        collect_selected_nodes(restored_snapshot['nodes'], selected_nodes_list)

    tailored_cv.selected_node_ids = selected_nodes_list

    db.commit()
    db.refresh(tailored_cv)

    print(f"[RestoreOriginal] Successfully restored CV {cv_id}. Selected nodes: {len(selected_nodes_list)}")

    return {
        "success": True,
        "message": "CV restored to original state. All refinements and edits have been removed.",
        "content_snapshot": tailored_cv.content_snapshot,
        "selected_node_ids": tailored_cv.selected_node_ids,
        "updated_at": tailored_cv.updated_at.isoformat()
    }


@app.post("/api/tailor/{cv_id}/recalculate-scores")
async def recalculate_ats_scores(
    cv_id: int,
    request_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Recalculate ATS and fit scores based on current CV content selections.
    Sends the formatted CV content to AI models for fresh scoring.
    """
    from format_hierarchical_cv import format_hierarchical_cv_for_ai

    tailored_cv = db.query(TailoredCV).filter(
        TailoredCV.id == cv_id,
        TailoredCV.user_id == current_user.id
    ).first()

    if not tailored_cv:
        raise HTTPException(status_code=404, detail="Tailored CV not found")

    # Get the updated content snapshot from request
    content_snapshot = request_data.get('content_snapshot')
    if not content_snapshot:
        raise HTTPException(status_code=400, detail="content_snapshot required")
    include_humanity = bool(request_data.get("include_humanity", True))

    print(f"[RecalculateScores] Received content_snapshot from frontend")
    print(f"  - Number of nodes: {len(content_snapshot.get('nodes', []))}")

    # Count selected nodes
    def count_selected(nodes):
        count = 0
        for node in nodes:
            if node.get('is_selected', False):
                count += 1
            if node.get('children'):
                count += count_selected(node.get('children', []))
        return count
    selected_count = count_selected(content_snapshot.get('nodes', []))
    print(f"  - Selected nodes: {selected_count}")

    # IMPORTANT: Save the updated content_snapshot to the tailored_cv
    # This ensures that when we create a job application later, it has the latest nodes
    tailored_cv.content_snapshot = content_snapshot
    flag_modified(tailored_cv, "content_snapshot")
    print(f"[RecalculateScores] Updated tailored_cv.content_snapshot with latest data")

    # Format CV content for AI (only selected nodes)
    formatted_cv = format_hierarchical_cv_for_ai(
        content_snapshot,
        job_title=tailored_cv.job_title or "",
        company_name=tailored_cv.company_name or ""
    )
    ai_settings = get_user_ai_settings(current_user)

    humanity_report = None
    if include_humanity:
        humanity_report = ai_tailor_service.evaluate_humanity_hybrid(
            text=formatted_cv,
            threshold=_humanity_threshold(),
            mode="deep",
            llm_enabled=ai_settings["humanity_deep_mode_enabled"],
            llm_model=ai_settings["humanity_llm_model"],
            llm_reasoning_effort=ai_settings["humanity_llm_reasoning_effort"]
        )

    # Get job analysis (reuse existing one)
    job_analysis = tailored_cv.job_analysis
    if not job_analysis:
        raise HTTPException(status_code=400, detail="Job analysis not found for this CV")

    def get_analysis_for_provider(provider: str):
        provider_data = job_analysis.get(provider) if isinstance(job_analysis, dict) else None
        if isinstance(provider_data, dict) and provider_data.get("success") and isinstance(provider_data.get("analysis"), dict):
            return provider_data["analysis"], f"{provider}_analysis"

        # Fallback to the other provider's analysis if available
        other_provider = "claude" if provider == "openai" else "openai"
        other_data = job_analysis.get(other_provider) if isinstance(job_analysis, dict) else None
        if isinstance(other_data, dict) and other_data.get("success") and isinstance(other_data.get("analysis"), dict):
            return other_data["analysis"], f"fallback_{other_provider}_analysis"

        return {}, "no_analysis_available"

    openai_requirements, openai_requirements_source = get_analysis_for_provider("openai")
    claude_requirements, claude_requirements_source = get_analysis_for_provider("claude")
    job_description = tailored_cv.job_description or ""

    # Use the exact same scoring services/prompts as Tailor CV step
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor(max_workers=2) as executor:
        openai_future = loop.run_in_executor(
            executor,
            ai_tailor_service.score_profile_with_openai,
            openai_requirements,
            formatted_cv,
            job_description,
            ai_settings["openai_model"],
            ai_settings["openai_reasoning_effort"]
        )
        claude_future = loop.run_in_executor(
            executor,
            ai_tailor_service.score_profile_with_claude,
            claude_requirements,
            formatted_cv,
            job_description,
            ai_settings["claude_model"]
        )

        openai_result, claude_result = await asyncio.gather(openai_future, claude_future)

    # Store recalculated scores separately (don't override original scores)
    # Keep original scores from initial tailoring
    if not hasattr(tailored_cv, 'recalculated_scores') or tailored_cv.recalculated_scores is None:
        # Initialize recalculated_scores if it doesn't exist
        tailored_cv.recalculated_scores = []

    # Get existing recalculated scores or initialize empty list
    recalc_history = tailored_cv.recalculated_scores if tailored_cv.recalculated_scores else []

    # Add new recalculation to history (same scoring payload shape as Tailor CV step)
    recalc_history.append({
        "timestamp": datetime.utcnow().isoformat(),
        "formatted_cv": formatted_cv,
        "fit_scores": {
            "openai": openai_result,
            "claude": claude_result
        },
        "ats_scores": {
            "openai": openai_result,
            "claude": claude_result
        },
        "requirements_source": {
            "openai": openai_requirements_source,
            "claude": claude_requirements_source
        },
        "prompts": {
            "openai": {
                "user_prompt": openai_result.get("prompt_sent", "")
            },
            "claude": {
                "user_prompt": claude_result.get("prompt_sent", "")
            }
        },
        "humanity": humanity_report
    })

    tailored_cv.recalculated_scores = recalc_history
    if include_humanity and humanity_report:
        tailored_cv.latest_humanity_report = _pack_humanity_cache(
            humanity_report,
            content_snapshot.get("nodes", []),
            "deep"
        )
    # CRITICAL: Mark JSONB columns as modified so SQLAlchemy detects the change
    flag_modified(tailored_cv, "recalculated_scores")
    flag_modified(tailored_cv, "content_snapshot")
    if include_humanity and humanity_report:
        flag_modified(tailored_cv, "latest_humanity_report")
    tailored_cv.updated_at = datetime.utcnow()

    db.commit()
    db.flush()
    db.refresh(tailored_cv)

    # Verify what was saved
    final_selected_count = count_selected(tailored_cv.content_snapshot.get('nodes', []))
    print(f"[RecalculateScores] COMMITTED to DB successfully:")
    print(f"  - Content snapshot nodes: {len(tailored_cv.content_snapshot.get('nodes', []))}")
    print(f"  - Selected nodes in DB: {final_selected_count}")
    print(f"  - Recalculation timestamp: {recalc_history[-1]['timestamp']}")
    print(f"  - Updated at: {tailored_cv.updated_at}")

    return {
        "success": True,
        "message": "Scores recalculated successfully",
        "recalculation": recalc_history[-1],  # Return the latest recalculation
        "original_fit_scores": tailored_cv.fit_scores,  # Keep original scores visible
        "original_ats_scores": tailored_cv.ats_scores,
        "humanity": humanity_report,
        "updated_at": tailored_cv.updated_at.isoformat()
    }


def extract_section_content_as_markdown(section_node: dict) -> str:
    """
    Extract section content from content_snapshot node as markdown.
    Only includes selected nodes.

    Args:
        section_node: A section node from content_snapshot with children

    Returns:
        Markdown formatted string of the section content
    """
    lines = []

    # Add section title
    if section_node.get('title'):
        lines.append(f"## {section_node['title']}\n")

    def render_node(node, level=0, entry_depth=0):
        """Recursively render a node and its children as markdown

        Args:
            node: The node to render
            level: Indentation level for bullets (0, 1, 2, ...)
            entry_depth: Depth of entry nesting (0=top-level entry, 1=nested entry, etc.)
        """
        # Skip unselected nodes
        if node.get('is_selected') is False:
            return

        node_type = node.get('node_type', '')

        if node_type == 'entry':
            # Entry header with proper markdown heading level based on nesting depth
            # entry_depth 0 (top-level entry) => ### (h3)
            # entry_depth 1 (nested entry) => #### (h4)
            # entry_depth 2 (deeply nested) => ##### (h5)
            heading_level = 3 + entry_depth  # Start at h3 (###) for top-level entries
            heading_prefix = '#' * heading_level
            lines.append(f"\n{heading_prefix} {node.get('title', 'Untitled')}")

            if node.get('subtitle'):
                lines.append(f"*{node['subtitle']}*")

            # Metadata line (location | dates)
            metadata_parts = []
            if node.get('location'):
                metadata_parts.append(node['location'])
            if node.get('start_date'):
                date_range = f"{node['start_date']}"
                if node.get('end_date'):
                    date_range += f" - {node['end_date']}"
                else:
                    date_range += " - Present"
                metadata_parts.append(date_range)
            if metadata_parts:
                lines.append(" | ".join(metadata_parts))

            # Entry content (if any)
            if node.get('content'):
                lines.append(f"\n{node['content']}")

            lines.append("")  # Blank line after entry

        elif node_type == 'bullet' or node_type == 'item':
            indent = "  " * level
            content = node.get('content', node.get('title', ''))
            lines.append(f"{indent}- {content}")

        elif node_type == 'paragraph':
            content = node.get('content', '')
            lines.append(f"\n{content}\n")

        # Recurse through children
        # If this node is an entry, increment entry_depth for nested entries
        next_entry_depth = entry_depth + 1 if node_type == 'entry' else entry_depth
        for child in node.get('children', []):
            render_node(child, level + 1, next_entry_depth)

    # Render all children of the section (starting at entry_depth 0)
    for child in section_node.get('children', []):
        render_node(child, level=0, entry_depth=0)

    return "\n".join(lines)


def extract_full_cv_content_as_markdown(nodes: list) -> str:
    """
    Extract all selected content from all sections as markdown.
    This provides full CV context for AI refinement.

    Args:
        nodes: List of all nodes from content_snapshot

    Returns:
        Markdown formatted string of the entire CV content (all selected sections)
    """
    full_cv_parts = []

    # Find all section nodes and extract their content
    def find_sections(node_list):
        sections = []
        for node in node_list:
            if node.get('node_type') == 'section':
                # Only include if section itself is selected (or is_selected is not explicitly False)
                if node.get('is_selected') is not False:
                    sections.append(node)
            # Also check children for nested sections
            if node.get('children'):
                sections.extend(find_sections(node.get('children', [])))
        return sections

    all_sections = find_sections(nodes)

    # Extract markdown for each section
    for section in all_sections:
        section_content = extract_section_content_as_markdown(section)
        if section_content.strip():  # Only add non-empty sections
            full_cv_parts.append(section_content)

    return "\n\n---\n\n".join(full_cv_parts)


@app.post("/api/tailor/{cv_id}/refine-section")
async def refine_section(
    cv_id: int,
    request_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Refine a specific section using AI.

    Request body:
    {
        "section_id": int,  # The section node's database ID
        "user_instructions": str (optional)  # User's custom instructions
    }

    Returns:
    {
        "success": bool,
        "refined_content": str,  # Markdown content
        "changes_summary": str,
        "stats": {...},
        "prompt_sent": str,
        "original_content": str
    }
    """
    from ai_tailor_service import refine_section_content_with_openai

    # Get the tailored CV
    tailored_cv = db.query(TailoredCV).filter(
        TailoredCV.id == cv_id,
        TailoredCV.user_id == current_user.id
    ).first()

    if not tailored_cv:
        raise HTTPException(status_code=404, detail="Tailored CV not found")

    # Validate request - support both old (section_id) and new (node_id) parameters
    node_id = request_data.get('node_id') or request_data.get('section_id')
    if node_id is None:
        raise HTTPException(status_code=400, detail="node_id is required")

    requested_node_type = request_data.get('node_type')
    user_instructions = request_data.get('user_instructions', None)
    reasoning_effort = request_data.get('reasoning_effort', None)  # User's choice: none, low, medium, high
    rewrite_mode = request_data.get('rewrite_mode', 'minimal')
    human_strict = bool(request_data.get('human_strict', True))
    target_pages_raw = request_data.get('target_pages', None)
    try:
        target_pages = int(target_pages_raw) if target_pages_raw is not None else None
    except (TypeError, ValueError):
        target_pages = None
    if target_pages not in (1, 2):
        target_pages = None

    # Find the node in content_snapshot
    content_snapshot = tailored_cv.content_snapshot
    if not content_snapshot or not content_snapshot.get('nodes'):
        raise HTTPException(status_code=400, detail="No content snapshot found")

    # Find node by ID - accepts both sections and entries
    target_node = None
    def find_node_by_id(nodes, target_id, allowed_types=['section', 'entry']):
        """Find a node by ID, accepting multiple node types"""
        for node in nodes:
            if node.get('id') == target_id:
                # If node_type was specified, verify it matches
                if requested_node_type and node.get('node_type') != requested_node_type:
                    continue
                # Check if this node type is allowed for refinement
                if node.get('node_type') in allowed_types:
                    return node
            # Also check children recursively
            if node.get('children'):
                found = find_node_by_id(node.get('children', []), target_id, allowed_types)
                if found:
                    return found
        return None

    target_node = find_node_by_id(content_snapshot['nodes'], node_id)

    if not target_node:
        raise HTTPException(status_code=404, detail=f"Node with ID {node_id} not found or not refinable")

    # Determine node type
    node_type = target_node.get('node_type', 'section')

    # Extract node content as markdown
    node_content = extract_section_content_as_markdown(target_node)

    # Validate content based on node type
    if node_type == 'section':
        if not node_content or node_content.strip() == f"## {target_node.get('title', '')}\n":
            raise HTTPException(status_code=400, detail="Section has no content to refine")
    elif node_type == 'entry':
        if not node_content or node_content.strip() == f"### {target_node.get('title', '')}\n":
            raise HTTPException(status_code=400, detail="Entry has no content to refine")

    # Extract FULL CV content for context (all selected sections)
    full_cv_content = extract_full_cv_content_as_markdown(content_snapshot['nodes'])

    if not full_cv_content or full_cv_content.strip() == "":
        raise HTTPException(status_code=400, detail="No CV content found")

    # Get job description
    job_description = tailored_cv.job_description
    if not job_description:
        raise HTTPException(status_code=400, detail="No job description found for this CV")

    # Get node title for summary detection
    node_title = target_node.get('title', '')
    ai_settings = get_user_ai_settings(current_user)

    # Call AI service with full CV context, node type, title, and reasoning effort
    result = refine_section_content_with_openai(
        section_content=node_content,
        full_cv_content=full_cv_content,
        job_description=job_description,
        user_instructions=user_instructions,
        node_type=node_type,
        node_title=node_title,
        reasoning_effort=reasoning_effort,
        rewrite_mode=rewrite_mode,
        human_strict=human_strict,
        target_pages=target_pages,
        humanity_llm_enabled=ai_settings["humanity_deep_mode_enabled"],
        humanity_llm_model=ai_settings["humanity_llm_model"],
        humanity_llm_reasoning_effort=ai_settings["humanity_llm_reasoning_effort"]
    )

    # Add metadata to response for comparison and tracking
    result['original_content'] = node_content
    result['node_type'] = node_type
    result['node_id'] = node_id
    result['node_title'] = target_node.get('title', f'Untitled {node_type.title()}')
    # Keep backward compatibility
    result['section_title'] = result['node_title']

    # Add AI model information for UI display
    import os
    # Determine actual reasoning effort used (only use .env if reasoning_effort is None/empty)
    actual_reasoning = reasoning_effort if reasoning_effort is not None else os.getenv('OPENAI_REASONING_EFFORT', 'medium')

    # Always GPT-5.1, but display reasoning mode
    if actual_reasoning and actual_reasoning.lower() == 'none':
        model_name = 'GPT-5.1 (No Reasoning)'
    else:
        model_name = 'GPT-5.1 Thinking'

    result['ai_info'] = {
        'model': model_name,
        'reasoning_effort': actual_reasoning.title() if actual_reasoning else 'Medium',
        'reasoning_tokens': result.get('reasoning_tokens', 0),
        'rewrite_mode': rewrite_mode,
        'human_strict': human_strict,
        'target_pages': target_pages
    }

    return result


@app.post("/api/tailor/{cv_id}/apply-refinement")
async def apply_refinement(
    cv_id: int,
    request_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Apply AI-refined content by replacing the children of the target node.

    Request body:
    {
        "node_id": int,  # The target node (section or entry)
        "node_type": str,  # "section" or "entry"
        "refined_nodes": list,  # Array of new child nodes to replace existing children
        "operation": str  # "replace_children" (for now, only this operation)
    }

    Returns:
    {
        "success": bool,
        "message": str,
        "updated_content_snapshot": dict
    }
    """
    # Get the tailored CV
    tailored_cv = db.query(TailoredCV).filter(
        TailoredCV.id == cv_id,
        TailoredCV.user_id == current_user.id
    ).first()

    if not tailored_cv:
        raise HTTPException(status_code=404, detail="Tailored CV not found")

    # Validate request
    node_id = request_data.get('node_id')
    node_type = request_data.get('node_type')
    refined_nodes = request_data.get('refined_nodes', [])
    operation = request_data.get('operation', 'merge_children')
    node_selections = request_data.get('node_selections', {})

    if node_id is None:
        raise HTTPException(status_code=400, detail="node_id is required")
    if not refined_nodes:
        raise HTTPException(status_code=400, detail="refined_nodes is required")

    # Get content snapshot
    content_snapshot = tailored_cv.content_snapshot
    if not content_snapshot or not content_snapshot.get('nodes'):
        raise HTTPException(status_code=400, detail="No content snapshot found")

    # Find and update the target node
    def find_and_update_node(nodes, target_id):
        """Recursively find the target node and update its children"""
        for i, node in enumerate(nodes):
            if node.get('id') == target_id:
                # Found the target node
                if operation == 'merge_children':
                    # Keep unselected children, remove selected ones, add refined ones
                    unselected_children = []
                    for child in node.get('children', []):
                        global_id = child.get('global_id')
                        # Keep nodes that were NOT selected (not sent to AI)
                        if global_id and node_selections.get(global_id) == False:
                            unselected_children.append(child)

                    # Combine: unselected children (kept) + refined nodes (new)
                    node['children'] = unselected_children + refined_nodes
                    return True
                elif operation == 'replace_children':
                    # Legacy operation - replace all children
                    node['children'] = refined_nodes
                    return True
            # Recurse into children
            if node.get('children'):
                if find_and_update_node(node['children'], target_id):
                    return True
        return False

    success = find_and_update_node(content_snapshot['nodes'], node_id)

    if not success:
        raise HTTPException(status_code=404, detail=f"Node with ID {node_id} not found")

    # Update the content_snapshot in database
    tailored_cv.content_snapshot = content_snapshot
    db.commit()
    db.refresh(tailored_cv)

    return {
        "success": True,
        "message": f"Successfully applied refinement to {node_type}",
        "updated_content_snapshot": content_snapshot
    }


@app.delete("/api/tailor/{cv_id}")
async def delete_tailored_cv(
    cv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a tailored CV"""
    tailored_cv = db.query(TailoredCV).filter(
        TailoredCV.id == cv_id,
        TailoredCV.user_id == current_user.id
    ).first()

    if not tailored_cv:
        raise HTTPException(status_code=404, detail="Tailored CV not found")

    db.delete(tailored_cv)
    db.commit()

    return {"success": True, "message": "Tailored CV deleted"}


# ============================================================================
# Health Check & Version
# ============================================================================

@app.get("/")
def root():
    return {
        "message": "Work Profile API - Hierarchical Structure v3.0",
        "status": "running",
        "features": [
            "Universal ProfileNode model",
            "Infinite nesting capability",
            "Global ID tracking",
            "Flexible metadata"
        ]
    }


# ============================================================================
# Job Application Endpoints (Application Tracker)
# ============================================================================

@app.post("/api/applications/create", response_model=JobApplicationResponse)
async def create_job_application(
    application_data: JobApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new job application from a tailored CV.
    This saves the current state as a finalized application ready for tracking.
    """
    print(f"[CreateJobApp] Starting - tailored_cv_id: {application_data.tailored_cv_id}")

    # CRITICAL: Force a fresh read from database to avoid stale cached data
    # First expire all cached objects
    db.expire_all()

    # Then commit any pending transactions to ensure we see latest data
    db.commit()

    # Now query with a fresh transaction
    tailored_cv = db.query(TailoredCV).filter(
        TailoredCV.id == application_data.tailored_cv_id,
        TailoredCV.user_id == current_user.id
    ).first()

    if not tailored_cv:
        raise HTTPException(status_code=404, detail="Tailored CV not found")

    # Force another refresh to be absolutely sure we have the latest JSONB data
    db.refresh(tailored_cv)

    # Also explicitly refresh the content_snapshot attribute
    db.refresh(tailored_cv, ['content_snapshot'])

    print(f"[CreateJobApp] Loaded tailored_cv from DB (FRESH):")
    print(f"  - content_snapshot hash: {str(tailored_cv.content_snapshot)[:100] if tailored_cv.content_snapshot else 'None'}")
    print(f"  - recalculated_scores length: {len(tailored_cv.recalculated_scores) if tailored_cv.recalculated_scores else 0}")
    print(f"  - updated_at: {tailored_cv.updated_at}")

    # Log the actual nodes to verify what we're getting
    if tailored_cv.content_snapshot and 'nodes' in tailored_cv.content_snapshot:
        print(f"  - Number of nodes in snapshot: {len(tailored_cv.content_snapshot['nodes'])}")
        # Count selected nodes
        def count_selected(nodes, depth=0):
            count = 0
            for node in nodes:
                if node.get('is_selected', False):
                    count += 1
                if node.get('children'):
                    count += count_selected(node.get('children', []), depth+1)
            return count
        selected_count = count_selected(tailored_cv.content_snapshot['nodes'])
        print(f"  - Number of SELECTED nodes: {selected_count}")

    # Get the latest recalculated scores if available
    final_fit_scores = tailored_cv.fit_scores
    final_ats_scores = tailored_cv.ats_scores
    score_history = []

    if tailored_cv.recalculated_scores and len(tailored_cv.recalculated_scores) > 0:
        # Get the most recent recalculated scores
        latest_recalc = tailored_cv.recalculated_scores[-1]
        final_fit_scores = latest_recalc.get("fit_scores", tailored_cv.fit_scores)
        final_ats_scores = latest_recalc.get("ats_scores", tailored_cv.ats_scores)

        print(f"[CreateJobApp] Using recalculated scores:")
        print(f"  - latest_recalc timestamp: {latest_recalc.get('timestamp')}")
        print(f"  - latest_recalc fit_scores: {final_fit_scores}")

        # Build score history from recalculated_scores
        score_history = [
            {
                "timestamp": recalc.get("timestamp"),
                "fit_scores": recalc.get("fit_scores"),
                "ats_scores": recalc.get("ats_scores")
            }
            for recalc in tailored_cv.recalculated_scores
        ]
    else:
        print(f"[CreateJobApp] No recalculated scores, using initial scores")

    # Update the tailored CV status to "ready_to_apply"
    tailored_cv.status = "ready_to_apply"
    tailored_cv.updated_at = datetime.utcnow()

    # Create the job application
    current_time = datetime.utcnow()
    job_application = JobApplication(
        user_id=current_user.id,
        tailored_cv_id=tailored_cv.id,
        job_title=tailored_cv.job_title,
        company_name=tailored_cv.company_name,
        job_description=tailored_cv.job_description,
        job_url=application_data.job_url,
        location=application_data.location,
        final_content_snapshot=tailored_cv.content_snapshot,  # Current state with active contact fields
        cv_format=application_data.cv_format,
        pdf_customizations=application_data.pdf_customizations,  # Save PDF settings
        initial_fit_scores=tailored_cv.fit_scores,
        initial_ats_scores=tailored_cv.ats_scores,
        final_fit_scores=final_fit_scores,
        final_ats_scores=final_ats_scores,
        score_history=score_history,
        status="ready_to_apply",  # Finalized and ready for submission
        ready_date=current_time,  # Set timestamp for ready_to_apply status
        notes=application_data.notes,
        cover_letter=application_data.cover_letter,
        priority=application_data.priority,
        finalized_at=current_time
    )

    print(f"[CreateJobApp] Creating job_application with:")
    print(f"  - final_content_snapshot hash: {str(job_application.final_content_snapshot)[:100] if job_application.final_content_snapshot else 'None'}")
    print(f"  - score_history length: {len(score_history)}")
    print(f"  - final_fit_scores: {final_fit_scores}")

    db.add(job_application)
    db.commit()
    db.refresh(job_application)

    print(f"[CreateJobApp] Successfully created job_application id: {job_application.id}")

    return job_application


@app.get("/api/applications/check-duplicate/{tailored_cv_id}")
async def check_duplicate_application(
    tailored_cv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Check if a job application already exists for this tailored CV.
    Returns the existing application if found, or None.
    """
    existing = db.query(JobApplication).filter(
        JobApplication.user_id == current_user.id,
        JobApplication.tailored_cv_id == tailored_cv_id
    ).first()

    if existing:
        return {
            "exists": True,
            "application_id": existing.id,
            "status": existing.status,
            "created_at": existing.created_at
        }

    return {"exists": False}


@app.post("/api/applications/{application_id}/download-pdf")
async def download_application_pdf(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate and download the PDF for a job application using saved settings.
    """
    # Get the job application
    job_app = db.query(JobApplication).filter(
        JobApplication.id == application_id,
        JobApplication.user_id == current_user.id
    ).first()

    if not job_app:
        raise HTTPException(status_code=404, detail="Job application not found")

    # Use the shared transformation function to ensure consistency
    sections = transform_nodes_to_sections(job_app.final_content_snapshot.get('nodes', []))

    # Apply section reordering from saved customizations
    customizations = job_app.pdf_customizations or {}
    section_order = customizations.get('sectionOrder', [])
    if section_order:
        try:
            section_map = {s['title']: s for s in sections}
            reordered_sections = [section_map[title] for title in section_order if title in section_map]
            remaining = [s for s in sections if s['title'] not in section_order]
            sections = reordered_sections + remaining
        except (KeyError, TypeError):
            pass  # Use original order on error

    selected_content = {
        'contact_info': job_app.final_content_snapshot.get('contact_info', {}),
        'sections': sections
    }

    cv_data = {
        "selected_content": selected_content
    }

    # Generate PDF using saved settings
    try:
        generator = pdf_service.CVPDFGenerator(
            template_name=job_app.cv_format,
            customizations=customizations
        )
        pdf_buffer = generator.generate_pdf(cv_data, hidden_items=[])

        filename = _build_cv_export_filename(
            job_title=job_app.job_title,
            company_name=job_app.company_name,
            full_name=current_user.full_name
        )

        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    except Exception as e:
        print(f"Error generating application PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")


@app.get("/api/applications/list", response_model=List[JobApplicationResponse])
async def list_job_applications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status: Optional[str] = None,
    priority: Optional[str] = None
):
    """
    List all job applications for the current user.
    Can filter by status and priority.
    Includes job_analysis from related TailoredCV.
    """
    query = db.query(JobApplication).filter(JobApplication.user_id == current_user.id)

    if status:
        query = query.filter(JobApplication.status == status)
    if priority:
        query = query.filter(JobApplication.priority == priority)

    applications = query.order_by(JobApplication.created_at.desc()).all()

    # Enrich with job_analysis from related TailoredCV
    result = []
    for app in applications:
        app_dict = {
            **{c.name: getattr(app, c.name) for c in app.__table__.columns},
            'job_analysis': app.tailored_cv.job_analysis if app.tailored_cv else None
        }
        result.append(app_dict)

    return result


@app.get("/api/applications/{application_id}", response_model=JobApplicationResponse)
async def get_job_application(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific job application by ID"""
    application = db.query(JobApplication).filter(
        JobApplication.id == application_id,
        JobApplication.user_id == current_user.id
    ).first()

    if not application:
        raise HTTPException(status_code=404, detail="Job application not found")

    return application


@app.put("/api/applications/{application_id}", response_model=JobApplicationResponse)
async def update_job_application(
    application_id: int,
    update_data: JobApplicationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a job application (status, dates, notes, etc.)"""
    application = db.query(JobApplication).filter(
        JobApplication.id == application_id,
        JobApplication.user_id == current_user.id
    ).first()

    if not application:
        raise HTTPException(status_code=404, detail="Job application not found")

    # Update fields
    update_fields = update_data.dict(exclude_unset=True)

    # Handle date clearing when moving backward in the process
    if 'clear_dates' in update_fields:
        clear_dates = update_fields.pop('clear_dates')
        if clear_dates:
            for date_field in clear_dates:
                if hasattr(application, date_field):
                    setattr(application, date_field, None)
                    print(f"[DateClear] Cleared {date_field} for application {application_id}")

    # If status is being updated, set the corresponding timestamp
    if 'status' in update_fields:
        new_status = update_fields['status']
        current_time = datetime.utcnow()

        # Map status to timestamp field and only set if not already set
        status_timestamp_map = {
            'ready_to_apply': 'ready_date',
            'applied': 'applied_date',
            'phone_screen': 'phone_screen_date',
            'interview': 'interview_date',
            'offer_received': 'offer_date',
            'accepted': 'accepted_date',
            'rejected': 'rejected_date',
            'withdrawn': 'withdrawn_date'
        }

        # Set timestamp for the new status if it hasn't been set before
        timestamp_field = status_timestamp_map.get(new_status)
        if timestamp_field and getattr(application, timestamp_field) is None:
            setattr(application, timestamp_field, current_time)

    for field, value in update_fields.items():
        setattr(application, field, value)

    application.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(application)

    return application


@app.delete("/api/applications/{application_id}")
async def delete_job_application(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a job application"""
    application = db.query(JobApplication).filter(
        JobApplication.id == application_id,
        JobApplication.user_id == current_user.id
    ).first()

    if not application:
        raise HTTPException(status_code=404, detail="Job application not found")

    db.delete(application)
    db.commit()

    return {"success": True, "message": "Job application deleted"}


@app.post("/api/applications/{application_id}/move-to-preparing")
async def move_application_to_preparing(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Move a job application back to preparing status.
    This updates the corresponding tailored_cv status to 'draft' and deletes the job_application.
    """
    # Get the job application
    application = db.query(JobApplication).filter(
        JobApplication.id == application_id,
        JobApplication.user_id == current_user.id
    ).first()

    if not application:
        raise HTTPException(status_code=404, detail="Job application not found")

    # Get the tailored CV ID
    tailored_cv_id = application.tailored_cv_id

    # Find the corresponding tailored CV
    tailored_cv = db.query(TailoredCV).filter(
        TailoredCV.id == tailored_cv_id,
        TailoredCV.user_id == current_user.id
    ).first()

    if not tailored_cv:
        raise HTTPException(
            status_code=404,
            detail="Corresponding tailored CV not found. Cannot move back to preparing."
        )

    # Update the tailored CV status to 'draft'
    tailored_cv.status = 'draft'

    # Delete the job application
    db.delete(application)

    # Commit both changes
    db.commit()

    return {
        "success": True,
        "message": "Application moved back to preparing status",
        "tailored_cv_id": tailored_cv_id
    }


@app.post("/api/tailor/{cv_id}/preview-pdf")
async def preview_tailored_cv_pdf(
    cv_id: int,
    request_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate PDF preview directly from TailoredCV without creating JobApplication"""
    # Expire cache and get fresh data
    db.expire_all()
    tailored_cv = db.query(TailoredCV).filter(
        TailoredCV.id == cv_id,
        TailoredCV.user_id == current_user.id
    ).first()

    if not tailored_cv:
        raise HTTPException(status_code=404, detail="Tailored CV not found")

    db.refresh(tailored_cv)

    # Get the content snapshot (current state with all edits)
    snapshot = tailored_cv.content_snapshot

    # Get cv_format from request, default to professional
    cv_format = request_data.get('cv_format', 'professional')

    # Get customizations from request (fontSize, spacing, colorIntensity)
    customizations = request_data.get('customizations', {})
    force_export = bool(request_data.get('force_export', False))

    # Use the shared transformation function to ensure consistency
    sections = transform_nodes_to_sections(snapshot.get('nodes', []))

    ai_settings = get_user_ai_settings(current_user)
    humanity_report = _evaluate_humanity_for_nodes(
        snapshot.get('nodes', []),
        mode="deep",
        ai_settings=ai_settings
    )
    _raise_if_humanity_blocked(humanity_report, force_export=force_export)

    # Apply section reordering if specified in customizations
    section_order = customizations.get('sectionOrder', [])
    if section_order:
        try:
            # Create mapping of title to section
            section_map = {s['title']: s for s in sections}
            # Reorder based on titles
            reordered_sections = [section_map[title] for title in section_order if title in section_map]
            # Add any sections not in the order list at the end
            remaining = [s for s in sections if s['title'] not in section_order]
            sections = reordered_sections + remaining
            print(f"[PreviewPDF] Sections reordered: {[s['title'] for s in sections]}")
        except (KeyError, TypeError) as e:
            print(f"[PreviewPDF] Error reordering sections: {e}, using original order")

    selected_content = {
        'contact_info': snapshot.get('contact_info', {}),
        'sections': sections
    }

    cv_data = {
        "selected_content": selected_content
    }

    # Generate PDF using the pdf_service
    try:
        pdf_buffer = pdf_service.generate_cv_pdf(
            cv_data=cv_data,
            hidden_items=[],  # Preview shows all selected content
            template_name=cv_format,
            customizations=customizations
        )
        filename = _build_cv_export_filename(
            job_title=tailored_cv.job_title,
            company_name=tailored_cv.company_name,
            full_name=current_user.full_name
        )

        # Return PDF as downloadable file
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    except Exception as e:
        print(f"Error generating preview PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate preview PDF: {str(e)}")


@app.post("/api/tailor/{cv_id}/preview-metadata")
async def get_cv_preview_metadata(
    cv_id: int,
    request_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get metadata about the CV PDF (page count, word count, etc.) without generating full PDF.
    Useful for live preview statistics (metadata endpoint).
    """
    print(f"[PreviewMetadata] Request for CV {cv_id}")
    # Get the tailored CV
    db.expire_all()
    tailored_cv = db.query(TailoredCV).filter(
        TailoredCV.id == cv_id,
        TailoredCV.user_id == current_user.id
    ).first()

    if not tailored_cv:
        raise HTTPException(status_code=404, detail="Tailored CV not found")

    db.refresh(tailored_cv)

    # Get parameters from request
    cv_format = request_data.get('cv_format', 'professional')
    customizations = request_data.get('customizations', {})

    # Get the content snapshot
    snapshot = tailored_cv.content_snapshot

    # Use the shared transformation function to ensure consistency
    sections = transform_nodes_to_sections(snapshot.get('nodes', []))

    # Apply section reordering if specified in customizations
    section_order = customizations.get('sectionOrder', [])
    if section_order:
        try:
            # Create mapping of title to section
            section_map = {s['title']: s for s in sections}
            # Reorder based on titles
            reordered_sections = [section_map[title] for title in section_order if title in section_map]
            # Add any sections not in the order list at the end
            remaining = [s for s in sections if s['title'] not in section_order]
            sections = reordered_sections + remaining
            print(f"[PreviewMetadata] Sections reordered: {[s['title'] for s in sections]}")
        except (KeyError, TypeError) as e:
            print(f"[PreviewMetadata] Error reordering sections: {e}, using original order")

    selected_content = {
        'contact_info': snapshot.get('contact_info', {}),
        'sections': sections
    }

    cv_data = {
        "selected_content": selected_content
    }

    # Get metadata using pdf_service
    try:
        metadata = pdf_service.get_cv_pdf_metadata(
            cv_data=cv_data,
            hidden_items=[],
            template_name=cv_format,
            customizations=customizations
        )

        return metadata

    except Exception as e:
        print(f"Error generating preview metadata: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate metadata: {str(e)}")


@app.post("/api/tailor/{cv_id}/preview-image")
async def get_cv_preview_image(
    cv_id: int,
    request_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate a PNG preview image of the CV's first page.
    Useful for live preview thumbnail (image endpoint).
    """
    print(f"[PreviewImage] Request for CV {cv_id}")
    # Get the tailored CV
    db.expire_all()
    tailored_cv = db.query(TailoredCV).filter(
        TailoredCV.id == cv_id,
        TailoredCV.user_id == current_user.id
    ).first()

    if not tailored_cv:
        raise HTTPException(status_code=404, detail="Tailored CV not found")

    db.refresh(tailored_cv)

    # Get parameters from request
    cv_format = request_data.get('cv_format', 'professional')
    customizations = request_data.get('customizations', {})
    page_index = request_data.get('page_index', 0)
    all_pages = request_data.get('all_pages', False)  # False = single page, True = all pages

    # Get the content snapshot
    snapshot = tailored_cv.content_snapshot

    # Transform nodes to sections (same logic as above)
    def transform_nodes_to_sections(nodes):
        """Transform hierarchical nodes into flat sections - ONLY SELECTED NODES"""
        sections = []

        def collect_bullets_recursively(node, depth=0):
            bullets = []
            for child in node.get('children', []):
                if not child.get('is_selected', False):
                    continue
                child_type = child.get('node_type')
                if child_type in ['bullet', 'paragraph']:
                    bullets.append({
                        'id': child.get('id', 0),
                        'content': child.get('content', ''),
                        'order': child.get('order', 0)
                    })
                elif child_type == 'entry':
                    sub_bullets = collect_bullets_recursively(child, depth + 1)
                    if sub_bullets:
                        bullets.append({'type': 'sub_entry', 'title': child.get('title'), 'items': sub_bullets})
                    elif child.get('content'):
                        bullets.append({'id': child.get('id', 0), 'content': child.get('content', ''), 'order': child.get('order', 0)})
                else:
                    sub_bullets = collect_bullets_recursively(child, depth + 1)
                    bullets.extend(sub_bullets)
            return bullets

        for node in nodes:
            if node.get('node_type') != 'section' or not node.get('is_selected', False):
                continue
            section = {'title': node.get('title', ''), 'section_type': node.get('title', '').lower().replace(' ', '_'), 'entries': []}
            for child in node.get('children', []):
                if not child.get('is_selected', False):
                    continue
                child_type = child.get('node_type')
                if child_type in ['bullet', 'paragraph']:
                    section['entries'].append({'title': None, 'items': [{'id': child.get('id', 0), 'content': child.get('content', ''), 'order': child.get('order', 0)}]})
                elif child_type == 'entry':
                    all_bullets = collect_bullets_recursively(child, depth=1)
                    regular_bullets = [b for b in all_bullets if not isinstance(b, dict) or b.get('type') != 'sub_entry']
                    sub_entries_data = [b for b in all_bullets if isinstance(b, dict) and b.get('type') == 'sub_entry']
                    entry = {
                        'title': child.get('title'),
                        'subtitle': child.get('subtitle'),
                        'start_date': child.get('start_date'),
                        'end_date': child.get('end_date'),
                        'location': child.get('location'),
                        'description': child.get('content') if child.get('content_type') == 'text' else None,
                        'items': regular_bullets,
                        'sub_entries': sub_entries_data
                    }
                    if entry['items'] or entry['sub_entries'] or entry['description'] or entry['title']:
                        section['entries'].append(entry)
            if section['entries']:
                sections.append(section)
        return sections

    # Build selected_content structure
    sections = transform_nodes_to_sections(snapshot.get('nodes', []))

    # Apply section reordering if specified in customizations
    section_order = customizations.get('sectionOrder', [])
    if section_order:
        try:
            # Create mapping of title to section
            section_map = {s['title']: s for s in sections}
            # Reorder based on titles
            reordered_sections = [section_map[title] for title in section_order if title in section_map]
            # Add any sections not in the order list at the end
            remaining = [s for s in sections if s['title'] not in section_order]
            sections = reordered_sections + remaining
            print(f"[PreviewImage] Sections reordered: {[s['title'] for s in sections]}")
        except (KeyError, TypeError) as e:
            print(f"[PreviewImage] Error reordering sections: {e}, using original order")

    selected_content = {
        'contact_info': snapshot.get('contact_info', {}),
        'sections': sections
    }

    cv_data = {
        "selected_content": selected_content
    }

    # Generate preview image using pdf_service
    try:
        if all_pages:
            # Generate all pages for full-size modal
            print(f"[PreviewImage] Generating all pages preview")
            image_buffer = pdf_service.generate_cv_preview_all_pages(
                cv_data=cv_data,
                hidden_items=[],
                template_name=cv_format,
                customizations=customizations,
                scale=1.5  # Good quality for preview
            )
        else:
            # Generate single page (first page) for thumbnail
            print(f"[PreviewImage] Generating single page preview (page {page_index})")
            image_buffer = pdf_service.generate_cv_preview_image(
                cv_data=cv_data,
                hidden_items=[],
                template_name=cv_format,
                customizations=customizations,
                page_index=page_index,
                scale=2.0  # Higher quality for single page
            )

        return StreamingResponse(
            image_buffer,
            media_type="image/png",
            headers={
                "Cache-Control": "no-cache"  # Don't cache previews as they change frequently
            }
        )

    except Exception as e:
        print(f"Error generating preview image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate preview image: {str(e)}")


@app.post("/api/applications/{application_id}/export-pdf")
async def export_application_pdf(
    application_id: int,
    request_data: Optional[dict] = Body(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export job application as PDF with selected format"""
    # Get the job application
    application = db.query(JobApplication).filter(
        JobApplication.id == application_id,
        JobApplication.user_id == current_user.id
    ).first()

    if not application:
        raise HTTPException(status_code=404, detail="Job application not found")

    # Get the CV format (professional, modern, compact, creative)
    cv_format = application.cv_format or "professional"

    # Get the finalized content snapshot and transform it for PDF service
    snapshot = application.final_content_snapshot
    force_export = bool((request_data or {}).get("force_export", False))
    ai_settings = get_user_ai_settings(current_user)
    humanity_report = _evaluate_humanity_for_nodes(
        (snapshot or {}).get("nodes", []),
        mode="deep",
        ai_settings=ai_settings
    )
    _raise_if_humanity_blocked(humanity_report, force_export=force_export)

    # Transform hierarchical nodes to flat sections for PDF service
    def transform_nodes_to_sections(nodes):
        """
        Transform hierarchical nodes into flat sections with entries - ONLY SELECTED NODES.
        Handles any nesting level dynamically (not hardcoded to specific levels).
        """
        sections = []

        print(f"[ExportPDF] Transforming nodes for PDF - total root nodes: {len(nodes)}")

        # Helper function to recursively collect all bullets from any depth
        def collect_bullets_recursively(node, depth=0):
            """Recursively collect all selected bullets/paragraphs from this node and its children"""
            bullets = []
            indent = "  " * depth

            for child in node.get('children', []):
                if not child.get('is_selected', False):
                    continue  # Skip unselected nodes

                child_type = child.get('node_type')
                print(f"{indent}[ExportPDF] Processing {child_type} at depth {depth}: {child.get('title', child.get('content', '')[:30])}")

                # If this child is a bullet/paragraph, add it
                if child_type in ['bullet', 'paragraph']:
                    bullets.append({
                        'id': child.get('id', 0),
                        'content': child.get('content', ''),
                        'order': child.get('order', 0)
                    })
                    print(f"{indent}  ✓ Added bullet")

                # If this child is an entry, treat it as a sub-entry
                elif child_type == 'entry':
                    # Recursively collect bullets from this entry
                    sub_bullets = collect_bullets_recursively(child, depth + 1)
                    if sub_bullets:
                        # This is a sub-entry with its own bullets
                        bullets.append({
                            'type': 'sub_entry',
                            'title': child.get('title'),
                            'items': sub_bullets
                        })
                        print(f"{indent}  ✓ Added sub-entry with {len(sub_bullets)} bullets")
                    elif child.get('content'):
                        # Entry with just content, no bullets
                        bullets.append({
                            'id': child.get('id', 0),
                            'content': child.get('content', ''),
                            'order': child.get('order', 0)
                        })

                # For any other type, recurse into children
                else:
                    sub_bullets = collect_bullets_recursively(child, depth + 1)
                    bullets.extend(sub_bullets)

            return bullets

        for node in nodes:
            # Level 0 must always be 'section'
            if node.get('node_type') != 'section' or not node.get('is_selected', False):
                continue

            section = {
                'title': node.get('title', ''),
                'section_type': node.get('title', '').lower().replace(' ', '_'),
                'entries': []
            }

            print(f"[ExportPDF] Processing section: {section['title']}")

            # Process all children dynamically - could be entries, bullets, paragraphs at any level
            for child in node.get('children', []):
                if not child.get('is_selected', False):
                    continue

                child_type = child.get('node_type')
                print(f"  [ExportPDF] Level-1 child: {child_type}")

                # If it's a bullet/paragraph directly under section
                if child_type in ['bullet', 'paragraph']:
                    entry = {
                        'title': None,
                        'subtitle': None,
                        'start_date': None,
                        'end_date': None,
                        'location': None,
                        'description': None,
                        'items': [{
                            'id': child.get('id', 0),
                            'content': child.get('content', ''),
                            'order': child.get('order', 0)
                        }],
                        'sub_entries': []
                    }
                    section['entries'].append(entry)
                    print(f"    ✓ Added direct bullet under section")

                # If it's an entry
                elif child_type == 'entry':
                    # Recursively collect all bullets from this entry (at any depth)
                    all_bullets = collect_bullets_recursively(child, depth=1)

                    # Separate regular bullets from sub-entries
                    regular_bullets = [b for b in all_bullets if not isinstance(b, dict) or b.get('type') != 'sub_entry']
                    sub_entries_data = [b for b in all_bullets if isinstance(b, dict) and b.get('type') == 'sub_entry']

                    entry = {
                        'title': child.get('title'),
                        'subtitle': child.get('subtitle'),
                        'start_date': child.get('start_date'),
                        'end_date': child.get('end_date'),
                        'location': child.get('location'),
                        'description': child.get('content') if child.get('content_type') == 'text' else None,
                        'items': regular_bullets,
                        'sub_entries': sub_entries_data
                    }

                    # Only add entry if it has content
                    if entry['items'] or entry['sub_entries'] or entry['description'] or entry['title']:
                        section['entries'].append(entry)
                        print(f"    ✓ Added entry '{entry['title']}' with {len(regular_bullets)} bullets and {len(sub_entries_data)} sub-entries")

            # Only add section if it has entries
            if section['entries']:
                sections.append(section)
                print(f"[ExportPDF] ✓ Section '{section['title']}' added with {len(section['entries'])} entries")

        print(f"[ExportPDF] Total sections in PDF: {len(sections)}")
        return sections

    # Build selected_content structure for PDF service
    selected_content = {
        'contact_info': snapshot.get('contact_info', {}),
        'sections': transform_nodes_to_sections(snapshot.get('nodes', []))
    }

    cv_data = {
        "selected_content": selected_content
    }

    # Generate PDF using the pdf_service
    try:
        pdf_buffer = pdf_service.generate_cv_pdf(
            cv_data=cv_data,
            hidden_items=[],  # Application has finalized content, no hidden items
            template_name=cv_format
        )

        filename = _build_cv_export_filename(
            job_title=application.job_title,
            company_name=application.company_name,
            full_name=current_user.full_name
        )

        # Return PDF as downloadable file
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    except Exception as e:
        print(f"Error generating PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")


# ============================================================================
# System Health & Version
# ============================================================================

@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/api/version")
def get_version():
    """Get backend version"""
    try:
        version_file = os.path.join(os.path.dirname(__file__), "VERSION")
        with open(version_file, "r") as f:
            version = f.read().strip()
        return {"version": version}
    except Exception:
        return {"version": "3.0.0"}
