"""
Apply database migration to add job_description column to job_applications table
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
            print("Adding job_description column to job_applications table...")

            # Add the column
            connection.execute(text("""
                ALTER TABLE job_applications
                ADD COLUMN IF NOT EXISTS job_description TEXT;
            """))

            print("[OK] Column added successfully!")

            # Check if we want to backfill existing job applications
            print("\nChecking existing job applications...")
            result = connection.execute(text("""
                SELECT COUNT(*)
                FROM job_applications ja
                INNER JOIN tailored_cvs tc ON ja.tailored_cv_id = tc.id
                WHERE ja.job_description IS NULL
                AND tc.job_description IS NOT NULL;
            """))
            count = result.scalar()

            if count > 0:
                print(f"Found {count} job applications that can be backfilled from their tailored_cvs")
                print("Automatically backfilling them...")

                connection.execute(text("""
                    UPDATE job_applications ja
                    SET job_description = tc.job_description
                    FROM tailored_cvs tc
                    WHERE ja.tailored_cv_id = tc.id
                    AND ja.job_description IS NULL
                    AND tc.job_description IS NOT NULL;
                """))
                print(f"[OK] Backfilled {count} job applications successfully!")
            else:
                print("No job applications need backfilling.")

    print("\n[SUCCESS] Migration completed successfully!")
    print("You can now restart your backend server.")
    print("\nFrom now on, when you save a job from DetailCV page to Application Tracker,")
    print("it will automatically include the job description.")

except Exception as e:
    print(f"[ERROR] Error applying migration: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
