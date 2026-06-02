"""Safety-net tests for the single profile renderer (profile_render.py)."""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from profile_render import (  # noqa: E402
    render_profile_outline,
    render_cv_for_scoring,
    compute_included_ids,
    iter_nodes,
)


def _tree():
    """A small but representative profile tree with two levels of nesting."""
    return [
        {
            "id": 1, "node_type": "section", "title": "Work Experience",
            "is_selected": True,
            "children": [
                {
                    "id": 2, "node_type": "entry", "title": "Senior Data Engineer",
                    "subtitle": "Acme Corp", "start_date": "2021", "end_date": "2024",
                    "location": "Stockholm", "is_selected": True,
                    "children": [
                        {"id": 3, "node_type": "bullet",
                         "content": "Built pipelines processing 10TB/day with PySpark",
                         "is_selected": True, "children": []},
                        {"id": 4, "node_type": "bullet",
                         "content": "Led a team of 5 engineers",
                         "is_selected": False, "children": []},
                        {
                            "id": 5, "node_type": "entry", "title": "Project Atlas",
                            "is_selected": False,
                            "children": [
                                {"id": 6, "node_type": "bullet",
                                 "content": "Cut latency 60%", "is_selected": True,
                                 "children": []},
                            ],
                        },
                    ],
                },
            ],
        },
    ]


def test_outline_preserves_hierarchy_via_indentation():
    out = render_profile_outline(_tree())
    lines = out.splitlines()
    # Section at depth 0, entry indented under it, bullet indented further.
    assert lines[0].startswith("§ [#1 section] Work Experience")
    entry_line = next(l for l in lines if "Senior Data Engineer" in l)
    bullet_line = next(l for l in lines if "10TB/day" in l)
    assert entry_line.startswith("  ▸ [#2 entry] Senior Data Engineer")
    assert bullet_line.startswith("    • [#3 bullet]")


def test_outline_includes_entry_metadata():
    out = render_profile_outline(_tree())
    assert "Acme Corp · 2021–2024 · Stockholm" in out


def test_ids_can_be_omitted_for_clean_export():
    out = render_profile_outline(_tree(), include_ids=False)
    assert "[#1" not in out
    assert "Work Experience" in out


def test_only_selected_filters_unselected_nodes():
    out = render_profile_outline(_tree(), only_selected=True)
    assert "10TB/day" in out          # selected bullet kept
    assert "team of 5" not in out     # unselected bullet dropped


def test_open_ended_dates_render_as_present():
    nodes = [{"id": 9, "node_type": "entry", "title": "Current Role",
              "start_date": "2024", "end_date": "", "is_selected": True, "children": []}]
    assert "2024–Present" in render_profile_outline(nodes)


def test_unknown_node_type_does_not_crash():
    nodes = [{"id": 10, "node_type": "wildcard", "title": "Custom", "children": []}]
    out = render_profile_outline(nodes)
    assert "Custom" in out
    assert "[#10 wildcard]" in out


def test_compute_included_ids_pulls_in_ancestors():
    # Only bullet #6 (deep under unselected entry #5) is selected.
    included = compute_included_ids(_tree(), selected_ids={6})
    # Its ancestors (section #1, entry #2, entry #5) must be pulled in deterministically.
    assert included == {1, 2, 5, 6}


def test_compute_included_ids_empty_selection():
    assert compute_included_ids(_tree(), selected_ids=set()) == set()


def test_iter_nodes_visits_everything_depth_first():
    ids = [n["id"] for n in iter_nodes(_tree())]
    assert ids == [1, 2, 3, 4, 5, 6]


def test_cv_for_scoring_only_includes_selected_and_header():
    snapshot = {
        "contact_info": {"full_name": "Jane Doe", "email": "j@x.com"},
        "nodes": _tree(),
    }
    out = render_cv_for_scoring(snapshot, job_title="Data Engineer", company_name="Acme")
    assert "TAILORED CURRICULUM VITAE" in out
    assert "Position: Data Engineer" in out
    assert "Jane Doe" in out
    assert "Email: j@x.com" in out
    assert "10TB/day" in out          # selected content present
    assert "team of 5" not in out     # unselected content absent
    assert "[#" not in out            # ids stripped for scoring/export


def test_cv_for_scoring_handles_missing_contact():
    out = render_cv_for_scoring({"nodes": _tree()})
    assert "TAILORED CURRICULUM VITAE" in out
    assert "10TB/day" in out
