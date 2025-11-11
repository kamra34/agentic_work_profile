"""
Add missing updated_at column to section_entries table
"""

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def add_missing_columns():
    """Add missing columns to align with the models"""

    with engine.connect() as conn:
        print("Adding missing columns to section_entries table...")

        # Check if updated_at exists
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'section_entries' AND column_name = 'updated_at';
        """))

        if result.fetchone() is None:
            print("  - Adding updated_at column...")
            conn.execute(text("""
                ALTER TABLE section_entries
                ADD COLUMN updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();
            """))

            # Set updated_at to created_at for existing rows
            conn.execute(text("""
                UPDATE section_entries
                SET updated_at = created_at
                WHERE updated_at IS NULL;
            """))
            conn.commit()
            print("  ✓ Added updated_at column")
        else:
            print("  ✓ updated_at column already exists")

        print("\nVerifying columns...")
        result = conn.execute(text("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'section_entries'
            ORDER BY ordinal_position;
        """))
        print("\nsection_entries columns:")
        for row in result:
            print(f"  - {row[0]}: {row[1]}")

        print("\n✓ Database schema updated successfully!")

if __name__ == "__main__":
    add_missing_columns()
