"""
Guardrails that enforce the product philosophy in code, not just in prompts:
the AI may *polish* the wording of experiences you actually entered, but it must
not *invent* facts. The clearest, least-noisy violation to detect automatically is
a fabricated number/metric (e.g. turning "improved performance" into "improved
performance by 40%") or a quantity that wasn't in the source.

These are pure functions so they can be unit-tested without the app/DB/network.
"""

import re
from typing import Any, Dict, List, Set

# Matches numeric quantities a CV might contain: percentages, money, multipliers,
# plain integers/decimals with optional thousands separators and k/m/b/+ suffixes.
_NUMBER_RE = re.compile(
    r"""
    (?<![\w.])              # not preceded by a word char or dot
    \$?                     # optional currency
    \d{1,3}(?:,\d{3})+      # 1,000 / 1,000,000
    (?:\.\d+)?
    |
    \$?\d+(?:\.\d+)?        # 40 / 3.5 / $250
    """,
    re.VERBOSE,
)


def _normalize_number(token: str) -> str:
    """Strip currency/grouping so '1,000' and '1000' compare equal."""
    return token.replace(",", "").lstrip("$")


def extract_numbers(text: str) -> Set[str]:
    """Return the set of normalized numeric tokens present in ``text``."""
    if not text:
        return set()
    return {_normalize_number(m.group(0)) for m in _NUMBER_RE.finditer(text)}


def check_no_invented_numbers(
    original_text: str,
    refined_text: str,
    *,
    extra_corpus: str = "",
) -> Dict[str, Any]:
    """
    Compare numbers in the refined text against the original (plus an optional
    corpus, e.g. the full profile, where a real figure might legitimately live).

    Returns a report:
        {
            "ok": bool,                 # True when no new numbers were introduced
            "invented_numbers": [...],  # numbers in refined but not in source
        }
    """
    source_numbers = extract_numbers(original_text) | extract_numbers(extra_corpus)
    refined_numbers = extract_numbers(refined_text)
    invented = sorted(refined_numbers - source_numbers, key=lambda s: (len(s), s))
    return {"ok": not invented, "invented_numbers": invented}


# Skill-like tokens: capitalized words, ALLCAPS acronyms, and dotted tech names.
_TERM_RE = re.compile(r"\b([A-Z][A-Za-z0-9.+#]{1,}|[A-Z]{2,})\b")
# Very common capitalized words that aren't skills; ignore to cut noise.
_STOPWORDS = {
    "I", "A", "The", "And", "Or", "For", "With", "To", "In", "On", "Of", "At",
    "Led", "Built", "Managed", "Developed", "Designed", "Created", "Improved",
    "Reduced", "Increased", "Delivered", "Worked", "Team", "Project", "Company",
}


def extract_terms(text: str) -> Set[str]:
    """Return capitalized/acronym/tech-like tokens (potential skills/tools)."""
    if not text:
        return set()
    return {m.group(0) for m in _TERM_RE.finditer(text)} - _STOPWORDS


def check_no_invented_terms(
    original_text: str,
    refined_text: str,
    *,
    extra_corpus: str = "",
) -> Dict[str, Any]:
    """
    Advisory check: flag skill/tool-like tokens that appear in the refined text but
    nowhere in the source. Noisier than the number check (rephrasing can introduce
    capitalized words), so callers should treat this as a warning, not a hard block.
    """
    source_terms = {t.lower() for t in extract_terms(original_text) | extract_terms(extra_corpus)}
    new_terms = sorted({t for t in extract_terms(refined_text) if t.lower() not in source_terms})
    return {"ok": not new_terms, "new_terms": new_terms}


def audit_refinement(
    original_text: str,
    refined_text: str,
    *,
    profile_corpus: str = "",
) -> Dict[str, Any]:
    """
    Run all guardrails over a refinement and return a combined report.

    ``hard_violation`` is True only for invented numbers (a clear fabrication);
    ``warnings`` carries softer signals (new skill-like terms) for the UI to surface.
    """
    numbers = check_no_invented_numbers(original_text, refined_text, extra_corpus=profile_corpus)
    terms = check_no_invented_terms(original_text, refined_text, extra_corpus=profile_corpus)

    warnings: List[str] = []
    if terms["new_terms"]:
        warnings.append(
            "Refinement introduced terms not found in your profile: "
            + ", ".join(terms["new_terms"])
        )

    return {
        "hard_violation": not numbers["ok"],
        "invented_numbers": numbers["invented_numbers"],
        "warnings": warnings,
        "ok": numbers["ok"] and terms["ok"],
    }
