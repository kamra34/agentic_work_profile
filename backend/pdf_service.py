"""
PDF Generation Service for Professional CVs
Supports multiple templates and customization options
Hybrid approach: ReportLab for ATS, HTML2PDF (xhtml2pdf) for creative templates
Version: 4.0.0-hybrid
"""

print("[PDF_SERVICE] Module loaded - Version 4.0.0-hybrid - HTML2PDF integration")

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.platypus.flowables import HRFlowable
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from io import BytesIO
from datetime import datetime
from typing import Dict, List, Optional, Any
import html
import re

# Import HTML2PDF generator (xhtml2pdf)
try:
    from weasyprint_service import WeasyPrintCVGenerator
    HTML2PDF_AVAILABLE = True
    print("[PDF_SERVICE] HTML2PDF generator loaded successfully")
except ImportError as e:
    HTML2PDF_AVAILABLE = False
    print(f"[PDF_SERVICE] HTML2PDF not available: {e}")

# Define which templates use HTML2PDF (xhtml2pdf) vs ReportLab
HTML2PDF_TEMPLATES = {"creative"}  # Only Creative uses HTML2PDF for now
REPORTLAB_TEMPLATES = {"professional", "modern", "compact", "ats_optimized"}  # Others use ReportLab


def _normalize_pdf_metadata(pdf_buffer: BytesIO) -> BytesIO:
    """
    Re-write PDF with normalized metadata to avoid leaking generator/library details.
    Keeps document content unchanged.
    """
    try:
        try:
            from PyPDF2 import PdfReader, PdfWriter
        except Exception:
            from pypdf import PdfReader, PdfWriter

        pdf_buffer.seek(0)
        reader = PdfReader(pdf_buffer)
        writer = PdfWriter()

        for page in reader.pages:
            writer.add_page(page)

        # Keep metadata minimal and neutral.
        writer.add_metadata({
            "/Title": "CV",
            "/Author": "",
            "/Subject": "",
            "/Keywords": "",
            "/Creator": "Work Profile",
            "/Producer": "Work Profile",
        })

        cleaned_buffer = BytesIO()
        writer.write(cleaned_buffer)
        cleaned_buffer.seek(0)
        return cleaned_buffer
    except Exception as e:
        print(f"[PDF_SERVICE] Metadata normalization skipped: {e}")
        pdf_buffer.seek(0)
        return pdf_buffer


def _transform_cv_data_for_weasyprint(cv_data: Dict[str, Any], hidden_items: Optional[List[int]] = None) -> Dict[str, Any]:
    """
    Transform cv_data from ReportLab format to WeasyPrint format

    Args:
        cv_data: CV data in ReportLab format (selected_content structure)
        hidden_items: List of item IDs to hide

    Returns:
        CV data in WeasyPrint format (personal_info + sections)
    """
    hidden_items = hidden_items or []

    selected_content = cv_data.get('selected_content', {})
    contact_info = selected_content.get('contact_info', {})
    sections = selected_content.get('sections', [])

    # Transform contact info to personal_info
    personal_info = {
        'name': contact_info.get('full_name', 'N/A'),
        'email': contact_info.get('email', ''),
        'phone': contact_info.get('phone_number') or contact_info.get('phone', ''),
        'linkedin': contact_info.get('linkedin_url') or contact_info.get('linkedin', ''),
        'github': contact_info.get('github_url') or contact_info.get('github', ''),
        'website': contact_info.get('portfolio_url') or contact_info.get('website', ''),
    }

    # Build location from city and country, or use location field
    location = contact_info.get('location')
    if not location:
        city = contact_info.get('city', '')
        country = contact_info.get('country', '')
        location_parts = [p for p in [city, country] if p]
        if location_parts:
            location = ', '.join(location_parts)
    personal_info['location'] = location or ''

    # Transform sections
    transformed_sections = []

    for section in sections:
        section_type = section.get('section_type', '').lower()
        section_title = section.get('title', '')
        entries = section.get('entries', [])

        # Filter out hidden entries
        visible_entries = []
        for entry in entries:
            items = entry.get('items', [])
            visible_items = [item for item in items if item.get('id') not in hidden_items]

            # Check sub-entries too
            has_visible_content = bool(visible_items)
            if not has_visible_content:
                sub_entries = entry.get('sub_entries', [])
                for sub_entry in sub_entries:
                    sub_items = sub_entry.get('items', [])
                    if any(item.get('id') not in hidden_items for item in sub_items):
                        has_visible_content = True
                        break

            if has_visible_content or entry.get('description') or entry.get('title'):
                visible_entries.append(entry)

        if not visible_entries:
            continue

        # Transform based on section type
        transformed_section = {
            'type': section_type,
            'title': section_title,
            'items': []
        }

        # Handle different section types
        if section_type in ['experience', 'work_experience', 'professional_experience']:
            for entry in visible_entries:
                exp_item = {
                    'position': entry.get('title', ''),
                    'company': entry.get('subtitle', ''),
                    'location': entry.get('location', ''),
                    'date_range': _format_date_range(entry),
                    'description': _extract_description_items(entry, hidden_items)
                }
                transformed_section['items'].append(exp_item)

        elif section_type == 'education':
            for entry in visible_entries:
                edu_item = {
                    'degree': entry.get('title', ''),
                    'school': entry.get('subtitle', ''),
                    'field': entry.get('field', ''),
                    'date_range': _format_date_range(entry),
                    'gpa': entry.get('gpa', ''),
                    'honors': _extract_description_items(entry, hidden_items)
                }
                transformed_section['items'].append(edu_item)

        elif section_type == 'skills':
            # Extract skill items
            for entry in visible_entries:
                items = entry.get('items', [])
                for item in items:
                    if item.get('id') not in hidden_items:
                        transformed_section['items'].append({
                            'name': item.get('content', item.get('text', ''))
                        })

        elif section_type == 'projects':
            for entry in visible_entries:
                project_item = {
                    'name': entry.get('title', ''),
                    'description': entry.get('description', ''),
                    'technologies': _extract_description_items(entry, hidden_items),
                    'link': entry.get('link', '')
                }
                transformed_section['items'].append(project_item)

        elif section_type == 'summary':
            # Summary is usually a single text block
            if visible_entries:
                summary_text = visible_entries[0].get('description', '')
                if not summary_text:
                    # Try to get from items
                    items = visible_entries[0].get('items', [])
                    visible_items = [item for item in items if item.get('id') not in hidden_items]
                    summary_text = ' '.join([item.get('content', item.get('text', '')) for item in visible_items])
                transformed_section['content'] = summary_text

        else:
            # Generic section - extract all visible items
            for entry in visible_entries:
                items = entry.get('items', [])
                for item in items:
                    if item.get('id') not in hidden_items:
                        transformed_section['items'].append(
                            item.get('content', item.get('text', ''))
                        )

        transformed_sections.append(transformed_section)

    return {
        'personal_info': personal_info,
        'sections': transformed_sections
    }


def _format_date_range(entry: Dict[str, Any]) -> str:
    """Format date range from entry"""
    start = entry.get('start_date', '')
    end = entry.get('end_date', '')

    if start and end:
        return f"{start} - {end}"
    elif start:
        return f"{start} - Present"
    elif end:
        return end
    return ''


def _extract_description_items(entry: Dict[str, Any], hidden_items: List[int]) -> List[str]:
    """Extract description items from entry, filtering hidden ones"""
    description = []

    # Check direct description field
    if entry.get('description'):
        description.append(entry['description'])

    # Check items
    items = entry.get('items', [])
    for item in items:
        if item.get('id') not in hidden_items:
            content = item.get('content', item.get('text', ''))
            if content:
                description.append(content)

    # Check sub-entries
    sub_entries = entry.get('sub_entries', [])
    for sub_entry in sub_entries:
        sub_items = sub_entry.get('items', [])
        for item in sub_items:
            if item.get('id') not in hidden_items:
                content = item.get('content', item.get('text', ''))
                if content:
                    description.append(content)

    return description


def sanitize_text(text: str) -> str:
    """
    Sanitize text for PDF generation by replacing problematic Unicode characters
    with safe alternatives that work with ReportLab's latin-1 encoding.

    Args:
        text: Raw text string that may contain Unicode characters

    Returns:
        Sanitized text safe for PDF generation with latin-1 encoding
    """
    if not text:
        return ""

    # Replace common problematic Unicode characters with safe alternatives
    replacements = {
        '\u2013': '-',      # EN DASH
        '\u2014': '--',     # EM DASH
        '\u2018': "'",      # LEFT SINGLE QUOTATION MARK
        '\u2019': "'",      # RIGHT SINGLE QUOTATION MARK
        '\u201c': '"',      # LEFT DOUBLE QUOTATION MARK
        '\u201d': '"',      # RIGHT DOUBLE QUOTATION MARK
        '\u2022': '-',      # BULLET (changed from * to - for better readability)
        '\u2026': '...',    # HORIZONTAL ELLIPSIS
        '\u00a0': ' ',      # NON-BREAKING SPACE
        '\u00b7': '*',      # MIDDLE DOT
        '\u2122': 'TM',     # TRADEMARK SIGN
        '\u00ae': '(R)',    # REGISTERED SIGN
        '\u00a9': '(C)',    # COPYRIGHT SIGN
        '\u00b0': ' deg',   # DEGREE SIGN
        '\u00d7': 'x',      # MULTIPLICATION SIGN
        '\u00f7': '/',      # DIVISION SIGN
        '\u2190': '<-',     # LEFTWARDS ARROW
        '\u2192': '->',     # RIGHTWARDS ARROW
        '\u2191': '^',      # UPWARDS ARROW
        '\u2193': 'v',      # DOWNWARDS ARROW
        '\u2194': '<->',    # LEFT RIGHT ARROW
        '\u2264': '<=',     # LESS-THAN OR EQUAL TO
        '\u2265': '>=',     # GREATER-THAN OR EQUAL TO
        '\u2260': '!=',     # NOT EQUAL TO
        '\u2212': '-',      # MINUS SIGN
        '\u00d7': 'x',      # MULTIPLICATION SIGN
        '\u2032': "'",      # PRIME
        '\u2033': "''",     # DOUBLE PRIME
        '\u2019': "'",      # RIGHT SINGLE QUOTATION MARK (curly apostrophe)
        '\u00ab': '<<',     # LEFT-POINTING DOUBLE ANGLE QUOTATION MARK
        '\u00bb': '>>',     # RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK
        # Smart quotes and dashes
        '\u2018': "'",
        '\u2019': "'",
        '\u201a': ',',
        '\u201b': "'",
        '\u201c': '"',
        '\u201d': '"',
        '\u201e': ',,',
        '\u2032': "'",
        '\u2033': '"',
    }

    for unicode_char, replacement in replacements.items():
        text = text.replace(unicode_char, replacement)

    # Remove or replace any remaining characters outside latin-1 range (0-255)
    # This prevents the 'latin-1' codec error
    cleaned_chars = []
    for char in text:
        char_code = ord(char)
        if char_code <= 255:
            # Character is in latin-1 range, keep it
            cleaned_chars.append(char)
        elif char_code < 128:
            # ASCII character, definitely keep it
            cleaned_chars.append(char)
        else:
            # Character outside latin-1 range, try to find closest ASCII equivalent
            # or just skip it (could also use 'replace' with '?')
            try:
                # Try to encode as ASCII and ignore if it fails
                char.encode('ascii')
                cleaned_chars.append(char)
            except:
                # Skip non-latin-1 characters
                pass

    return ''.join(cleaned_chars)


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
                "accent_color": "#2563eb",       # Professional blue
                "font_size_name": 24,
                "font_size_section": 13,
                "font_size_body": 10,
                "spacing": "normal",
                "line_thickness": 1.5,
                "header_style": "centered",
                "section_style": "underline",
                "use_tables": False,
                "font_name": "Helvetica",
                "font_bold": "Helvetica-Bold"
            },
            "modern": {
                "primary_color": "#0f172a",      # Slate dark
                "secondary_color": "#475569",    # Slate medium
                "accent_color": "#0ea5e9",       # Sky blue
                "font_size_name": 28,
                "font_size_section": 14,
                "font_size_body": 10,
                "spacing": "relaxed",
                "line_thickness": 0.5,
                "header_style": "centered",
                "section_style": "bold_line",
                "use_tables": False,
                "font_name": "Helvetica",
                "font_bold": "Helvetica-Bold"
            },
            "compact": {
                "primary_color": "#000000",
                "secondary_color": "#374151",
                "accent_color": "#059669",       # Emerald green
                "font_size_name": 20,
                "font_size_section": 11,
                "font_size_body": 9,
                "spacing": "tight",
                "line_thickness": 0.75,
                "header_style": "left_aligned",
                "section_style": "minimal",
                "use_tables": True,
                "font_name": "Helvetica",
                "font_bold": "Helvetica-Bold"
            },
            "creative": {
                "primary_color": "#7c3aed",      # Violet
                "secondary_color": "#4c1d95",    # Deep violet
                "accent_color": "#c026d3",       # Fuchsia
                "font_size_name": 30,
                "font_size_section": 15,
                "font_size_body": 10,
                "spacing": "relaxed",
                "line_thickness": 3.0,
                "header_style": "creative",
                "section_style": "colored_box",
                "use_tables": False,
                "font_name": "Helvetica",
                "font_bold": "Helvetica-Bold"
            },
            "ats_optimized": {
                "primary_color": "#000000",      # Pure black for ATS
                "secondary_color": "#000000",    # Pure black
                "accent_color": "#000000",       # No color accents
                "font_size_name": 18,
                "font_size_section": 12,
                "font_size_body": 10,
                "spacing": "normal",
                "line_thickness": 1.0,
                "header_style": "simple",
                "section_style": "ats_simple",
                "use_tables": False,
                "font_name": "Helvetica",        # ATS-friendly font
                "font_bold": "Helvetica-Bold"
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
            fontSize=config.get("font_size_body", 10),
            textColor=colors.HexColor(config["secondary_color"]),
            spaceAfter=int(4 * spacing_multiplier),
            leftIndent=20,
            bulletIndent=10,
            fontName=config.get("font_name", "Helvetica")
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

    def __init__(self, template_name: str = "modern", customizations: Optional[Dict[str, str]] = None):
        self.template = PDFTemplate(template_name)
        self.customizations = customizations or {}
        self._apply_customizations()

    def _apply_customizations(self):
        """Apply user customizations to template config"""
        config = self.template.config

        # Apply font size customization
        font_size = self.customizations.get('fontSize', 'normal')
        if font_size == 'small':
            config['font_size_name'] = int(config['font_size_name'] * 0.85)
            config['font_size_section'] = int(config['font_size_section'] * 0.9)
            config['font_size_body'] = int(config['font_size_body'] * 0.9)
        elif font_size == 'large':
            config['font_size_name'] = int(config['font_size_name'] * 1.15)
            config['font_size_section'] = int(config['font_size_section'] * 1.1)
            config['font_size_body'] = int(config['font_size_body'] * 1.1)

        # Apply spacing customization (override template default)
        spacing = self.customizations.get('spacing')
        if spacing in ['tight', 'normal', 'relaxed']:
            config['spacing'] = spacing

        # Apply color intensity customization (for non-ATS templates)
        color_intensity = self.customizations.get('colorIntensity', 'normal')
        if self.template.template_name != 'ats_optimized':
            if color_intensity == 'subtle':
                # Make colors more subtle by lightening them
                config['line_thickness'] = config['line_thickness'] * 0.7
            elif color_intensity == 'bold':
                # Make colors bolder
                config['line_thickness'] = config['line_thickness'] * 1.3

        # Regenerate styles with new config
        self.template.styles = self.template._create_styles()

    def _extract_linkedin_username(self, linkedin_url: str) -> str:
        """Extract username from LinkedIn URL"""
        # Remove trailing slash
        linkedin_url = linkedin_url.rstrip('/')
        # Try to extract username from URL patterns:
        # https://www.linkedin.com/in/username
        # https://linkedin.com/in/username
        # linkedin.com/in/username
        match = re.search(r'linkedin\.com/in/([^/?\s]+)', linkedin_url, re.IGNORECASE)
        if match:
            return match.group(1)
        # If it's already just a username, return it
        if '/' not in linkedin_url and '.' not in linkedin_url:
            return linkedin_url
        # Fallback to the URL itself
        return linkedin_url

    def _extract_github_username(self, github_url: str) -> str:
        """Extract username from GitHub URL"""
        # Remove trailing slash
        github_url = github_url.rstrip('/')
        # Try to extract username from URL patterns:
        # https://github.com/username
        # github.com/username
        match = re.search(r'github\.com/([^/?\s]+)', github_url, re.IGNORECASE)
        if match:
            return match.group(1)
        # If it's already just a username, return it
        if '/' not in github_url and '.' not in github_url:
            return github_url
        # Fallback to the URL itself
        return github_url

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
        try:
            story.extend(self._build_header(cv_data))
        except Exception as e:
            print(f"[PDF] Error in _build_header: {e}")
            raise

        # Add sections
        try:
            story.extend(self._build_sections(cv_data, hidden_items))
        except Exception as e:
            print(f"[PDF] Error in _build_sections: {e}")
            raise

        # Build the PDF
        try:
            doc.build(story)
        except Exception as e:
            print(f"[PDF] Error in doc.build(): {e}")
            print(f"[PDF] Story has {len(story)} elements")
            # Print details of story elements for debugging
            for i, element in enumerate(story[:20]):  # Print first 20 elements
                if hasattr(element, 'text'):
                    # Check if text contains non-latin-1 characters
                    try:
                        element.text.encode('latin-1')
                        print(f"[PDF] Story[{i}]: {type(element).__name__} - OK")
                    except UnicodeEncodeError as ue:
                        print(f"[PDF] Story[{i}]: {type(element).__name__} - ENCODING ERROR!")
                        print(f"[PDF]   Text: {element.text[:100]}")
                        print(f"[PDF]   Error: {ue}")
                else:
                    print(f"[PDF] Story[{i}]: {type(element).__name__}")
            raise

        buffer.seek(0)
        return _normalize_pdf_metadata(buffer)

    def _build_header(self, cv_data: Dict[str, Any]) -> List:
        """Build the header section with contact info"""
        story = []
        styles = self.template.styles
        config = self.template.config
        header_style = config.get("header_style", "centered")

        # Get contact info from selected_content
        selected_content = cv_data.get('selected_content', {})
        contact_info = selected_content.get('contact_info', {})

        # Name
        full_name = contact_info.get('full_name', 'N/A')

        # Job title (if available) - support both field names
        job_title = contact_info.get('professional_title') or contact_info.get('job_title', '')

        # Build contact parts (sanitize all text to prevent encoding errors)
        contact_parts = []
        if contact_info.get('email'):
            contact_parts.append(sanitize_text(contact_info['email']))

        # Support both phone and phone_number field names
        phone = contact_info.get('phone_number') or contact_info.get('phone')
        if phone:
            contact_parts.append(sanitize_text(phone))

        # Build location from city and country, or use location field
        location = contact_info.get('location')
        if not location:
            city = contact_info.get('city', '')
            country = contact_info.get('country', '')
            location_parts = [sanitize_text(p) for p in [city, country] if p]
            if location_parts:
                location = ', '.join(location_parts)
        if location:
            contact_parts.append(sanitize_text(location))

        # LinkedIn - support both field names
        linkedin_url = contact_info.get('linkedin_url') or contact_info.get('linkedin')
        if linkedin_url:
            linkedin_url = sanitize_text(linkedin_url)
            # Extract username from LinkedIn URL
            linkedin_username = self._extract_linkedin_username(linkedin_url)
            if header_style == "simple" or header_style == "left_aligned":
                contact_parts.append(f'LinkedIn: {linkedin_username}')
            else:
                contact_parts.append(f'<a href="{linkedin_url}" color="#0077B5">LinkedIn: {linkedin_username}</a>')

        # GitHub - support both field names
        github_url = contact_info.get('github_url') or contact_info.get('github')
        if github_url:
            github_url = sanitize_text(github_url)
            # Extract username from GitHub URL
            github_username = self._extract_github_username(github_url)
            if header_style == "simple" or header_style == "left_aligned":
                contact_parts.append(f'GitHub: {github_username}')
            else:
                contact_parts.append(f'<a href="{github_url}" color="#171515">GitHub: {github_username}</a>')

        # Portfolio/Website - support both field names
        website_url = contact_info.get('portfolio_url') or contact_info.get('website')
        if website_url:
            website_url = sanitize_text(website_url)
            contact_parts.append(f'<a href="{website_url}" color="#2d3748">{website_url}</a>')

        # Build header based on style
        if header_style == "simple":
            # ATS-Optimized: Simple, left-aligned, single-line contact info
            sanitized_name = sanitize_text(full_name)
            story.append(Paragraph(f"<b>{sanitized_name}</b>", styles['CVName']))
            if job_title:
                story.append(Paragraph(sanitize_text(job_title), styles['CVJobTitle']))
            if contact_parts:
                # Use pipe separator for ATS compatibility (latin-1 safe)
                # Note: contact_parts already contains sanitized text and safe HTML
                contact_line = " | ".join(contact_parts)
                story.append(Paragraph(contact_line, styles['CVContact']))
            # Simple horizontal line separator
            story.append(HRFlowable(
                width="100%",
                thickness=1.0,
                color=colors.HexColor('#000000'),
                spaceBefore=6,
                spaceAfter=10
            ))

        elif header_style == "left_aligned":
            # Compact: Left-aligned header
            story.append(Paragraph(sanitize_text(full_name), styles['CVName']))
            if job_title:
                story.append(Paragraph(sanitize_text(job_title), styles['CVJobTitle']))
            if contact_parts:
                # contact_parts already contains sanitized text and safe HTML
                contact_line = " | ".join(contact_parts)
                story.append(Paragraph(contact_line, styles['CVContact']))
            story.append(HRFlowable(
                width="100%",
                thickness=config["line_thickness"],
                color=colors.HexColor(config["accent_color"]),
                spaceBefore=6,
                spaceAfter=10
            ))

        elif header_style == "creative":
            # Creative: Bold, centered with colored accents
            story.append(Paragraph(sanitize_text(full_name), styles['CVName']))
            if job_title:
                story.append(Paragraph(sanitize_text(job_title), styles['CVJobTitle']))
            if contact_parts:
                # contact_parts already contains sanitized text and safe HTML
                contact_line = " | ".join(contact_parts)
                story.append(Paragraph(contact_line, styles['CVContact']))
            story.append(HRFlowable(
                width="60%",
                thickness=config["line_thickness"],
                color=colors.HexColor(config["accent_color"]),
                spaceBefore=8,
                spaceAfter=12
            ))

        else:
            # Default: Centered (professional, modern)
            story.append(Paragraph(sanitize_text(full_name), styles['CVName']))
            if job_title:
                story.append(Paragraph(sanitize_text(job_title), styles['CVJobTitle']))
            if contact_parts:
                # contact_parts already contains sanitized text and safe HTML
                contact_line = " | ".join(contact_parts)
                story.append(Paragraph(contact_line, styles['CVContact']))
            story.append(HRFlowable(
                width="100%",
                thickness=config["line_thickness"],
                color=colors.HexColor('#cbd5e0'),
                spaceBefore=0,
                spaceAfter=12
            ))

        return story

    def _build_sections(self, cv_data: Dict[str, Any], hidden_items: List[int]) -> List:
        """Build all CV sections in the order they are provided"""
        story = []
        styles = self.template.styles

        selected_content = cv_data.get('selected_content', {})
        sections = selected_content.get('sections', [])

        # Use sections in the order they are provided (already reordered in backend if needed)
        # No need to reorder here - respect the order from the input
        for section in sections:
            section_content = self._build_section(section, hidden_items)
            if section_content:  # Only add if there's visible content
                story.extend(section_content)

        return story

    def _build_section(self, section: Dict[str, Any], hidden_items: List[int]) -> List:
        """Build a single section"""
        story = []
        styles = self.template.styles
        config = self.template.config
        section_style = config.get("section_style", "underline")

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

        # Section heading with style-specific formatting
        if section_style == "ats_simple":
            # ATS-Optimized: Simple uppercase with minimal decoration
            story.append(Paragraph(sanitize_text(section_title.upper()), styles['CVSectionHeading']))
            story.append(HRFlowable(
                width="100%",
                thickness=1.0,
                color=colors.black,
                spaceBefore=0,
                spaceAfter=6
            ))

        elif section_style == "minimal":
            # Compact: Minimal decoration
            story.append(Paragraph(sanitize_text(section_title.upper()), styles['CVSectionHeading']))
            story.append(Spacer(1, 0.05*inch))

        elif section_style == "colored_box":
            # Creative: Colored background box for section title
            story.append(Paragraph(sanitize_text(section_title.upper()), styles['CVSectionHeading']))
            story.append(HRFlowable(
                width="100%",
                thickness=config["line_thickness"],
                color=colors.HexColor(config["accent_color"]),
                spaceBefore=2,
                spaceAfter=10
            ))

        elif section_style == "bold_line":
            # Modern: Bold accent line
            story.append(Paragraph(sanitize_text(section_title.upper()), styles['CVSectionHeading']))
            story.append(HRFlowable(
                width="30%",
                thickness=config["line_thickness"] * 2,
                color=colors.HexColor(config["accent_color"]),
                spaceBefore=2,
                spaceAfter=8
            ))

        else:
            # Default: Underline (professional)
            story.append(Paragraph(sanitize_text(section_title.upper()), styles['CVSectionHeading']))
            story.append(HRFlowable(
                width="100%",
                thickness=config["line_thickness"] * 0.5,
                color=colors.HexColor(config["accent_color"]),
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
            node_type = item.get('node_type', 'bullet')  # Default to bullet for backward compatibility
            if content:
                # Add bullet point only if node_type is 'bullet' or 'item', not 'paragraph'
                if node_type.lower() in ['bullet', 'item']:
                    bullet_text = f"• {content}"
                    story.append(Paragraph(sanitize_text(bullet_text), styles['CVBullet']))
                else:
                    # For paragraph type, just add the content without bullet
                    story.append(Paragraph(sanitize_text(content), styles['CVDescription']))

        # Handle sub-entries (for hierarchical work experience)
        sub_entries = entry.get('sub_entries', [])
        if sub_entries:
            for sub_entry in sub_entries:
                # Sub-entry title (e.g., "Product Management", "Technical Leadership")
                sub_title = sub_entry.get('title', '')
                if sub_title:
                    # Add some space before sub-entry
                    story.append(Spacer(1, 0.08*inch))
                    # Sub-entry title in italic/bold - sanitize first, then wrap in HTML
                    sanitized_sub_title = sanitize_text(sub_title)
                    story.append(Paragraph(f"<i><b>{sanitized_sub_title}</b></i>", styles['CVEntrySubtitle']))

                # Sub-entry items
                sub_items = sub_entry.get('items', [])
                visible_sub_items = [item for item in sub_items if item['id'] not in hidden_items]
                visible_sub_items.sort(key=lambda x: x.get('order', 0))

                for item in visible_sub_items:
                    content = item.get('content', '')
                    node_type = item.get('node_type', 'bullet')  # Default to bullet for backward compatibility
                    if content:
                        # Add bullet point only if node_type is 'bullet' or 'item', not 'paragraph'
                        if node_type.lower() in ['bullet', 'item']:
                            bullet_text = f"• {content}"
                            story.append(Paragraph(sanitize_text(bullet_text), styles['CVBullet']))
                        else:
                            # For paragraph type, just add the content without bullet
                            story.append(Paragraph(sanitize_text(content), styles['CVDescription']))

        # Add spacing after entry
        story.append(Spacer(1, 0.15*inch))

        return story


def generate_cv_pdf(
    cv_data: Dict[str, Any],
    hidden_items: Optional[List[int]] = None,
    template_name: str = "modern",
    customizations: Optional[Dict[str, str]] = None
) -> BytesIO:
    """
    Convenience function to generate a CV PDF
    Routes to appropriate generator (WeasyPrint or ReportLab) based on template

    Args:
        cv_data: CV data dictionary
        hidden_items: List of item IDs to hide
        template_name: Name of the template to use
        customizations: Dict with fontSize, spacing, colorIntensity options

    Returns:
        BytesIO buffer containing the PDF
    """
    # Check if we should use HTML2PDF for this template
    if template_name in HTML2PDF_TEMPLATES and HTML2PDF_AVAILABLE:
        print(f"[PDF_SERVICE] Using HTML2PDF generator for template: {template_name}")

        # Transform cv_data to format expected by HTML2PDF generator
        html2pdf_data = _transform_cv_data_for_weasyprint(cv_data, hidden_items)

        # Create HTML2PDF generator
        generator = WeasyPrintCVGenerator(
            cv_data=html2pdf_data,
            template=template_name,
            customizations=customizations or {}
        )

        return _normalize_pdf_metadata(generator.generate())
    else:
        # Use ReportLab generator (original implementation)
        print(f"[PDF_SERVICE] Using ReportLab generator for template: {template_name}")
        generator = CVPDFGenerator(template_name, customizations)
        return generator.generate_pdf(cv_data, hidden_items)


def get_cv_pdf_metadata(
    cv_data: Dict[str, Any],
    hidden_items: Optional[List[int]] = None,
    template_name: str = "modern",
    customizations: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Generate metadata about the PDF without creating the full document.
    Returns page count, word count, and other statistics.

    Args:
        cv_data: CV data dictionary
        hidden_items: List of item IDs to hide
        template_name: Name of the template to use
        customizations: Dict with fontSize, spacing, colorIntensity options

    Returns:
        Dictionary with metadata: page_count, word_count, character_count, etc.
    """
    from PyPDF2 import PdfReader

    # Generate the PDF first using the same routing logic
    pdf_buffer = generate_cv_pdf(cv_data, hidden_items, template_name, customizations)

    # Read the PDF to get page count
    pdf_reader = PdfReader(pdf_buffer)
    page_count = len(pdf_reader.pages)

    # Calculate word and character count from selected content
    word_count = 0
    character_count = 0
    section_count = 0

    selected_content = cv_data.get('selected_content', {})

    # Count words from contact info
    contact_info = selected_content.get('contact_info', {})
    for field, value in contact_info.items():
        if isinstance(value, str) and value:
            words = value.split()
            word_count += len(words)
            character_count += len(value)

    # Count words from sections
    sections = selected_content.get('sections', [])
    section_count = len(sections)

    for section in sections:
        # Section title
        if section.get('title'):
            words = section['title'].split()
            word_count += len(words)
            character_count += len(section['title'])

        # Section entries
        for entry in section.get('entries', []):
            # Entry fields
            for field in ['title', 'subtitle', 'location', 'description']:
                if entry.get(field):
                    words = entry[field].split()
                    word_count += len(words)
                    character_count += len(entry[field])

            # Entry items (bullets)
            for item in entry.get('items', []):
                if isinstance(item, dict) and item.get('content'):
                    words = item['content'].split()
                    word_count += len(words)
                    character_count += len(item['content'])
                elif isinstance(item, str):
                    words = item.split()
                    word_count += len(words)
                    character_count += len(item)

    return {
        'page_count': page_count,
        'word_count': word_count,
        'character_count': character_count,
        'section_count': section_count,
        'template': template_name,
        'customizations': customizations or {}
    }


def generate_cv_preview_image(
    cv_data: Dict[str, Any],
    hidden_items: Optional[List[int]] = None,
    template_name: str = "modern",
    customizations: Optional[Dict[str, str]] = None,
    page_index: int = 0,
    scale: float = 2.0
) -> BytesIO:
    """
    Generate a PNG preview image of a specific page from the CV PDF.

    Args:
        cv_data: CV data dictionary
        hidden_items: List of item IDs to hide
        template_name: Name of the template to use
        customizations: Dict with fontSize, spacing, colorIntensity options
        page_index: Which page to generate preview for (0-indexed)
        scale: Scaling factor for image quality (higher = better quality, larger file)

    Returns:
        BytesIO buffer containing the PNG image
    """
    try:
        from pdf2image import convert_from_bytes
    except ImportError:
        raise ImportError(
            "pdf2image is required for preview generation. "
            "Install it with: pip install pdf2image"
        )

    # Generate the PDF using hybrid routing (will use HTML2PDF for modern/creative, ReportLab for others)
    pdf_buffer = generate_cv_pdf(cv_data, hidden_items, template_name, customizations)

    # Convert PDF to images
    images = convert_from_bytes(
        pdf_buffer.getvalue(),
        dpi=int(72 * scale),  # Scale DPI for quality
        first_page=page_index + 1,
        last_page=page_index + 1
    )

    if not images:
        raise ValueError(f"Failed to generate preview for page {page_index}")

    # Convert PIL Image to PNG bytes
    img_buffer = BytesIO()
    images[0].save(img_buffer, format='PNG', optimize=True)
    img_buffer.seek(0)

    return img_buffer


def generate_cv_preview_all_pages(
    cv_data: Dict[str, Any],
    hidden_items: Optional[List[int]] = None,
    template_name: str = "modern",
    customizations: Optional[Dict[str, str]] = None,
    scale: float = 1.5
) -> BytesIO:
    """
    Generate a PNG preview image containing ALL pages from the CV PDF, stacked vertically.

    Args:
        cv_data: CV data dictionary
        hidden_items: List of item IDs to hide
        template_name: Name of the template to use
        customizations: Dict with fontSize, spacing, colorIntensity options
        scale: Scaling factor for image quality (higher = better quality, larger file)

    Returns:
        BytesIO buffer containing the PNG image with all pages
    """
    try:
        from pdf2image import convert_from_bytes
        from PIL import Image
    except ImportError:
        raise ImportError(
            "pdf2image and PIL are required for preview generation. "
            "Install them with: pip install pdf2image pillow"
        )

    # Generate the PDF using hybrid routing (will use HTML2PDF for modern/creative, ReportLab for others)
    pdf_buffer = generate_cv_pdf(cv_data, hidden_items, template_name, customizations)

    # Convert all PDF pages to images
    images = convert_from_bytes(
        pdf_buffer.getvalue(),
        dpi=int(72 * scale)  # Scale DPI for quality
    )

    if not images:
        raise ValueError("Failed to generate preview - no pages found")

    # If only one page, return it directly
    if len(images) == 1:
        img_buffer = BytesIO()
        images[0].save(img_buffer, format='PNG', optimize=True)
        img_buffer.seek(0)
        return img_buffer

    # Stack multiple pages vertically with spacing between them
    page_spacing = 20  # pixels between pages

    # Calculate dimensions for the combined image
    widths = [img.width for img in images]
    heights = [img.height for img in images]
    max_width = max(widths)
    total_height = sum(heights) + (page_spacing * (len(images) - 1))

    # Create a new image with white background
    combined_image = Image.new('RGB', (max_width, total_height), 'white')

    # Paste each page onto the combined image
    y_offset = 0
    for img in images:
        # Center the image horizontally if it's narrower than max_width
        x_offset = (max_width - img.width) // 2
        combined_image.paste(img, (x_offset, y_offset))
        y_offset += img.height + page_spacing

    # Convert to PNG bytes
    img_buffer = BytesIO()
    combined_image.save(img_buffer, format='PNG', optimize=True)
    img_buffer.seek(0)

    return img_buffer
