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
