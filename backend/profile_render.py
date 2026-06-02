"""
Single source of truth for turning the profile-node tree into text the AI reads.

Design goals (see CODEX_HANDOFF / product brainstorm):
- The model should read the profile as something that *looks like a CV*, because that
  maximizes selection/scoring accuracy. We therefore emit an indented outline that
  preserves the parent -> child hierarchy instead of a flat list.
- Every line carries a stable ``[#<id> <type>]`` tag so the model can reference nodes
  unambiguously and we can map decisions back to the tree. Hierarchy/relations never
  leave the server: the model only ever returns per-id decisions.
- This replaces the two older serializers that each lost information:
    * ``profile_nodes_to_text``      (lost the node ids)
    * ``flatten_nodes_for_analysis`` (lost the hierarchy)

The node dicts handled here use the shape produced across the backend:
    {
        "id": int, "global_id": str, "node_type": str,
        "title": str|None, "subtitle": str|None, "content": str|None,
        "start_date": str|None, "end_date": str|None, "location": str|None,
        "level": int, "is_selected": bool, "is_visible": bool,
        "children": [ ...same shape... ],
    }
All fields are optional/defensive so callers can pass partial trees.
"""

from typing import Any, Dict, Iterable, List, Optional, Set

# Visual markers per node type. Unknown types fall back to a neutral dash so the
# renderer never throws on a custom node_type.
_MARKERS = {
    "section": "§",
    "entry": "▸",
    "sub_entry": "▸",
    "bullet": "•",
    "item": "•",
    "paragraph": "¶",
}
_DEFAULT_MARKER = "-"
_INDENT = "  "  # two spaces per depth level


def _meta_line(node: Dict[str, Any]) -> str:
    """Compose the ' · '-joined metadata suffix (subtitle/dates/location) for a node."""
    parts: List[str] = []
    subtitle = (node.get("subtitle") or "").strip()
    if subtitle:
        parts.append(subtitle)

    start = (node.get("start_date") or "").strip()
    end = (node.get("end_date") or "").strip()
    if start and end:
        parts.append(f"{start}–{end}")
    elif start:
        parts.append(f"{start}–Present")
    elif end:
        parts.append(end)

    location = (node.get("location") or "").strip()
    if location:
        parts.append(location)

    return " · ".join(parts)


def _node_line(node: Dict[str, Any], depth: int, include_ids: bool) -> Optional[str]:
    """Render a single node to one outline line, or None if it has no displayable text."""
    node_type = (node.get("node_type") or "entry").strip()
    marker = _MARKERS.get(node_type, _DEFAULT_MARKER)

    title = (node.get("title") or "").strip()
    content = (node.get("content") or "").strip()

    # Headline text: sections/entries lead with their title; bullets/paragraphs with content.
    if node_type in ("bullet", "item", "paragraph"):
        headline = content or title
    else:
        headline = title or content

    meta = _meta_line(node)
    if headline and meta:
        headline = f"{headline} · {meta}"
    elif meta and not headline:
        headline = meta

    # An entry can carry both a title and a content blurb; keep the blurb if it wasn't
    # already used as the headline.
    extra = ""
    if node_type not in ("bullet", "item", "paragraph") and content and content != title:
        extra = content

    if not headline and not extra:
        return None  # nothing meaningful to show

    tag = ""
    if include_ids and node.get("id") is not None:
        tag = f"[#{node['id']} {node_type}] "

    indent = _INDENT * depth
    line = f"{indent}{marker} {tag}{headline}".rstrip()
    if extra:
        line += f"\n{indent}{_INDENT}{extra}"
    return line


def render_profile_outline(
    nodes: List[Dict[str, Any]],
    *,
    include_ids: bool = True,
    only_selected: bool = False,
    depth: int = 0,
) -> str:
    """
    Render a (sub)tree of nodes to an indented outline string.

    Args:
        nodes: top-level (or any-level) list of node dicts.
        include_ids: emit the ``[#id type]`` tag (True for AI input, False for clean export).
        only_selected: when True, skip nodes whose ``is_selected`` is falsy. Used to render
            exactly the CV the user has chosen (the artifact we score/export).
        depth: current indentation depth (used by recursion).
    """
    lines: List[str] = []
    for node in nodes:
        if only_selected and not node.get("is_selected", False):
            continue
        line = _node_line(node, depth, include_ids)
        if line is not None:
            lines.append(line)
        children = node.get("children") or []
        if children:
            child_block = render_profile_outline(
                children,
                include_ids=include_ids,
                only_selected=only_selected,
                depth=depth + 1,
            )
            if child_block:
                lines.append(child_block)
    return "\n".join(lines)


def render_cv_for_scoring(
    content_snapshot: Dict[str, Any],
    job_title: str = "",
    company_name: str = "",
) -> str:
    """
    Render the *currently selected* CV (the artifact the user will actually export)
    to text for AI scoring / humanity checks.

    This is the input to the CV-optimization score: it contains ONLY selected nodes,
    so the score reflects the tailored CV the user is iterating on each round — not the
    full profile. Built on the one outline renderer to keep a single source of truth.
    """
    lines: List[str] = ["TAILORED CURRICULUM VITAE"]

    if job_title or company_name:
        lines.append("")
        lines.append("Tailored for:")
        if job_title:
            lines.append(f"  Position: {job_title}")
        if company_name:
            lines.append(f"  Company: {company_name}")

    contact = content_snapshot.get("contact_info") or {}
    if contact:
        lines.append("")
        if contact.get("full_name"):
            lines.append(contact["full_name"])
        details = []
        for key, label in (("email", "Email"), ("phone", "Phone"), ("location", "Location")):
            if contact.get(key):
                details.append(f"{label}: {contact[key]}")
        if details:
            lines.append(" | ".join(details))

    lines.append("")
    body = render_profile_outline(
        content_snapshot.get("nodes", []),
        include_ids=False,
        only_selected=True,
    )
    if body:
        lines.append(body)
    return "\n".join(lines)


def iter_nodes(nodes: Iterable[Dict[str, Any]]):
    """Yield every node in the tree, depth-first (parents before children)."""
    for node in nodes:
        yield node
        children = node.get("children") or []
        if children:
            yield from iter_nodes(children)


def compute_included_ids(
    nodes: List[Dict[str, Any]],
    selected_ids: Set[Any],
    *,
    id_key: str = "id",
) -> Set[Any]:
    """
    Given the ids the model (or user) chose to include, return the full set of ids that
    should appear in the CV: every selected node PLUS every ancestor of a selected node.

    This replaces the old "force every section/entry to include=true" heuristic with a
    deterministic, server-side rule: a structural node is included iff it has at least one
    included descendant. The model no longer has to guess about structural nodes.
    """
    included: Set[Any] = set()

    def visit(node: Dict[str, Any]) -> bool:
        node_id = node.get(id_key)
        self_selected = node_id in selected_ids
        child_included = False
        for child in node.get("children") or []:
            if visit(child):
                child_included = True
        if self_selected or child_included:
            if node_id is not None:
                included.add(node_id)
            return True
        return False

    for root in nodes:
        visit(root)
    return included
