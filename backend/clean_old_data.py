"""
Clean up old profile data that's incompatible with the new schema
"""

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def clean_data():
    """Remove Profile 1 which has old schema data"""

    with engine.connect() as conn:
        print("Cleaning up old profile data...\n")

        # Check Profile 1
        print("1. Checking Profile 1 structure:")
        result = conn.execute(text("""
            SELECT id, user_id, title, is_default, created_at, updated_at
            FROM profiles
            WHERE id = 1;
        """))
        row = result.fetchone()
        if row:
            print(f"   Profile ID: {row[0]}")
            print(f"   User ID: {row[1]}")
            print(f"   Title: {row[2]}")
            print(f"   Is Default: {row[3]}")
            print(f"   Created: {row[4]}")
            print(f"   Updated: {row[5]}")
        else:
            print("   Profile 1 not found")
            return

        # Delete Profile 1 and all its sections (CASCADE will handle it)
        print("\n2. Deleting Profile 1 and its sections...")
        try:
            conn.execute(text("DELETE FROM profiles WHERE id = 1"))
            conn.commit()
            print("   [OK] Deleted Profile 1")
        except Exception as e:
            print(f"   [ERROR] Failed to delete: {e}")
            conn.rollback()
            return

        # Verify
        print("\n3. Verifying cleanup:")
        result = conn.execute(text("SELECT COUNT(*) FROM profiles"))
        profile_count = result.fetchone()[0]
        result = conn.execute(text("SELECT COUNT(*) FROM sections"))
        section_count = result.fetchone()[0]
        print(f"   Remaining profiles: {profile_count}")
        print(f"   Remaining sections: {section_count}")

        print("\n" + "="*60)
        print("Cleanup completed successfully!")
        print("="*60)

if __name__ == "__main__":
    clean_data()
