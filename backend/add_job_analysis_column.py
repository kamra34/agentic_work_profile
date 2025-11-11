"""
Add job_analysis column to tailored_cv_versions table
"""
import sqlite3
import os

def migrate():
    db_path = os.path.join(os.path.dirname(__file__), 'app.db')
    print(f"Using database: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # List all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        print(f"Available tables: {[t[0] for t in tables]}")

        # Check if column already exists
        cursor.execute("PRAGMA table_info(tailored_cv_versions)")
        columns = [column[1] for column in cursor.fetchall()]
        print(f"Existing columns: {columns}")

        if 'job_analysis' not in columns:
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
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
