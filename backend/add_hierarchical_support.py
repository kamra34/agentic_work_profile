"""
Add parent_entry_id column to section_entries table for hierarchical structure support
"""

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def add_hierarchical_support():
    """Add parent_entry_id column to support nested entries"""

    with engine.connect() as conn:
        print("Adding hierarchical support to section_entries table...")

        # Check if parent_entry_id exists
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'section_entries' AND column_name = 'parent_entry_id';
        """))

        if result.fetchone() is None:
            print("  - Adding parent_entry_id column...")
            conn.execute(text("""
                ALTER TABLE section_entries
                ADD COLUMN parent_entry_id INTEGER REFERENCES section_entries(id) ON DELETE CASCADE;
            """))
            conn.commit()
            print("  + Added parent_entry_id column")
        else:
            print("  + parent_entry_id column already exists")

        print("\nVerifying columns...")
        result = conn.execute(text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'section_entries'
            ORDER BY ordinal_position;
        """))
        print("\nsection_entries columns:")
        for row in result:
            nullable = "NULL" if row[2] == "YES" else "NOT NULL"
            print(f"  - {row[0]}: {row[1]} ({nullable})")

        print("\n+ Database schema updated successfully!")
        print("\nHierarchical structure now supported:")
        print("  - Summary: Direct section content (no entries)")
        print("  - Education: Degree -> bullet points")
        print("  - Work Experience: Company -> Role -> bullet points")
        print("  - Custom: Up to one level of nesting")

if __name__ == "__main__":
    add_hierarchical_support()
