"""
Format profile data in human-readable text format for AI models.
This matches the output from check_profile_structure.py
"""
from typing import Dict, Any
from models import *
from sqlalchemy.orm import Session

def format_profile_for_ai(db: Session, user_id: int) -> str:
    """
    Generate a formatted text representation of the user's profile
    that is clean and easy for AI models to understand.
    """
    output_lines = []
    
    # Get profile
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not profile:
        return "[ERROR] No profile found"
    
    output_lines.append("="*80)
    output_lines.append("USER PROFILE")
    output_lines.append("="*80)
    output_lines.append(f"\nProfile Title: {profile.title}")
    
    # Get sections
    sections = db.query(Section).filter(Section.profile_id == profile.id).order_by(Section.order).all()
    output_lines.append(f"Total Sections: {len(sections)}\n")
    
    for section in sections:
        output_lines.append(f"\n{'='*80}")
        output_lines.append(f"SECTION: {section.section_type.value.upper()}")
        output_lines.append(f"{'='*80}")
        output_lines.append(f"Title: {section.title}")
        
        if section.content:
            output_lines.append(f"Content: {section.content}")
        
        # Get top-level entries only
        entries = db.query(SectionEntry).filter(
            SectionEntry.section_id == section.id,
            SectionEntry.parent_entry_id == None
        ).order_by(SectionEntry.order).all()
        
        output_lines.append(f"\nEntries: {len(entries)}")
        
        for entry in entries:
            output_lines.append(f"\n  {'─'*70}")
            output_lines.append(f"  [ENTRY_ID:{entry.id}] {entry.title}")
            if entry.subtitle:
                output_lines.append(f"  Company: {entry.subtitle}")
            if entry.start_date or entry.end_date:
                output_lines.append(f"  Dates: {entry.start_date or ''} - {entry.end_date or 'Present'}")
            if entry.location:
                output_lines.append(f"  Location: {entry.location}")
            if entry.description:
                output_lines.append(f"  Description: {entry.description}")
            
            # Check for sub-entries (role categories)
            sub_entries = db.query(SectionEntry).filter(
                SectionEntry.parent_entry_id == entry.id
            ).order_by(SectionEntry.order).all()
            
            if sub_entries:
                output_lines.append(f"\n  Role Categories ({len(sub_entries)}):")
                for sub in sub_entries:
                    output_lines.append(f"    • [SUB_ENTRY_ID:{sub.id}] {sub.title}")
                    # Get items for sub-entry
                    sub_items = db.query(SectionItem).filter(
                        SectionItem.entry_id == sub.id
                    ).order_by(SectionItem.order).all()
                    for item in sub_items:
                        output_lines.append(f"      - [ID:{item.id}] {item.content}")
            
            # Get items directly under this entry
            items = db.query(SectionItem).filter(
                SectionItem.entry_id == entry.id
            ).order_by(SectionItem.order).all()
            
            if items:
                output_lines.append(f"\n  Key Points:")
                for item in items:
                    output_lines.append(f"    • [ID:{item.id}] {item.content}")
    
    output_lines.append(f"\n{'='*80}\n")

    return "\n".join(output_lines)


def format_cv_content_for_ai(cv_content: Dict[str, Any]) -> str:
    """
    Format a CV content snapshot (from TailoredCVVersion.selected_content)
    into human-readable text for AI analysis.
    This is used when recalculating ATS scores on filtered/visible items.
    """
    output_lines = []

    output_lines.append("="*80)
    output_lines.append("TAILORED CV CONTENT")
    output_lines.append("="*80)

    # Contact info
    contact_info = cv_content.get('contact_info', {})
    if contact_info:
        output_lines.append("\nCONTACT INFORMATION:")
        if contact_info.get('full_name'):
            output_lines.append(f"Name: {contact_info['full_name']}")
        if contact_info.get('email'):
            output_lines.append(f"Email: {contact_info['email']}")
        if contact_info.get('phone'):
            output_lines.append(f"Phone: {contact_info['phone']}")
        if contact_info.get('location'):
            output_lines.append(f"Location: {contact_info['location']}")

    # Sections
    sections = cv_content.get('sections', [])
    output_lines.append(f"\nTotal Sections: {len(sections)}\n")

    for section in sections:
        output_lines.append(f"\n{'='*80}")
        output_lines.append(f"SECTION: {section.get('section_type', '').upper()}")
        output_lines.append(f"{'='*80}")
        output_lines.append(f"Title: {section.get('title', '')}")

        if section.get('content'):
            output_lines.append(f"Content: {section['content']}")

        entries = section.get('entries', [])
        output_lines.append(f"\nEntries: {len(entries)}")

        for entry in entries:
            output_lines.append(f"\n  {'─'*70}")
            if entry.get('title'):
                output_lines.append(f"  {entry['title']}")
            if entry.get('subtitle'):
                output_lines.append(f"  Company: {entry['subtitle']}")
            if entry.get('start_date') or entry.get('end_date'):
                output_lines.append(f"  Dates: {entry.get('start_date', '')} - {entry.get('end_date', 'Present')}")
            if entry.get('location'):
                output_lines.append(f"  Location: {entry['location']}")
            if entry.get('description'):
                output_lines.append(f"  Description: {entry['description']}")

            # Sub-entries (role categories)
            sub_entries = entry.get('sub_entries', [])
            if sub_entries:
                output_lines.append(f"\n  Role Categories ({len(sub_entries)}):")
                for sub in sub_entries:
                    if sub.get('title'):
                        output_lines.append(f"    • {sub['title']}")
                    # Items in sub-entry
                    sub_items = sub.get('items', [])
                    for item in sub_items:
                        if item.get('content'):
                            output_lines.append(f"      - {item['content']}")

            # Items directly under entry
            items = entry.get('items', [])
            if items:
                output_lines.append(f"\n  Key Points:")
                for item in items:
                    if item.get('content'):
                        output_lines.append(f"    • {item['content']}")

    output_lines.append(f"\n{'='*80}\n")

    return "\n".join(output_lines)
