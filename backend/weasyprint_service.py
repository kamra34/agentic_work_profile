"""
HTML2PDF PDF Generation Service for Modern CVs
Supports HTML/CSS-based templates with advanced layouts
Using xhtml2pdf (pisa) for cross-platform compatibility
Version: 2.0.0
"""

print("[HTML2PDF_SERVICE] Module loaded - Version 2.0.0")

from xhtml2pdf import pisa
from io import BytesIO
from typing import Dict, List, Optional, Any
import html as html_lib
from datetime import datetime


def safe_escape(value: Any, default: str = '') -> str:
    """Safely escape HTML, handling None values"""
    if value is None:
        return default
    return html_lib.escape(str(value))


class WeasyPrintCVGenerator:
    """
    Generate CVs using WeasyPrint (HTML/CSS to PDF)
    Supports advanced layouts like multi-column, flexbox, grid
    """

    def __init__(self, cv_data: Dict[str, Any], template: str = "modern",
                 customizations: Optional[Dict[str, Any]] = None):
        """
        Initialize the WeasyPrint CV generator

        Args:
            cv_data: Dictionary containing all CV data (sections, content, metadata)
            template: Template name (e.g., "modern", "creative")
            customizations: Optional customizations (font_size, spacing, color_intensity)
        """
        self.cv_data = cv_data
        self.template = template
        self.customizations = customizations or {}

    def generate(self) -> BytesIO:
        """
        Generate PDF and return as BytesIO

        Returns:
            BytesIO containing the generated PDF
        """
        try:
            # Generate HTML content with embedded CSS
            html_content = self._generate_html_with_css()

            # Create PDF using xhtml2pdf
            pdf_buffer = BytesIO()
            pisa_status = pisa.CreatePDF(
                src=html_content,
                dest=pdf_buffer
            )

            if pisa_status.err:
                raise Exception(f"Error generating PDF: {pisa_status.err}")

            pdf_buffer.seek(0)
            return pdf_buffer
        except Exception as e:
            print(f"[HTML2PDF_SERVICE] Error in generate(): {e}")
            import traceback
            traceback.print_exc()
            raise

    def _generate_html_with_css(self) -> str:
        """Generate complete HTML document with embedded CSS"""
        html_content = self._generate_html()
        css_content = self._generate_css()

        # Safety check
        if not html_content:
            raise Exception("HTML content generation returned None")
        if not css_content:
            raise Exception("CSS content generation returned None")

        # Inject CSS into HTML <head>
        css_tag = f'<style>{css_content}</style>'
        html_content = html_content.replace('</head>', f'{css_tag}</head>')

        return html_content

    def _generate_html(self) -> str:
        """Generate HTML structure for the CV"""

        sections = self.cv_data.get('sections', [])
        personal_info = self.cv_data.get('personal_info', {})

        # Start HTML document
        html_parts = [
            '<!DOCTYPE html>',
            '<html lang="en">',
            '<head>',
            '<meta charset="UTF-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
            '<title>CV</title>',
            '</head>',
            '<body>',
            '<div class="cv-container">',
        ]

        # Add header
        header_html = self._generate_header(personal_info)
        if header_html:
            html_parts.append(header_html)

        # Add sections based on template
        if self.template == "modern":
            sections_html = self._generate_modern_sections(sections)
        else:
            sections_html = self._generate_default_sections(sections)

        if sections_html:
            html_parts.append(sections_html)

        # Close HTML document
        html_parts.extend([
            '</div>',
            '</body>',
            '</html>'
        ])

        return '\n'.join(html_parts)

    def _generate_header(self, personal_info: Dict[str, Any]) -> str:
        """Generate CV header with contact information"""
        name = safe_escape(personal_info.get('name'), 'Professional CV')
        email = safe_escape(personal_info.get('email'))
        phone = safe_escape(personal_info.get('phone'))
        location = safe_escape(personal_info.get('location'))
        linkedin = personal_info.get('linkedin', '')
        github = personal_info.get('github', '')

        header_parts = [
            '<header class="cv-header">',
            f'<h1 class="cv-name">{name}</h1>',
            '<div class="contact-info">',
        ]

        contact_items = []
        if email:
            contact_items.append(f'<span class="contact-item">{email}</span>')
        if phone:
            contact_items.append(f'<span class="contact-item">{phone}</span>')
        if location:
            contact_items.append(f'<span class="contact-item">{location}</span>')

        header_parts.append('<div class="contact-row">')
        header_parts.append(' <span class="separator">|</span> '.join(contact_items))
        header_parts.append('</div>')

        # Links row
        link_items = []
        if linkedin and linkedin is not None:
            linkedin_str = str(linkedin) if linkedin else ''
            linkedin_clean = html_lib.escape(linkedin_str.replace('https://www.linkedin.com/in/', '').replace('/', ''))
            link_items.append(f'<a href="{html_lib.escape(linkedin_str)}" class="contact-link">LinkedIn: {linkedin_clean}</a>')
        if github and github is not None:
            github_str = str(github) if github else ''
            github_clean = html_lib.escape(github_str.replace('https://github.com/', '').replace('/', ''))
            link_items.append(f'<a href="{html_lib.escape(github_str)}" class="contact-link">GitHub: {github_clean}</a>')

        if link_items:
            header_parts.append('<div class="links-row">')
            header_parts.append(' <span class="separator">|</span> '.join(link_items))
            header_parts.append('</div>')

        header_parts.extend([
            '</div>',
            '</header>',
        ])

        return '\n'.join(header_parts)

    def _generate_modern_sections(self, sections: List[Dict[str, Any]]) -> str:
        """Generate sections with modern multi-column layout"""

        # Separate sections into main (left) and sidebar (right)
        main_sections = []
        sidebar_sections = []

        for section in sections:
            section_type = section.get('type', '').lower()

            # Skills, Languages, Certifications, and Education go to sidebar
            if section_type in ['skills', 'languages', 'certifications', 'education']:
                sidebar_sections.append(section)
            else:
                main_sections.append(section)

        html_parts = [
            '<div class="modern-layout">',
            '<div class="main-column">',
        ]

        # Add main sections
        for section in main_sections:
            section_html = self._generate_section(section)
            if section_html:
                html_parts.append(section_html)

        html_parts.append('</div>')  # Close main-column

        # Add sidebar if there are sidebar sections
        if sidebar_sections:
            html_parts.append('<div class="sidebar-column">')
            for section in sidebar_sections:
                section_html = self._generate_section(section, is_sidebar=True)
                if section_html:
                    html_parts.append(section_html)
            html_parts.append('</div>')  # Close sidebar-column

        html_parts.append('</div>')  # Close modern-layout

        return '\n'.join(html_parts)

    def _generate_default_sections(self, sections: List[Dict[str, Any]]) -> str:
        """Generate sections in default single-column layout"""
        html_parts = ['<div class="sections-container">']

        for section in sections:
            section_html = self._generate_section(section)
            if section_html:
                html_parts.append(section_html)

        html_parts.append('</div>')
        return '\n'.join(html_parts)

    def _generate_section(self, section: Dict[str, Any], is_sidebar: bool = False) -> str:
        """Generate a single section"""
        section_type = section.get('type', '').lower()
        title = html_lib.escape(section.get('title', section_type.title()))

        section_class = 'sidebar-section' if is_sidebar else 'main-section'

        html_parts = [
            f'<section class="{section_class}">',
            f'<h2 class="section-title">{title}</h2>',
        ]

        # Generate content based on section type
        content_html = None
        if section_type == 'summary':
            content_html = self._generate_summary(section)
        elif section_type in ['experience', 'work_experience', 'professional_experience']:
            content_html = self._generate_experience(section)
        elif section_type == 'education':
            content_html = self._generate_education(section)
        elif section_type == 'skills':
            content_html = self._generate_skills(section, is_sidebar)
        elif section_type == 'projects':
            content_html = self._generate_projects(section)
        elif section_type == 'certifications':
            content_html = self._generate_certifications(section)
        elif section_type == 'languages':
            content_html = self._generate_languages(section)
        else:
            content_html = self._generate_generic_section(section)

        if content_html:
            html_parts.append(content_html)

        html_parts.append('</section>')

        return '\n'.join(html_parts)

    def _generate_summary(self, section: Dict[str, Any]) -> str:
        """Generate summary section"""
        content = section.get('content', '')
        if isinstance(content, list):
            content = ' '.join(content)
        content = html_lib.escape(str(content))

        return f'<div class="summary-content"><p>{content}</p></div>'

    def _generate_experience(self, section: Dict[str, Any]) -> str:
        """Generate experience section"""
        items = section.get('items', [])

        html_parts = ['<div class="experience-list">']

        for item in items:
            company = safe_escape(item.get('company'))
            position = safe_escape(item.get('position'))
            location = safe_escape(item.get('location'))
            date_range = safe_escape(item.get('date_range'))
            description = item.get('description', [])

            if isinstance(description, str):
                description = [description]

            html_parts.extend([
                '<div class="experience-item">',
                '<div class="experience-header">',
                f'<div class="experience-title-row">',
                f'<span class="position">{position}</span>',
                f'<span class="date-range">{date_range}</span>',
                '</div>',
                f'<div class="company-location">',
                f'<span class="company">{company}</span>',
            ])

            if location:
                html_parts.append(f'<span class="location">{location}</span>')

            html_parts.append('</div>')
            html_parts.append('</div>')  # Close experience-header

            if description:
                html_parts.append('<ul class="description-list">')
                for desc_item in description:
                    html_parts.append(f'<li>{html_lib.escape(str(desc_item))}</li>')
                html_parts.append('</ul>')

            html_parts.append('</div>')  # Close experience-item

        html_parts.append('</div>')  # Close experience-list

        return '\n'.join(html_parts)

    def _generate_education(self, section: Dict[str, Any]) -> str:
        """Generate education section"""
        items = section.get('items', [])

        html_parts = ['<div class="education-list">']

        for item in items:
            school = safe_escape(item.get('school'))
            degree = safe_escape(item.get('degree'))
            field = safe_escape(item.get('field'))
            date_range = safe_escape(item.get('date_range'))
            gpa = item.get('gpa', '')
            honors = item.get('honors', [])

            html_parts.extend([
                '<div class="education-item">',
                '<div class="education-header">',
                f'<div class="degree-date-row">',
                f'<span class="degree">{degree} {field}</span>',
                f'<span class="date-range">{date_range}</span>',
                '</div>',
                f'<div class="school">{school}</div>',
            ])

            if gpa:
                html_parts.append(f'<div class="gpa">GPA: {html_lib.escape(str(gpa))}</div>')

            html_parts.append('</div>')  # Close education-header

            if honors:
                html_parts.append('<ul class="honors-list">')
                for honor in honors:
                    html_parts.append(f'<li>{html_lib.escape(str(honor))}</li>')
                html_parts.append('</ul>')

            html_parts.append('</div>')  # Close education-item

        html_parts.append('</div>')  # Close education-list

        return '\n'.join(html_parts)

    def _generate_skills(self, section: Dict[str, Any], is_sidebar: bool = False) -> str:
        """Generate skills section (grid layout for sidebar, list for main)"""
        items = section.get('items', [])

        if is_sidebar:
            # Compact tag-style layout for sidebar
            html_parts = ['<div class="skills-grid">']
            for skill in items:
                skill_name = html_lib.escape(str(skill.get('name', skill) if isinstance(skill, dict) else skill))
                html_parts.append(f'<span class="skill-tag">{skill_name}</span>')
            html_parts.append('</div>')
        else:
            # Categorized list for main column
            html_parts = ['<div class="skills-list">']
            for category in items:
                if isinstance(category, dict):
                    category_name = html_lib.escape(category.get('category', 'Skills'))
                    skills = category.get('skills', [])

                    html_parts.append(f'<div class="skill-category">')
                    html_parts.append(f'<strong>{category_name}:</strong> ')
                    html_parts.append(', '.join([html_lib.escape(str(s)) for s in skills]))
                    html_parts.append('</div>')
                else:
                    html_parts.append(f'<div class="skill-item">{html_lib.escape(str(category))}</div>')
            html_parts.append('</div>')

        return '\n'.join(html_parts)

    def _generate_projects(self, section: Dict[str, Any]) -> str:
        """Generate projects section"""
        items = section.get('items', [])

        html_parts = ['<div class="projects-list">']

        for project in items:
            name = html_lib.escape(project.get('name', ''))
            description = html_lib.escape(project.get('description', ''))
            technologies = project.get('technologies', [])
            link = project.get('link', '')

            html_parts.extend([
                '<div class="project-item">',
                f'<div class="project-name">{name}</div>',
                f'<div class="project-description">{description}</div>',
            ])

            if technologies:
                tech_str = ', '.join([html_lib.escape(str(t)) for t in technologies])
                html_parts.append(f'<div class="project-tech">Technologies: {tech_str}</div>')

            if link:
                html_parts.append(f'<div class="project-link"><a href="{html_lib.escape(link)}">{html_lib.escape(link)}</a></div>')

            html_parts.append('</div>')  # Close project-item

        html_parts.append('</div>')  # Close projects-list

        return '\n'.join(html_parts)

    def _generate_certifications(self, section: Dict[str, Any]) -> str:
        """Generate certifications section"""
        items = section.get('items', [])

        html_parts = ['<div class="certifications-list">']

        for cert in items:
            if isinstance(cert, dict):
                name = html_lib.escape(cert.get('name', ''))
                issuer = html_lib.escape(cert.get('issuer', ''))
                date = html_lib.escape(cert.get('date', ''))

                html_parts.append('<div class="certification-item">')
                html_parts.append(f'<div class="cert-name">{name}</div>')
                if issuer:
                    html_parts.append(f'<div class="cert-issuer">{issuer}</div>')
                if date:
                    html_parts.append(f'<div class="cert-date">{date}</div>')
                html_parts.append('</div>')
            else:
                html_parts.append(f'<div class="certification-item">{html_lib.escape(str(cert))}</div>')

        html_parts.append('</div>')

        return '\n'.join(html_parts)

    def _generate_languages(self, section: Dict[str, Any]) -> str:
        """Generate languages section"""
        items = section.get('items', [])

        html_parts = ['<div class="languages-list">']

        for lang in items:
            if isinstance(lang, dict):
                name = html_lib.escape(lang.get('name', ''))
                proficiency = html_lib.escape(lang.get('proficiency', ''))
                html_parts.append(f'<div class="language-item"><strong>{name}</strong>: {proficiency}</div>')
            else:
                html_parts.append(f'<div class="language-item">{html_lib.escape(str(lang))}</div>')

        html_parts.append('</div>')

        return '\n'.join(html_parts)

    def _generate_generic_section(self, section: Dict[str, Any]) -> str:
        """Generate generic section content"""
        content = section.get('content', '')
        items = section.get('items', [])

        html_parts = []

        if content:
            if isinstance(content, list):
                html_parts.append('<ul>')
                for item in content:
                    html_parts.append(f'<li>{html_lib.escape(str(item))}</li>')
                html_parts.append('</ul>')
            else:
                html_parts.append(f'<p>{html_lib.escape(str(content))}</p>')

        if items:
            html_parts.append('<ul>')
            for item in items:
                html_parts.append(f'<li>{html_lib.escape(str(item))}</li>')
            html_parts.append('</ul>')

        return '\n'.join(html_parts)

    def _generate_css(self) -> str:
        """Generate CSS styles for the CV"""

        # Get customization values
        font_size_scale = self._get_font_size_scale()
        spacing_scale = self._get_spacing_scale()
        colors = self._get_template_colors()

        # Base font sizes
        base_font = 11 * font_size_scale
        name_font = 32 * font_size_scale
        section_font = 16 * font_size_scale
        subsection_font = 13 * font_size_scale

        # Spacing values
        base_spacing = 12 * spacing_scale
        section_spacing = 20 * spacing_scale

        css = f"""
        @page {{
            size: A4;
            margin: 2cm 1.5cm;
        }}

        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: 'DejaVu Sans', 'Arial', sans-serif;
            font-size: {base_font}pt;
            line-height: 1.6;
            color: {colors['text']};
            background-color: {colors.get('body_bg', '#ffffff')};
        }}

        .cv-container {{
            max-width: 100%;
            background-color: white;
        }}

        /* Header Styles */
        .cv-header {{
            text-align: center;
            margin-bottom: {section_spacing * 1.5}pt;
            padding-bottom: {base_spacing}pt;
            border-bottom: 3px solid {colors['primary']};
        }}

        .cv-name {{
            font-size: {name_font}pt;
            font-weight: bold;
            color: {colors['primary']};
            margin-bottom: {base_spacing * 0.5}pt;
            letter-spacing: 1px;
        }}

        .contact-info {{
            font-size: {base_font * 0.9}pt;
            color: {colors['secondary']};
        }}

        .contact-row, .links-row {{
            margin-top: {base_spacing * 0.3}pt;
        }}

        .contact-item {{
            display: inline;
        }}

        .separator {{
            margin: 0 8pt;
            color: {colors['accent']};
        }}

        .contact-link {{
            color: {colors['accent']};
            text-decoration: none;
        }}

        /* Modern Multi-column Layout - using table for xhtml2pdf compatibility */
        .modern-layout {{
            width: 100%;
            display: table;
        }}

        .main-column {{
            width: 65%;
            display: table-cell;
            vertical-align: top;
            padding-right: 15pt;
        }}

        .sidebar-column {{
            width: 35%;
            display: table-cell;
            vertical-align: top;
            background-color: {colors['sidebar_bg']};
            padding: {base_spacing * 1.5}pt;
            color: {colors.get('sidebar_text', colors['text'])};
        }}

        /* Section Styles */
        .main-section {{
            margin-bottom: {section_spacing}pt;
        }}

        .sidebar-section {{
            margin-bottom: {section_spacing}pt;
        }}

        .section-title {{
            font-size: {section_font}pt;
            font-weight: bold;
            color: {colors['primary']};
            margin-bottom: {base_spacing}pt;
            padding-bottom: {base_spacing * 0.5}pt;
            border-bottom: 3pt solid {colors['accent']};
            text-transform: uppercase;
            letter-spacing: 1pt;
        }}

        .sidebar-section .section-title {{
            font-size: {subsection_font}pt;
            color: {colors.get('sidebar_text', colors['text'])};
            border-bottom: 2pt solid {colors.get('sidebar_text', colors['accent'])};
            padding-bottom: {base_spacing * 0.3}pt;
        }}

        /* Summary */
        .summary-content p {{
            text-align: justify;
            line-height: 1.5;
        }}

        /* Experience */
        .experience-list {{
            margin-top: {base_spacing}pt;
        }}

        .experience-item {{
            margin-bottom: {base_spacing * 1.2}pt;
            page-break-inside: avoid;
        }}

        .experience-header {{
            margin-bottom: {base_spacing * 0.5}pt;
        }}

        .experience-title-row {{
            width: 100%;
            margin-bottom: {base_spacing * 0.2}pt;
        }}

        .position {{
            font-size: {subsection_font}pt;
            font-weight: bold;
            color: {colors['primary']};
            float: left;
        }}

        .date-range {{
            font-size: {base_font * 0.85}pt;
            color: {colors['secondary']};
            font-style: italic;
            float: right;
        }}

        .company-location {{
            width: 100%;
            font-size: {base_font * 0.95}pt;
            clear: both;
        }}

        .company {{
            font-weight: 600;
            color: {colors['text']};
            float: left;
        }}

        .location {{
            color: {colors['secondary']};
            font-style: italic;
            float: right;
        }}

        .description-list {{
            margin-top: {base_spacing * 0.5}pt;
            margin-left: 15pt;
            list-style-type: disc;
        }}

        .description-list li {{
            margin-bottom: {base_spacing * 0.3}pt;
            line-height: 1.4;
        }}

        /* Education */
        .education-list {{
            margin-top: {base_spacing}pt;
        }}

        .education-item {{
            margin-bottom: {base_spacing * 1.2}pt;
            page-break-inside: avoid;
        }}

        .degree-date-row {{
            width: 100%;
            margin-bottom: {base_spacing * 0.2}pt;
        }}

        .degree {{
            font-size: {subsection_font}pt;
            font-weight: bold;
            color: {colors['primary']};
            float: left;
        }}

        /* Education in sidebar has white text */
        .sidebar-section .degree {{
            color: white;
        }}

        .school {{
            font-weight: 600;
            margin-bottom: {base_spacing * 0.2}pt;
            clear: both;
        }}

        .sidebar-section .school {{
            color: white;
        }}

        .gpa {{
            font-size: {base_font * 0.9}pt;
            color: {colors['secondary']};
        }}

        .sidebar-section .gpa {{
            color: rgba(255, 255, 255, 0.8);
        }}

        .honors-list {{
            margin-top: {base_spacing * 0.3}pt;
            margin-left: 15pt;
            list-style-type: circle;
        }}

        .sidebar-section .honors-list {{
            color: white;
        }}

        .sidebar-section .date-range {{
            color: rgba(255, 255, 255, 0.9);
        }}

        /* Skills */
        .skills-grid {{
            margin-top: {base_spacing * 0.5}pt;
            line-height: 2.2;
        }}

        .skill-tag {{
            background-color: {colors['tag_bg']};
            color: {colors['tag_text']};
            padding: 4pt 10pt;
            font-size: {base_font * 0.9}pt;
            display: inline-block;
            margin-right: 5pt;
            margin-bottom: 6pt;
            font-weight: 600;
            border-radius: 3pt;
        }}

        /* Skills in sidebar have white text */
        .sidebar-section .skill-tag {{
            background-color: rgba(255, 255, 255, 0.2);
            color: white;
            border: 1pt solid rgba(255, 255, 255, 0.3);
        }}

        .skills-list {{
            margin-top: {base_spacing * 0.5}pt;
        }}

        .skill-category {{
            margin-bottom: {base_spacing * 0.5}pt;
            line-height: 1.5;
        }}

        /* Projects */
        .projects-list {{
            margin-top: {base_spacing}pt;
        }}

        .project-item {{
            margin-bottom: {base_spacing * 1.2}pt;
            page-break-inside: avoid;
        }}

        .project-name {{
            font-size: {subsection_font}pt;
            font-weight: bold;
            color: {colors['primary']};
            margin-bottom: {base_spacing * 0.3}pt;
        }}

        .project-description {{
            margin-bottom: {base_spacing * 0.3}pt;
            line-height: 1.4;
        }}

        .project-tech {{
            font-size: {base_font * 0.9}pt;
            color: {colors['secondary']};
            font-style: italic;
        }}

        .project-link {{
            font-size: {base_font * 0.85}pt;
            margin-top: {base_spacing * 0.2}pt;
        }}

        .project-link a {{
            color: {colors['accent']};
            text-decoration: none;
        }}

        /* Certifications & Languages */
        .certifications-list, .languages-list {{
            margin-top: {base_spacing * 0.5}pt;
        }}

        .certification-item, .language-item {{
            margin-bottom: {base_spacing * 0.5}pt;
            line-height: 1.4;
        }}

        .cert-name {{
            font-weight: bold;
            color: {colors['primary']};
        }}

        .cert-issuer, .cert-date {{
            font-size: {base_font * 0.9}pt;
            color: {colors['secondary']};
        }}

        /* Print Optimization */
        @media print {{
            .cv-container {{
                page-break-inside: avoid;
            }}

            .experience-item, .education-item, .project-item {{
                page-break-inside: avoid;
            }}
        }}
        """

        return css

    def _get_font_size_scale(self) -> float:
        """Get font size scale based on customizations"""
        font_size = self.customizations.get('font_size', 'normal')

        scales = {
            'small': 0.90,
            'normal': 1.0,
            'large': 1.10
        }

        return scales.get(font_size, 1.0)

    def _get_spacing_scale(self) -> float:
        """Get spacing scale based on customizations"""
        spacing = self.customizations.get('spacing', 'normal')

        scales = {
            'tight': 0.75,
            'normal': 1.0,
            'relaxed': 1.25
        }

        return scales.get(spacing, 1.0)

    def _get_template_colors(self) -> Dict[str, str]:
        """Get color scheme based on template"""

        color_intensity = self.customizations.get('color_intensity', 'normal')

        # Base colors for Modern template - DRAMATICALLY DIFFERENT
        if self.template == "modern":
            base_colors = {
                'primary': '#1e3a8a',      # Deep blue
                'accent': '#3b82f6',       # Bright blue
                'secondary': '#6b7280',    # Gray
                'text': '#111827',         # Almost black
                'sidebar_bg': '#1e3a8a',   # Deep blue sidebar!
                'sidebar_text': '#ffffff', # White text in sidebar
                'tag_bg': '#3b82f6',       # Bright blue tags
                'tag_text': '#ffffff',     # White text on tags
                'body_bg': '#f9fafb',      # Light gray body background
            }

            # Adjust based on color intensity
            if color_intensity == 'subtle':
                base_colors['accent'] = '#7dd3fc'  # Lighter blue
                base_colors['primary'] = '#334155'  # Lighter slate
            elif color_intensity == 'bold':
                base_colors['accent'] = '#0284c7'  # Darker blue
                base_colors['primary'] = '#020617'  # Almost black

        else:
            # Default colors
            base_colors = {
                'primary': '#1a202c',
                'accent': '#2563eb',
                'secondary': '#6b7280',
                'text': '#374151',
                'sidebar_bg': '#f9fafb',
                'tag_bg': '#dbeafe',
                'tag_text': '#1e40af',
            }

        return base_colors
