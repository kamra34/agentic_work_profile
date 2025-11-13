"""
Format hierarchical CV content (from content_snapshot with node selections)
into clean, human-readable text for AI analysis.
"""
from typing import Dict, Any, List


def format_hierarchical_cv_for_ai(content_snapshot: Dict[str, Any], job_title: str = "", company_name: str = "") -> str:
    """
    Format hierarchical CV content into a clean, professional CV format for AI analysis.
    Only includes nodes that are marked as selected (is_selected=True).

    Args:
        content_snapshot: The hierarchical content structure with nodes
        job_title: Optional job title for context
        company_name: Optional company name for context

    Returns:
        A beautifully formatted CV text ready for AI analysis
    """
    output_lines = []

    output_lines.append("=" * 80)
    output_lines.append("TAILORED CURRICULUM VITAE")
    output_lines.append("=" * 80)

    if job_title or company_name:
        output_lines.append("\nTAILORED FOR:")
        if job_title:
            output_lines.append(f"Position: {job_title}")
        if company_name:
            output_lines.append(f"Company: {company_name}")
        output_lines.append("")

    # Get contact info if available
    contact_info = content_snapshot.get('contact_info', {})
    if contact_info:
        output_lines.append("CONTACT INFORMATION")
        output_lines.append("-" * 80)
        if contact_info.get('full_name'):
            output_lines.append(f"{contact_info['full_name']}")
        contact_details = []
        if contact_info.get('email'):
            contact_details.append(f"Email: {contact_info['email']}")
        if contact_info.get('phone'):
            contact_details.append(f"Phone: {contact_info['phone']}")
        if contact_info.get('location'):
            contact_details.append(f"Location: {contact_info['location']}")
        if contact_details:
            output_lines.append(" | ".join(contact_details))
        output_lines.append("")

    # Process nodes
    nodes = content_snapshot.get('nodes', [])

    for node in nodes:
        _format_node(node, output_lines, level=0)

    output_lines.append("=" * 80)
    output_lines.append("END OF CV")
    output_lines.append("=" * 80)

    return "\n".join(output_lines)


def _format_node(node: Dict[str, Any], output_lines: List[str], level: int = 0):
    """
    Recursively format a node and its children.
    Only includes nodes where is_selected=True.
    """
    # Skip if not selected
    if not node.get('is_selected', True):
        return

    node_type = node.get('node_type', 'unknown')

    # Section nodes (level 0)
    if node_type == 'section':
        output_lines.append("")
        output_lines.append("=" * 80)
        title = node.get('title', 'UNTITLED SECTION')
        icon = node.get('icon', '')
        if icon:
            output_lines.append(f"{icon} {title.upper()}")
        else:
            output_lines.append(f"{title.upper()}")
        output_lines.append("=" * 80)

        # Process children
        for child in node.get('children', []):
            _format_node(child, output_lines, level + 1)

    # Entry nodes (experience, education, etc.)
    elif node_type in ['entry', 'experience', 'education', 'project']:
        output_lines.append("")
        output_lines.append("-" * 80)

        # Title line
        title = node.get('title', '')
        if title:
            output_lines.append(f"{title}")

        # Subtitle (company, institution, etc.)
        subtitle = node.get('subtitle', '')
        if subtitle:
            output_lines.append(f"{subtitle}")

        # Dates and location on same line
        date_location = []
        start_date = node.get('start_date', '')
        end_date = node.get('end_date', '')
        if start_date or end_date:
            dates = f"{start_date or ''} - {end_date or 'Present'}"
            date_location.append(dates)

        location = node.get('location', '')
        if location:
            date_location.append(location)

        if date_location:
            output_lines.append(" | ".join(date_location))

        # Content/description
        content = node.get('content', '')
        if content:
            output_lines.append(f"\n{content}")

        # Process children (bullet points, etc.)
        for child in node.get('children', []):
            _format_node(child, output_lines, level + 1)

    # Bullet points and paragraphs
    elif node_type in ['bullet', 'paragraph']:
        content = node.get('content', '')
        if content:
            if node_type == 'bullet':
                output_lines.append(f"  • {content}")
            else:
                output_lines.append(f"\n{content}")

        # Process nested children if any
        for child in node.get('children', []):
            _format_node(child, output_lines, level + 1)

    # Other node types
    else:
        # Generic handling
        title = node.get('title', '')
        content = node.get('content', '')

        if title:
            output_lines.append(f"\n{title}")
        if content:
            output_lines.append(f"{content}")

        # Process children
        for child in node.get('children', []):
            _format_node(child, output_lines, level + 1)
