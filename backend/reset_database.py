"""
Reset the database - delete all data but keep the schema intact
"""

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def reset_database():
    """Delete all data from all tables while preserving the schema"""

    with engine.connect() as conn:
        print("Resetting database (deleting all data)...\n")

        # Delete in order to respect foreign key constraints
        print("1. Deleting section_items...")
        result = conn.execute(text("DELETE FROM section_items"))
        conn.commit()
        print(f"   [OK] Deleted {result.rowcount} section items")

        print("\n2. Deleting section_entries...")
        result = conn.execute(text("DELETE FROM section_entries"))
        conn.commit()
        print(f"   [OK] Deleted {result.rowcount} section entries")

        print("\n3. Deleting sections...")
        result = conn.execute(text("DELETE FROM sections"))
        conn.commit()
        print(f"   [OK] Deleted {result.rowcount} sections")

        print("\n4. Deleting profiles...")
        result = conn.execute(text("DELETE FROM profiles"))
        conn.commit()
        print(f"   [OK] Deleted {result.rowcount} profiles")

        print("\n5. Deleting users...")
        result = conn.execute(text("DELETE FROM users"))
        conn.commit()
        print(f"   [OK] Deleted {result.rowcount} users")

        # Reset sequences to start IDs from 1 again
        print("\n6. Resetting ID sequences...")
        try:
            conn.execute(text("ALTER SEQUENCE users_id_seq RESTART WITH 1"))
            conn.execute(text("ALTER SEQUENCE profiles_id_seq RESTART WITH 1"))
            conn.execute(text("ALTER SEQUENCE sections_id_seq RESTART WITH 1"))
            conn.execute(text("ALTER SEQUENCE section_entries_id_seq RESTART WITH 1"))
            conn.execute(text("ALTER SEQUENCE section_items_id_seq RESTART WITH 1"))
            conn.commit()
            print("   [OK] Reset all ID sequences")
        except Exception as e:
            print(f"   [WARNING] Could not reset sequences: {e}")
            conn.rollback()

        # Verify cleanup
        print("\n7. Verifying database is empty...")
        tables = ['users', 'profiles', 'sections', 'section_entries', 'section_items']
        all_empty = True
        for table in tables:
            result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
            count = result.fetchone()[0]
            if count > 0:
                print(f"   [WARNING] {table} still has {count} rows")
                all_empty = False
            else:
                print(f"   [OK] {table}: 0 rows")

        if all_empty:
            print("\n" + "="*60)
            print("Database reset completed successfully!")
            print("All data deleted, schema preserved")
            print("="*60)
        else:
            print("\n" + "="*60)
            print("Database reset completed with warnings")
            print("="*60)

if __name__ == "__main__":
    confirm = input("This will DELETE ALL DATA from the database. Are you sure? (yes/no): ")
    if confirm.lower() == 'yes':
        reset_database()
    else:
        print("Database reset cancelled.")
