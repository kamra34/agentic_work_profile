"""
Script to drop and recreate the users table.
WARNING: This will delete all existing user data!
"""
from sqlalchemy import create_engine, text
from main import Base, DATABASE_URL
import os
from dotenv import load_dotenv

load_dotenv()

def reset_database():
    engine = create_engine(DATABASE_URL)

    print("⚠️  WARNING: This will delete all data in the users table!")
    confirm = input("Are you sure you want to continue? (yes/no): ")

    if confirm.lower() != 'yes':
        print("❌ Operation cancelled.")
        return

    print("\n🗑️  Dropping users table...")
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS users CASCADE"))
        conn.commit()

    print("✅ Users table dropped successfully!")

    print("\n🔨 Creating new users table with updated schema...")
    Base.metadata.create_all(bind=engine)

    print("✅ New users table created successfully!")
    print("\n✨ Database reset complete. You can now register new users.")

if __name__ == "__main__":
    reset_database()
