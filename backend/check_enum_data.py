"""
Check and display enum data in the database to diagnose issues
"""

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def check_data():
    """Check what enum values are stored in the database"""

    with engine.connect() as conn:
        print("Checking enum types and data...\n")

        # Check enum type definitions
        print("1. Checking contenttype enum definition:")
        result = conn.execute(text("""
            SELECT enumlabel FROM pg_enum
            WHERE enumtypid = 'contenttype'::regtype
            ORDER BY enumsortorder;
        """))
        for row in result:
            print(f"   - {row[0]}")

        print("\n2. Checking sectiontype enum definition:")
        result = conn.execute(text("""
            SELECT enumlabel FROM pg_enum
            WHERE enumtypid = 'sectiontype'::regtype
            ORDER BY enumsortorder;
        """))
        for row in result:
            print(f"   - {row[0]}")

        # Check actual data in sections table
        print("\n3. Checking sections table data:")
        result = conn.execute(text("""
            SELECT id, title, section_type::text, content_type::text
            FROM sections
            LIMIT 10;
        """))
        rows = result.fetchall()
        if rows:
            for row in rows:
                print(f"   Section {row[0]}: {row[1]} | type={row[2]} | content_type={row[3]}")
        else:
            print("   No sections found")

        # Check profiles count
        print("\n4. Checking profiles:")
        result = conn.execute(text("SELECT COUNT(*) FROM profiles"))
        count = result.fetchone()[0]
        print(f"   Total profiles: {count}")

        # Check profiles with sections
        print("\n5. Profiles with sections:")
        result = conn.execute(text("""
            SELECT p.id, p.title, COUNT(s.id) as section_count
            FROM profiles p
            LEFT JOIN sections s ON s.profile_id = p.id
            GROUP BY p.id, p.title;
        """))
        for row in result:
            print(f"   Profile {row[0]}: {row[1]} | {row[2]} sections")

if __name__ == "__main__":
    check_data()
