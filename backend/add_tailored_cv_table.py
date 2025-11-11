"""
Database migration to add TailoredCVVersion table
Run this script to add the new table to your database
"""
import os
from sqlalchemy import create_engine, inspect
from dotenv import load_dotenv
from models import Base, TailoredCVVersion

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://kami:4444@eu1.pitunnel.com:20877/work_profile")

def migrate():
    print("Creating database engine...")
    engine = create_engine(DATABASE_URL)

    print("Checking if tailored_cv_versions table exists...")
    inspector = inspect(engine)

    if 'tailored_cv_versions' in inspector.get_table_names():
        print("[SUCCESS] Table 'tailored_cv_versions' already exists!")
        return

    print("Creating tailored_cv_versions table...")
    Base.metadata.create_all(engine, tables=[TailoredCVVersion.__table__])

    print("[SUCCESS] Successfully created tailored_cv_versions table!")
    print("\nTable structure:")
    print("- id: Primary key")
    print("- user_id: Foreign key to users")
    print("- profile_id: Foreign key to profiles")
    print("- job_title: Job title for this application")
    print("- company_name: Company name (optional)")
    print("- job_description: Original job description")
    print("- openai_fit_score: OpenAI fit score (0-100)")
    print("- claude_fit_score: Claude fit score (0-100)")
    print("- openai_ats_score: OpenAI ATS score (0-100)")
    print("- claude_ats_score: Claude ATS score (0-100)")
    print("- selected_content: JSON with selected item IDs")
    print("- openai_recommendations: OpenAI recommendations (JSON)")
    print("- claude_recommendations: Claude recommendations (JSON)")
    print("- notes: User notes")
    print("- status: Application status (draft/applied/interview/rejected/offer)")
    print("- created_at: Creation timestamp")
    print("- updated_at: Last update timestamp")

if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        print(f"[ERROR] Migration failed: {e}")
        import traceback
        traceback.print_exc()
