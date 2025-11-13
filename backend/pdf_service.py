"""
PDF Generation Service for Professional CVs
Supports multiple templates and customization options
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.platypus.flowables import HRFlowable
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas
from io import BytesIO
from datetime import datetime
from typing import Dict, List, Optional, Any


def sanitize_text(text: str) -> str:
    """
    Sanitize text for PDF generation by replacing problematic Unicode characters
    with safe ASCII alternatives. Uses encode/decode to handle all Unicode chars.

    Args:
        text: Raw text string that may contain Unicode characters

    Returns:
        Sanitized text safe for PDF generation
    """
    if not text:
        return ""

    # First, replace common problematic Unicode characters with safe alternatives
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
        '\u00b7': '*',      # MIDDLE DOT
        '\u00e9': 'e',      # é
        '\u00e8': 'e',      # è
        '\u00ea': 'e',      # ê
        '\u00eb': 'e',      # ë
        '\u00fc': 'u',      # ü
        '\u00f6': 'o',      # ö
        '\u00e4': 'a',      # ä
        '\u00c9': 'E',      # É
        '\u00c8': 'E',      # È
        '\u00ca': 'E',      # Ê
        '\u2122': 'TM',     # TRADEMARK
        '\u00ae': '(R)',    # REGISTERED SIGN
        '\u00a9': '(C)',    # COPYRIGHT
    }

    for unicode_char, replacement in replacements.items():
        text = text.replace(unicode_char, replacement)

    # Convert any remaining non-ASCII characters using ASCII approximation
    # This handles any Unicode we didn't explicitly replace
    try:
        # Try to encode as ASCII, replacing errors with '?'
        text = text.encode('ascii', 'ignore').decode('ascii')
    except Exception:
        # Fallback: remove all non-ASCII characters
        text = ''.join(char if ord(char) < 128 else '' for char in text)

    return text


class PDFTemplate:
    """Base class for PDF templates with support for multiple formats"""

    def __init__(self, template_name: str = "modern"):
        self.template_name = template_name
        self.page_size = letter

        # Template-specific configurations
        self.config = self._get_template_config(template_name)
        self.styles = self._create_styles()

    def _get_template_config(self, template_name: str) -> dict:
        """Get configuration for specific template"""
        configs = {
            "professional": {
                "primary_color": "#1a202c",      # Dark gray/black
                "secondary_color": "#2d3748",    # Medium gray
                "accent_color": "#3182ce",       # Professional blue
                "font_size_name": 24,
                "font_size_section": 14,
                "spacing": "normal",
                "line_thickness": 1.0
            },
            "modern": {
                "primary_color": "#1a202c",
                "secondary_color": "#4a5568",
                "accent_color": "#4299e1",       # Bright blue
                "font_size_name": 26,
                "font_size_section": 14,
                "spacing": "normal",
                "line_thickness": 0.5
            },
            "compact": {
                "primary_color": "#000000",
                "secondary_color": "#333333",
                "accent_color": "#0066cc",       # Standard blue
                "font_size_name": 20,
                "font_size_section": 12,
                "spacing": "tight",
                "line_thickness": 0.75
            },
            "creative": {
                "primary_color": "#2d3748",
                "secondary_color": "#4a5568",
                "accent_color": "#805ad5",       # Purple accent
                "font_size_name": 28,
                "font_size_section": 15,
                "spacing": "relaxed",
                "line_thickness": 2.0
            }
        }
        return configs.get(template_name, configs["professional"])

    def _create_styles(self):
        """Create custom paragraph styles based on template config"""
        styles = getSampleStyleSheet()
        config = self.config

        # Spacing adjustments based on template
        spacing_multiplier = {
            "tight": 0.7,
            "normal": 1.0,
            "relaxed": 1.3
        }.get(config["spacing"], 1.0)

        # Name/Header style
        styles.add(ParagraphStyle(
            name='CVName',
            parent=styles['Heading1'],
            fontSize=config["font_size_name"],
            textColor=colors.HexColor(config["primary_color"]),
            spaceAfter=int(6 * spacing_multiplier),
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))

        # Job title style
        styles.add(ParagraphStyle(
            name='CVJobTitle',
            parent=styles['Normal'],
            fontSize=12,
            textColor=colors.HexColor('#4a5568'),
            spaceAfter=12,
            alignment=TA_CENTER,
            fontName='Helvetica'
        ))

        # Contact info style
        styles.add(ParagraphStyle(
            name='CVContact',
            parent=styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#718096'),
            spaceAfter=16,
            alignment=TA_CENTER,
            fontName='Helvetica'
        ))

        # Section heading style
        styles.add(ParagraphStyle(
            name='CVSectionHeading',
            parent=styles['Heading2'],
            fontSize=config["font_size_section"],
            textColor=colors.HexColor(config["primary_color"]),
            spaceBefore=int(14 * spacing_multiplier),
            spaceAfter=int(8 * spacing_multiplier),
            fontName='Helvetica-Bold',
            borderWidth=0,
            borderColor=colors.HexColor(config["accent_color"]),
            borderPadding=0,
            leftIndent=0
        ))

        # Entry title (company, school, etc.)
        styles.add(ParagraphStyle(
            name='CVEntryTitle',
            parent=styles['Normal'],
            fontSize=11,
            textColor=colors.HexColor('#2d3748'),
            spaceAfter=2,
            fontName='Helvetica-Bold'
        ))

        # Entry subtitle (position, degree, etc.)
        styles.add(ParagraphStyle(
            name='CVEntrySubtitle',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#4a5568'),
            spaceAfter=2,
            fontName='Helvetica-Oblique'
        ))

        # Entry metadata (dates, location)
        styles.add(ParagraphStyle(
            name='CVEntryMeta',
            parent=styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#718096'),
            spaceAfter=6,
            fontName='Helvetica'
        ))

        # Bullet points
        styles.add(ParagraphStyle(
            name='CVBullet',
            parent=styles['Normal'],
            fontSize=10 if config["spacing"] != "compact" else 9,
            textColor=colors.HexColor(config["secondary_color"]),
            spaceAfter=int(4 * spacing_multiplier),
            leftIndent=20,
            bulletIndent=10,
            fontName='Helvetica'
        ))

        # Description text
        styles.add(ParagraphStyle(
            name='CVDescription',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#4a5568'),
            spaceAfter=6,
            fontName='Helvetica'
        ))

        return styles


class CVPDFGenerator:
    """Main PDF generator for CVs"""

    def __init__(self, template_name: str = "modern"):
        self.template = PDFTemplate(template_name)

    def generate_pdf(
        self,
        cv_data: Dict[str, Any],
        hidden_items: Optional[List[int]] = None
    ) -> BytesIO:
        """
        Generate a PDF from CV data

        Args:
            cv_data: Dictionary containing CV information
            hidden_items: List of item IDs to exclude from the PDF

        Returns:
            BytesIO object containing the PDF
        """
        hidden_items = hidden_items or []
        buffer = BytesIO()

        # Create the PDF document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=self.template.page_size,
            rightMargin=0.75*inch,
            leftMargin=0.75*inch,
            topMargin=0.75*inch,
            bottomMargin=0.75*inch
        )

        # Build the content
        story = []

        # Add header (name, contact info)
        story.extend(self._build_header(cv_data))

        # Add sections
        story.extend(self._build_sections(cv_data, hidden_items))

        # Build the PDF
        doc.build(story)

        buffer.seek(0)
        return buffer

    def _build_header(self, cv_data: Dict[str, Any]) -> List:
        """Build the header section with contact info"""
        story = []
        styles = self.template.styles

        # Get contact info from selected_content
        selected_content = cv_data.get('selected_content', {})
        contact_info = selected_content.get('contact_info', {})

        # Name
        full_name = contact_info.get('full_name', 'N/A')
        story.append(Paragraph(sanitize_text(full_name), styles['CVName']))

        # Job title (if available) - support both field names
        job_title = contact_info.get('professional_title') or contact_info.get('job_title', '')
        if job_title:
            story.append(Paragraph(sanitize_text(job_title), styles['CVJobTitle']))

        # Contact details with icons and hyperlinks
        # Using [in] and [gh] as text-based icons since PDF doesn't support emoji/SVG well
        contact_parts = []
        if contact_info.get('email'):
            contact_parts.append(contact_info['email'])

        # Support both phone and phone_number field names
        phone = contact_info.get('phone_number') or contact_info.get('phone')
        if phone:
            contact_parts.append(phone)

        # Build location from city and country, or use location field
        location = contact_info.get('location')
        if not location:
            city = contact_info.get('city', '')
            country = contact_info.get('country', '')
            location_parts = [p for p in [city, country] if p]
            if location_parts:
                location = ', '.join(location_parts)
        if location:
            contact_parts.append(location)

        # LinkedIn - support both field names
        linkedin_url = contact_info.get('linkedin_url') or contact_info.get('linkedin')
        if linkedin_url:
            contact_parts.append(f'<a href="{linkedin_url}" color="#2d3748">[in] LinkedIn</a>')

        # GitHub - support both field names
        github_url = contact_info.get('github_url') or contact_info.get('github')
        if github_url:
            contact_parts.append(f'<a href="{github_url}" color="#2d3748">[gh] GitHub</a>')

        # Portfolio/Website - support both field names
        website_url = contact_info.get('portfolio_url') or contact_info.get('website')
        if website_url:
            contact_parts.append(f'<a href="{website_url}" color="#2d3748">{website_url}</a>')

        if contact_parts:
            contact_line = " | ".join(contact_parts)
            story.append(Paragraph(sanitize_text(contact_line), styles['CVContact']))

        # Horizontal line separator
        story.append(HRFlowable(
            width="100%",
            thickness=self.template.config["line_thickness"],
            color=colors.HexColor('#cbd5e0'),
            spaceBefore=0,
            spaceAfter=12
        ))

        return story

    def _build_sections(self, cv_data: Dict[str, Any], hidden_items: List[int]) -> List:
        """Build all CV sections"""
        story = []
        styles = self.template.styles

        selected_content = cv_data.get('selected_content', {})
        sections = selected_content.get('sections', [])

        # Define section order for professional CVs
        section_order = [
            'summary',
            'work_experience',
            'education',
            'skills',
            'projects',
            'certifications',
            'publications',
            'awards',
            'languages',
            'volunteer'
        ]

        # Sort sections by defined order
        sections_dict = {s['section_type']: s for s in sections}
        ordered_sections = []
        for section_type in section_order:
            if section_type in sections_dict:
                ordered_sections.append(sections_dict[section_type])

        # Add any remaining sections not in the order
        for section in sections:
            if section not in ordered_sections:
                ordered_sections.append(section)

        # Build each section
        for section in ordered_sections:
            section_content = self._build_section(section, hidden_items)
            if section_content:  # Only add if there's visible content
                story.extend(section_content)

        return story

    def _build_section(self, section: Dict[str, Any], hidden_items: List[int]) -> List:
        """Build a single section"""
        story = []
        styles = self.template.styles

        section_title = section.get('title', '')
        section_type = section.get('section_type', '')
        entries = section.get('entries', [])

        # Filter entries that have visible items or meaningful content
        visible_entries = []
        for entry in entries:
            # Check if entry has any visible items at entry level
            items = entry.get('items', [])
            visible_items = [item for item in items if item['id'] not in hidden_items]

            # Check if entry has any visible items in sub-entries
            has_visible_sub_items = False
            sub_entries = entry.get('sub_entries', [])
            for sub_entry in sub_entries:
                sub_items = sub_entry.get('items', [])
                visible_sub_items = [item for item in sub_items if item['id'] not in hidden_items]
                if visible_sub_items:
                    has_visible_sub_items = True
                    break

            # Include entry if it has:
            # 1. Visible items at entry level, OR
            # 2. Visible items in sub-entries, OR
            # 3. Description text, OR
            # 4. Title with dates (work experience/education entries)
            has_content = (
                visible_items or
                has_visible_sub_items or
                entry.get('description') or
                (entry.get('title') and (entry.get('start_date') or entry.get('subtitle')))
            )

            if has_content:
                visible_entries.append(entry)

        # Don't render section if no visible entries
        if not visible_entries:
            return []

        # Section heading
        story.append(Paragraph(sanitize_text(section_title.upper()), styles['CVSectionHeading']))

        # Add section divider line
        story.append(HRFlowable(
            width="100%",
            thickness=self.template.config["line_thickness"] * 0.5,
            color=colors.HexColor(self.template.config["accent_color"]),
            spaceBefore=0,
            spaceAfter=8
        ))

        # Build entries
        for entry in visible_entries:
            story.extend(self._build_entry(entry, section_type, hidden_items))

        return story

    def _build_entry(self, entry: Dict[str, Any], section_type: str, hidden_items: List[int]) -> List:
        """Build a single entry within a section"""
        story = []
        styles = self.template.styles

        # Title (company, school, project name, etc.)
        title = entry.get('title', '')
        if title:
            story.append(Paragraph(sanitize_text(title), styles['CVEntryTitle']))

        # Subtitle (position, degree, etc.)
        subtitle = entry.get('subtitle', '')
        if subtitle:
            story.append(Paragraph(sanitize_text(subtitle), styles['CVEntrySubtitle']))

        # Metadata (dates and location on same line)
        meta_parts = []
        start_date = entry.get('start_date', '')
        end_date = entry.get('end_date', '')
        location = entry.get('location', '')

        if start_date or end_date:
            date_str = f"{start_date or ''} - {end_date or 'Present'}"
            meta_parts.append(date_str)

        if location:
            meta_parts.append(location)

        if meta_parts:
            meta_line = " | ".join(meta_parts)
            story.append(Paragraph(sanitize_text(meta_line), styles['CVEntryMeta']))

        # Description (if any)
        description = entry.get('description', '')
        if description:
            story.append(Paragraph(sanitize_text(description), styles['CVDescription']))

        # Items (bullet points) at entry level
        items = entry.get('items', [])
        visible_items = [item for item in items if item['id'] not in hidden_items]

        # Sort items by order
        visible_items.sort(key=lambda x: x.get('order', 0))

        for item in visible_items:
            content = item.get('content', '')
            if content:
                # Add bullet point
                bullet_text = f"• {content}"
                story.append(Paragraph(sanitize_text(bullet_text), styles['CVBullet']))

        # Handle sub-entries (for hierarchical work experience)
        sub_entries = entry.get('sub_entries', [])
        if sub_entries:
            for sub_entry in sub_entries:
                # Sub-entry title (e.g., "Product Management", "Technical Leadership")
                sub_title = sub_entry.get('title', '')
                if sub_title:
                    # Add some space before sub-entry
                    story.append(Spacer(1, 0.08*inch))
                    # Sub-entry title in italic/bold
                    story.append(Paragraph(sanitize_text(f"<i><b>{sub_title}</b></i>"), styles['CVEntrySubtitle']))

                # Sub-entry items
                sub_items = sub_entry.get('items', [])
                visible_sub_items = [item for item in sub_items if item['id'] not in hidden_items]
                visible_sub_items.sort(key=lambda x: x.get('order', 0))

                for item in visible_sub_items:
                    content = item.get('content', '')
                    if content:
                        # Add bullet point
                        bullet_text = f"• {content}"
                        story.append(Paragraph(sanitize_text(bullet_text), styles['CVBullet']))

        # Add spacing after entry
        story.append(Spacer(1, 0.15*inch))

        return story


def generate_cv_pdf(
    cv_data: Dict[str, Any],
    hidden_items: Optional[List[int]] = None,
    template_name: str = "modern"
) -> BytesIO:
    """
    Convenience function to generate a CV PDF

    Args:
        cv_data: CV data dictionary
        hidden_items: List of item IDs to hide
        template_name: Name of the template to use

    Returns:
        BytesIO buffer containing the PDF
    """
    generator = CVPDFGenerator(template_name)
    return generator.generate_pdf(cv_data, hidden_items)
