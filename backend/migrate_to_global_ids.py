#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Database migration to add global_id columns and populate them.

This migration adds global_id (UUID) to all CV entity tables and generates
unique IDs for all existing records using a hierarchical format.

Format: section:entry:subentry:item (components omitted if not applicable)
Example: sec_abc123:ent_def456::itm_ghi789

Run: python migrate_to_global_ids.py --confirm
"""

import uuid
import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

def generate_short_uuid():
    """Generate a short UUID (8 chars) for readability"""
    return str(uuid.uuid4())[:8]

def migrate():
    print("=" * 80)
    print("GLOBAL ID MIGRATION")
    print("=" * 80)
    print("\nThis migration will:")
    print("1. Add global_id columns to all profile tables")
    print("2. Generate hierarchical UUIDs for all existing records")
    print("3. Prepare system for global ID usage")
    print("\nWARNING: This will modify your database structure.")

    # Check for --confirm flag
    if '--confirm' not in sys.argv:
        print("\nTo run this migration, use: python migrate_to_global_ids.py --confirm")
        return

    print("\nProceeding with migration...")

    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        try:
            print("\n" + "=" * 80)
            print("STEP 1: Adding global_id columns")
            print("=" * 80)

            # Add global_id columns
            tables = ['sections', 'section_entries', 'section_items']
            for table in tables:
                print(f"\nAdding global_id to {table}...")
                conn.execute(text(f"""
                    ALTER TABLE {table}
                    ADD COLUMN IF NOT EXISTS global_id VARCHAR(255) UNIQUE
                """))

            conn.commit()
            print("\nColumns added successfully")

            print("\n" + "=" * 80)
            print("STEP 2: Generating global IDs for existing records")
            print("=" * 80)

            # Get all profiles
            profiles = conn.execute(text("""
                SELECT p.id, u.email
                FROM profiles p
                JOIN users u ON p.user_id = u.id
                ORDER BY p.id
            """)).fetchall()

            for profile_id, user_email in profiles:
                print(f"\nProcessing profile for user: {user_email}")

                # Get all sections for this profile
                sections = conn.execute(text("""
                    SELECT id, title, section_type
                    FROM sections
                    WHERE profile_id = :profile_id
                    ORDER BY "order", id
                """), {"profile_id": profile_id}).fetchall()

                for section_id, section_title, section_type in sections:
                    section_gid = f"sec_{generate_short_uuid()}"
                    conn.execute(text("""
                        UPDATE sections
                        SET global_id = :gid
                        WHERE id = :id
                    """), {"gid": section_gid, "id": section_id})

                    print(f"  Section '{section_title}' ({section_type}): {section_gid}")

                    # Get top-level entries for this section (no parent)
                    entries = conn.execute(text("""
                        SELECT id, title
                        FROM section_entries
                        WHERE section_id = :section_id AND parent_entry_id IS NULL
                        ORDER BY "order", id
                    """), {"section_id": section_id}).fetchall()

                    for entry_id, entry_title in entries:
                        entry_gid = f"{section_gid}:ent_{generate_short_uuid()}"
                        conn.execute(text("""
                            UPDATE section_entries
                            SET global_id = :gid
                            WHERE id = :id
                        """), {"gid": entry_gid, "id": entry_id})

                        print(f"    Entry '{entry_title}': {entry_gid}")

                        # Get sub-entries (entries with this entry as parent)
                        sub_entries = conn.execute(text("""
                            SELECT id, title
                            FROM section_entries
                            WHERE parent_entry_id = :parent_id
                            ORDER BY "order", id
                        """), {"parent_id": entry_id}).fetchall()

                        for sub_id, sub_title in sub_entries:
                            sub_gid = f"{entry_gid}:sub_{generate_short_uuid()}"
                            conn.execute(text("""
                                UPDATE section_entries
                                SET global_id = :gid
                                WHERE id = :id
                            """), {"gid": sub_gid, "id": sub_id})

                            print(f"      Sub-entry '{sub_title}': {sub_gid}")

                            # Get items for this sub-entry
                            items = conn.execute(text("""
                                SELECT id
                                FROM section_items
                                WHERE entry_id = :entry_id
                                ORDER BY "order", id
                            """), {"entry_id": sub_id}).fetchall()

                            for (item_id,) in items:
                                item_gid = f"{sub_gid}:itm_{generate_short_uuid()}"
                                conn.execute(text("""
                                    UPDATE section_items
                                    SET global_id = :gid
                                    WHERE id = :id
                                """), {"gid": item_gid, "id": item_id})

                        # Get items directly under entry (no sub-entry)
                        items = conn.execute(text("""
                            SELECT id
                            FROM section_items
                            WHERE entry_id = :entry_id
                            ORDER BY "order", id
                        """), {"entry_id": entry_id}).fetchall()

                        for (item_id,) in items:
                            item_gid = f"{entry_gid}::itm_{generate_short_uuid()}"  # :: indicates no sub-entry
                            conn.execute(text("""
                                UPDATE section_items
                                SET global_id = :gid
                                WHERE id = :id
                            """), {"gid": item_gid, "id": item_id})

            conn.commit()
            print("\nGlobal IDs generated successfully")

            print("\n" + "=" * 80)
            print("MIGRATION COMPLETE")
            print("=" * 80)
            print("\nNext steps:")
            print("1. Update backend API to use global_ids")
            print("2. Update frontend to use global_ids")
            print("3. Test all functionality")
            print("\nNOTE: Existing tailored CVs will need to be regenerated.")

        except Exception as e:
            print(f"\nMigration failed: {e}")
            conn.rollback()
            raise

if __name__ == "__main__":
    migrate()
