"""
Fix order values for existing entries
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Section, SectionEntry

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost/agentic_work_profile')
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

try:
    # Get all sections
    sections = session.query(Section).all()

    for section in sections:
        print(f"\nProcessing section: {section.title}")

        # Get all parent entries (entries without parent_entry_id)
        parent_entries = session.query(SectionEntry).filter(
            SectionEntry.section_id == section.id,
            SectionEntry.parent_entry_id == None
        ).order_by(SectionEntry.id).all()

        # Assign order based on creation order (id)
        for idx, entry in enumerate(parent_entries):
            entry.order = idx
            print(f"  - Entry '{entry.title}' order set to {idx}")

        # Get all child entries grouped by parent
        for parent in parent_entries:
            child_entries = session.query(SectionEntry).filter(
                SectionEntry.parent_entry_id == parent.id
            ).order_by(SectionEntry.id).all()

            for idx, child in enumerate(child_entries):
                child.order = idx
                print(f"    - Child entry '{child.title}' under '{parent.title}' order set to {idx}")

    session.commit()
    print("\n✅ Successfully fixed all entry orders!")

except Exception as e:
    session.rollback()
    print(f"\n❌ Error: {e}")
finally:
    session.close()
