"""
Quick fix for missing updated_at column and unique constraint
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def fix_schema():
    """Fix missing columns and constraints"""

    with engine.connect() as conn:
        print("Fixing schema issues...")

        # 1. Add updated_at column to sections
        print("\n1. Adding updated_at to sections...")
        try:
            conn.execute(text("""
                ALTER TABLE sections
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            """))
            conn.commit()
            print("   [OK] Added updated_at to sections")
        except Exception as e:
            print(f"   [WARNING] Error adding updated_at to sections: {e}")
            conn.rollback()

        # 2. Add updated_at column to section_items
        print("\n2. Adding updated_at to section_items...")
        try:
            conn.execute(text("""
                ALTER TABLE section_items
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            """))
            conn.commit()
            print("   [OK] Added updated_at to section_items")
        except Exception as e:
            print(f"   [WARNING] Error adding updated_at to section_items: {e}")
            conn.rollback()

        # 3. Drop the unique constraint on profiles.user_id to allow multiple profiles per user
        print("\n3. Dropping unique constraint on profiles.user_id...")
        try:
            conn.execute(text("""
                ALTER TABLE profiles
                DROP CONSTRAINT IF EXISTS profiles_user_id_key;
            """))
            conn.commit()
            print("   [OK] Dropped unique constraint - users can now have multiple profiles")
        except Exception as e:
            print(f"   [WARNING] Error dropping constraint: {e}")
            conn.rollback()

        print("\n" + "="*60)
        print("Schema fix completed!")
        print("="*60)

if __name__ == "__main__":
    fix_schema()
