"""
Apply database migration to add original_snapshot column
"""
import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Load environment variables
load_dotenv()

# Get database URL from environment
database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("ERROR: DATABASE_URL not found in environment variables")
    exit(1)

print("Connecting to database...")
engine = create_engine(database_url)

try:
    with engine.connect() as connection:
        # Start a transaction
        with connection.begin():
            print("Adding original_snapshot column...")

            # Add the column
            connection.execute(text("""
                ALTER TABLE tailored_cvs
                ADD COLUMN IF NOT EXISTS original_snapshot JSON;
            """))

            print("[OK] Column added successfully!")

            # Skip index creation for JSON type (would need JSONB for GIN index)
            print("Skipping index creation (JSON type doesn't support GIN index)")

            # Check if we want to backfill existing CVs
            print("\nChecking existing CVs...")
            result = connection.execute(text("""
                SELECT COUNT(*) FROM tailored_cvs WHERE original_snapshot IS NULL;
            """))
            count = result.scalar()

            if count > 0:
                print(f"Found {count} CVs without original_snapshot")
                response = input("Do you want to backfill them with their current content_snapshot? (yes/no): ")

                if response.lower() in ['yes', 'y']:
                    connection.execute(text("""
                        UPDATE tailored_cvs
                        SET original_snapshot = content_snapshot
                        WHERE original_snapshot IS NULL;
                    """))
                    print(f"[OK] Backfilled {count} CVs successfully!")
                else:
                    print("Skipped backfill. Existing CVs will not have restore functionality.")
            else:
                print("No CVs need backfilling.")

    print("\n[SUCCESS] Migration completed successfully!")
    print("You can now restart your backend server.")

except Exception as e:
    print(f"[ERROR] Error applying migration: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
