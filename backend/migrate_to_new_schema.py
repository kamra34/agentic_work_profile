"""
Migration script to update database schema to new content-aware structure.

This migration:
1. Adds new columns to existing tables
2. Migrates existing data to new structure with explicit content types
3. Ensures every piece of content is trackable and typed
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def migrate():
    """Run migration to add new schema fields and populate them"""

    with engine.connect() as conn:
        print("Starting migration...")

        # Step 1: Add new columns to profiles table
        print("\n1. Updating profiles table...")
        try:
            conn.execute(text("""
                ALTER TABLE profiles
                ADD COLUMN IF NOT EXISTS title VARCHAR DEFAULT 'My Profile',
                ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS contact_info JSON,
                ADD COLUMN IF NOT EXISTS notes TEXT;
            """))
            conn.commit()
            print("   [OK] Added new profile columns")
        except Exception as e:
            print(f"   [WARNING] Profile columns may already exist: {e}")

        # Step 2: Drop old columns from profiles (CV extraction related)
        print("\n2. Cleaning up old CV extraction columns from profiles...")
        try:
            conn.execute(text("""
                ALTER TABLE profiles
                DROP COLUMN IF EXISTS original_filename,
                DROP COLUMN IF EXISTS file_path,
                DROP COLUMN IF EXISTS file_type,
                DROP COLUMN IF EXISTS openai_model,
                DROP COLUMN IF EXISTS linkedin_url;
            """))
            conn.commit()
            print("   [OK] Removed old CV extraction columns")
        except Exception as e:
            print(f"   [WARNING] Error removing old columns: {e}")

        # Step 3: Add new columns to sections table
        print("\n3. Updating sections table...")
        try:
            # First, drop existing enum types if they exist (with CASCADE to handle dependencies)
            try:
                conn.execute(text("DROP TYPE IF EXISTS contenttype CASCADE"))
                conn.commit()
            except:
                conn.rollback()

            try:
                conn.execute(text("DROP TYPE IF EXISTS sectiontype CASCADE"))
                conn.commit()
            except:
                conn.rollback()

            # Create the enum types with lowercase values
            conn.execute(text("""
                CREATE TYPE contenttype AS ENUM ('paragraph', 'bullets', 'text_and_bullets', 'empty');
            """))
            conn.commit()

            conn.execute(text("""
                CREATE TYPE sectiontype AS ENUM (
                    'summary', 'work_experience', 'education', 'skills',
                    'projects', 'certifications', 'awards', 'publications',
                    'languages', 'volunteer', 'custom'
                );
            """))
            conn.commit()
            print("   [OK] Created enum types")
        except Exception as e:
            print(f"   [WARNING] Error creating enum types: {e}")
            conn.rollback()

        try:
            # Add columns one by one to handle existing columns gracefully
            try:
                conn.execute(text("ALTER TABLE sections ADD COLUMN IF NOT EXISTS icon VARCHAR"))
                conn.commit()
            except:
                conn.rollback()

            try:
                conn.execute(text("ALTER TABLE sections ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE"))
                conn.commit()
            except:
                conn.rollback()

            try:
                conn.execute(text("ALTER TABLE sections ADD COLUMN IF NOT EXISTS meta_info JSON"))
                conn.commit()
            except:
                conn.rollback()

            # For content_type, check if it exists first
            try:
                conn.execute(text("ALTER TABLE sections ADD COLUMN IF NOT EXISTS content_type contenttype"))
                conn.commit()
                # Set default for new column
                conn.execute(text("UPDATE sections SET content_type = 'empty' WHERE content_type IS NULL"))
                conn.commit()
            except Exception as inner_e:
                print(f"   [INFO] content_type column may already exist: {inner_e}")
                conn.rollback()

            print("   [OK] Added new section columns")
        except Exception as e:
            print(f"   [WARNING] Section columns error: {e}")
            conn.rollback()

        # Step 4: Convert existing section_type strings to enum
        print("\n4. Converting section_type to enum...")
        try:
            # Map old section types to new enum values
            conn.execute(text("""
                UPDATE sections
                SET section_type = CASE
                    WHEN LOWER(section_type) LIKE '%summary%' THEN 'summary'
                    WHEN LOWER(section_type) LIKE '%experience%' THEN 'work_experience'
                    WHEN LOWER(section_type) LIKE '%education%' THEN 'education'
                    WHEN LOWER(section_type) LIKE '%skill%' THEN 'skills'
                    WHEN LOWER(section_type) LIKE '%project%' THEN 'projects'
                    WHEN LOWER(section_type) LIKE '%certification%' OR LOWER(section_type) LIKE '%certificate%' THEN 'certifications'
                    WHEN LOWER(section_type) LIKE '%award%' THEN 'awards'
                    WHEN LOWER(section_type) LIKE '%publication%' THEN 'publications'
                    WHEN LOWER(section_type) LIKE '%language%' THEN 'languages'
                    WHEN LOWER(section_type) LIKE '%volunteer%' THEN 'volunteer'
                    ELSE 'custom'
                END;
            """))

            # Change column type to enum
            conn.execute(text("""
                ALTER TABLE sections
                ALTER COLUMN section_type TYPE sectiontype
                USING section_type::sectiontype;
            """))
            conn.commit()
            print("   [OK] Converted section_type to enum")
        except Exception as e:
            print(f"   [WARNING] Error converting section_type: {e}")
            conn.rollback()

        # Step 5: Set content_type based on existing data
        print("\n5. Detecting and setting content types for sections...")
        try:
            # Sections with content but no entries = PARAGRAPH
            conn.execute(text("""
                UPDATE sections
                SET content_type = 'paragraph'
                WHERE content IS NOT NULL
                AND content != ''
                AND id NOT IN (SELECT DISTINCT section_id FROM section_entries);
            """))

            # Sections with entries = EMPTY (content in entries)
            conn.execute(text("""
                UPDATE sections
                SET content_type = 'empty'
                WHERE id IN (SELECT DISTINCT section_id FROM section_entries);
            """))
            conn.commit()
            print("   [OK] Set content types for sections")
        except Exception as e:
            print(f"   [WARNING] Error setting section content types: {e}")
            conn.rollback()

        # Step 6: Add new columns to section_entries table
        print("\n6. Updating section_entries table...")
        try:
            # Add columns one by one
            try:
                conn.execute(text("ALTER TABLE section_entries ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE"))
                conn.commit()
            except:
                conn.rollback()

            try:
                conn.execute(text("ALTER TABLE section_entries ADD COLUMN IF NOT EXISTS meta_info JSON"))
                conn.commit()
            except:
                conn.rollback()

            # For content_type, check if it exists first
            try:
                conn.execute(text("ALTER TABLE section_entries ADD COLUMN IF NOT EXISTS content_type contenttype"))
                conn.commit()
                # Set default for new column
                conn.execute(text("UPDATE section_entries SET content_type = 'bullets' WHERE content_type IS NULL"))
                conn.commit()
            except Exception as inner_e:
                print(f"   [INFO] content_type column may already exist on section_entries: {inner_e}")
                conn.rollback()

            print("   [OK] Added new section_entries columns")
        except Exception as e:
            print(f"   [WARNING] Section_entries columns error: {e}")
            conn.rollback()

        # Step 7: Set content_type based on existing data in entries
        print("\n7. Detecting and setting content types for entries...")
        try:
            # Entries with description AND items = TEXT_AND_BULLETS
            conn.execute(text("""
                UPDATE section_entries
                SET content_type = 'text_and_bullets'
                WHERE description IS NOT NULL
                AND description != ''
                AND id IN (SELECT DISTINCT entry_id FROM section_items);
            """))

            # Entries with ONLY description = PARAGRAPH
            conn.execute(text("""
                UPDATE section_entries
                SET content_type = 'paragraph'
                WHERE description IS NOT NULL
                AND description != ''
                AND id NOT IN (SELECT DISTINCT entry_id FROM section_items);
            """))

            # Entries with ONLY items = BULLETS
            conn.execute(text("""
                UPDATE section_entries
                SET content_type = 'bullets'
                WHERE (description IS NULL OR description = '')
                AND id IN (SELECT DISTINCT entry_id FROM section_items);
            """))

            # Entries with neither = EMPTY
            conn.execute(text("""
                UPDATE section_entries
                SET content_type = 'empty'
                WHERE (description IS NULL OR description = '')
                AND id NOT IN (SELECT DISTINCT entry_id FROM section_items);
            """))
            conn.commit()
            print("   [OK] Set content types for entries")
        except Exception as e:
            print(f"   [WARNING] Error setting entry content types: {e}")
            conn.rollback()

        # Step 8: Add new columns to section_items table
        print("\n8. Updating section_items table...")
        try:
            conn.execute(text("""
                ALTER TABLE section_items
                ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS meta_info JSON;
            """))
            conn.commit()
            print("   [OK] Added new section_items columns")
        except Exception as e:
            print(f"   [WARNING] Section_items columns may already exist: {e}")
            conn.rollback()

        # Step 9: Initialize meta_info with source tracking for all existing content
        print("\n9. Initializing metadata for existing content...")
        try:
            # Set meta_info for all sections
            conn.execute(text("""
                UPDATE sections
                SET meta_info = jsonb_build_object(
                    'source', 'migrated_from_old_schema',
                    'migration_date', NOW()::text,
                    'content_type_detected', content_type::text
                )
                WHERE meta_info IS NULL;
            """))

            # Set meta_info for all entries
            conn.execute(text("""
                UPDATE section_entries
                SET meta_info = jsonb_build_object(
                    'source', 'migrated_from_old_schema',
                    'migration_date', NOW()::text,
                    'content_type_detected', content_type::text
                )
                WHERE meta_info IS NULL;
            """))

            # Set meta_info for all items
            conn.execute(text("""
                UPDATE section_items
                SET meta_info = jsonb_build_object(
                    'source', 'migrated_from_old_schema',
                    'migration_date', NOW()::text,
                    'item_type', 'bullet_point'
                )
                WHERE meta_info IS NULL;
            """))
            conn.commit()
            print("   [OK] Initialized metadata for all content")
        except Exception as e:
            print(f"   [WARNING] Error initializing metadata: {e}")
            conn.rollback()

        # Step 10: Drop old source and page_reference columns (replaced by meta_info)
        print("\n10. Cleaning up old tracking columns...")
        try:
            conn.execute(text("""
                ALTER TABLE sections
                DROP COLUMN IF EXISTS source,
                DROP COLUMN IF EXISTS page_reference;
            """))

            conn.execute(text("""
                ALTER TABLE section_entries
                DROP COLUMN IF EXISTS source,
                DROP COLUMN IF EXISTS page_reference;
            """))

            conn.execute(text("""
                ALTER TABLE section_items
                DROP COLUMN IF EXISTS source,
                DROP COLUMN IF EXISTS page_reference;
            """))
            conn.commit()
            print("   [OK] Removed old tracking columns")
        except Exception as e:
            print(f"   [WARNING] Error removing old columns: {e}")
            conn.rollback()

        print("\n" + "="*60)
        print("Migration completed successfully!")
        print("="*60)

        # Print summary
        print("\nSummary of changes:")
        print("  • Profiles: Added title, is_default, contact_info, notes")
        print("  • Sections: Added icon, content_type, is_visible, meta_info")
        print("  • Entries: Added content_type, is_visible, meta_info")
        print("  • Items: Added is_visible, meta_info")
        print("  • All content now has explicit type tracking")
        print("  • All content now has metadata for AI features")
        print("\nContent type detection results:")

        # Count content types
        result = conn.execute(text("SELECT content_type, COUNT(*) FROM sections GROUP BY content_type"))
        print("\n  Sections by content type:")
        for row in result:
            print(f"    - {row[0]}: {row[1]}")

        result = conn.execute(text("SELECT content_type, COUNT(*) FROM section_entries GROUP BY content_type"))
        print("\n  Entries by content type:")
        for row in result:
            print(f"    - {row[0]}: {row[1]}")

        result = conn.execute(text("SELECT COUNT(*) FROM section_items"))
        total_items = result.fetchone()[0]
        print(f"\n  Total bullet points/items: {total_items}")

if __name__ == "__main__":
    migrate()
