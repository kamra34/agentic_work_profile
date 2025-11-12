#!/usr/bin/env python3
"""
Initialize the new hierarchical database schema.
Run this ONCE on the new general_work_profile database.
"""

import os
from sqlalchemy import create_engine
from dotenv import load_dotenv
from models import Base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in .env file")
    exit(1)

print("=" * 80)
print("DATABASE INITIALIZATION")
print("=" * 80)
print(f"\nDatabase: {DATABASE_URL.split('@')[1]}")  # Hide password
print("\nThis will create all tables in the database.")
print("Make sure you're connected to the NEW general_work_profile database!")
print()

response = input("Continue? (yes/no): ")
if response.lower() != 'yes':
    print("Aborted.")
    exit(0)

print("\nCreating tables...")
engine = create_engine(DATABASE_URL)
Base.metadata.create_all(bind=engine)

print("\n✓ All tables created successfully!")
print("\nTables created:")
print("  - users")
print("  - profiles")
print("  - profile_nodes (hierarchical)")
print("  - tailored_cvs")
print("\n" + "=" * 80)
print("Database ready! You can now run the backend server.")
print("=" * 80)
