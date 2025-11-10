#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Standalone script to check and display the complete profile structure.
Run directly: python check_profile_structure.py
"""
import sys
import os
import io

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Add parent directory to path to import models
sys.path.insert(0, os.path.dirname(__file__))

from models import *
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import json

load_dotenv()

def main():
    engine = create_engine(os.getenv('DATABASE_URL'))
    Session = sessionmaker(bind=engine)
    session = Session()

    # Get first profile
    profile = session.query(Profile).first()
    if not profile:
        print("[ERROR] No profile found in database")
        session.close()
        return

    print(f"{'='*80}")
    print(f"PROFILE STRUCTURE ANALYSIS")
    print(f"{'='*80}")
    print(f"\n[OK] Profile ID: {profile.id}")
    print(f"   Profile Title: {profile.title}")
    print(f"   User ID: {profile.user_id}")

    # Get sections
    sections = session.query(Section).filter(Section.profile_id == profile.id).order_by(Section.order).all()
    print(f"\n[INFO] Profile has {len(sections)} sections\n")

    for section in sections:
        print(f"\n{'='*80}")
        print(f"SECTION: {section.section_type.value.upper()}")
        print(f"{'='*80}")
        print(f"Section ID: {section.id}")
        print(f"Title: {section.title}")
        print(f"Content Type: {section.content_type.value if section.content_type else 'None'}")

        if section.content:
            content_preview = section.content[:100] + "..." if len(section.content) > 100 else section.content
            print(f"Direct Content: {content_preview}")

        entries = session.query(SectionEntry).filter(
            SectionEntry.section_id == section.id,
            SectionEntry.parent_entry_id == None  # Only top-level entries
        ).order_by(SectionEntry.order).all()

        print(f"\n[ENTRIES] {len(entries)} entries in this section:")

        for entry in entries:
            print(f"\n  {'─'*70}")
            print(f"  Entry ID: {entry.id}")
            print(f"  Title: {entry.title}")
            if entry.subtitle:
                print(f"  Subtitle: {entry.subtitle}")
            if entry.start_date or entry.end_date:
                print(f"  Dates: {entry.start_date or ''} - {entry.end_date or 'Present'}")
            if entry.location:
                print(f"  Location: {entry.location}")
            print(f"  Content Type: {entry.content_type.value if entry.content_type else 'None'}")

            if entry.description:
                desc_preview = entry.description[:100] + "..." if len(entry.description) > 100 else entry.description
                print(f"  Description: {desc_preview}")

            # Check for sub-entries (hierarchical structure)
            sub_entries = session.query(SectionEntry).filter(
                SectionEntry.parent_entry_id == entry.id
            ).order_by(SectionEntry.order).all()

            if sub_entries:
                print(f"\n  [SUB-ENTRIES] {len(sub_entries)} sub-entries:")
                for sub in sub_entries:
                    print(f"    +-- Sub-Entry ID: {sub.id}")
                    print(f"    |   Title: {sub.title}")
                    sub_items = session.query(SectionItem).filter(
                        SectionItem.entry_id == sub.id
                    ).order_by(SectionItem.order).all()
                    print(f"    |   Items: {len(sub_items)}")
                    for item in sub_items:
                        content_preview = item.content[:60] + "..." if len(item.content) > 60 else item.content
                        print(f"    |     * Item {item.id}: {content_preview}")

            # Get items for this entry
            items = session.query(SectionItem).filter(
                SectionItem.entry_id == entry.id
            ).order_by(SectionItem.order).all()

            print(f"\n  [ITEMS] {len(items)} items/bullets:")
            for item in items:
                content_preview = item.content[:80] + "..." if len(item.content) > 80 else item.content
                print(f"    * Item {item.id}: {content_preview}")

    print(f"\n{'='*80}")
    print("STRUCTURE SUMMARY")
    print(f"{'='*80}")

    # Summary statistics
    total_entries = session.query(SectionEntry).filter(
        SectionEntry.section_id.in_([s.id for s in sections])
    ).count()

    total_items = session.query(SectionItem).join(SectionEntry).filter(
        SectionEntry.section_id.in_([s.id for s in sections])
    ).count()

    print(f"Total Sections: {len(sections)}")
    print(f"Total Entries: {total_entries}")
    print(f"Total Items: {total_items}")

    # Breakdown by section type
    print(f"\nBreakdown by section:")
    for section in sections:
        entry_count = session.query(SectionEntry).filter(
            SectionEntry.section_id == section.id
        ).count()

        item_count = session.query(SectionItem).join(SectionEntry).filter(
            SectionEntry.section_id == section.id
        ).count()

        print(f"  {section.section_type.value.upper()}: {entry_count} entries, {item_count} items")

    session.close()
    print(f"\n{'='*80}\n")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
