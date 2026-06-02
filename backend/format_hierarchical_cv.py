"""
Format hierarchical CV content (from content_snapshot with node selections)
into clean, human-readable text for AI analysis.

This module now delegates to the single profile renderer (profile_render) so the
text the AI scores is produced by the same code path that renders the profile
everywhere else. Kept as a thin, named wrapper for backwards compatibility.
"""
from typing import Dict, Any

from profile_render import render_cv_for_scoring


def format_hierarchical_cv_for_ai(content_snapshot: Dict[str, Any], job_title: str = "", company_name: str = "") -> str:
    """
    Format the currently selected CV content into clean text for AI analysis.
    Only includes nodes marked as selected (is_selected=True).

    Delegates to profile_render.render_cv_for_scoring (single source of truth).
    """
    return render_cv_for_scoring(content_snapshot, job_title=job_title, company_name=company_name)
