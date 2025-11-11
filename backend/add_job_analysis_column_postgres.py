"""
Add job_analysis column to tailored_cv_versions table (PostgreSQL)
"""
import os
import psycopg2
from psycopg2 import sql

def migrate():
    # Get database URL from environment
    database_url = os.getenv("DATABASE_URL", "postgresql://kami:4444@eu1.pitunnel.com:20877/work_profile")

    print(f"Connecting to database...")

    try:
        # Connect to PostgreSQL
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()

        # Check if column already exists
        cursor.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'tailored_cv_versions'
            AND column_name = 'job_analysis'
        """)

        exists = cursor.fetchone()

        if not exists:
            print("Adding job_analysis column...")
            cursor.execute("""
                ALTER TABLE tailored_cv_versions
                ADD COLUMN job_analysis JSON
            """)
            conn.commit()
            print("[SUCCESS] Added job_analysis column")
        else:
            print("[INFO] job_analysis column already exists")

    except Exception as e:
        print(f"[ERROR] Error during migration: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    migrate()
