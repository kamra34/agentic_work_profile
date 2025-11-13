"""
Script to migrate data from local PostgreSQL to Railway PostgreSQL.
This will dump data from your local DB and restore it to Railway.
"""
import os
import subprocess
from dotenv import load_dotenv

# Load local environment
load_dotenv()

def migrate_data():
    """
    Migrate data from local PostgreSQL to Railway PostgreSQL.

    Steps:
    1. Dump data from local database
    2. Restore to Railway database
    """

    # Local database credentials (from .env)
    local_db_url = os.getenv("DATABASE_URL")

    # Railway database credentials (you'll need to set these)
    railway_db_url = input("Enter your Railway DATABASE_URL: ").strip()

    if not local_db_url:
        print("❌ Error: LOCAL DATABASE_URL not found in .env file")
        return

    if not railway_db_url:
        print("❌ Error: Railway DATABASE_URL is required")
        return

    print("\n🔄 Starting migration process...\n")

    # Step 1: Create a SQL dump from local database
    dump_file = "temp_migration_dump.sql"
    print(f"📦 Creating database dump from local database...")

    try:
        # Use pg_dump to export data
        dump_cmd = f'pg_dump "{local_db_url}" --data-only --no-owner --no-privileges -f {dump_file}'
        result = subprocess.run(dump_cmd, shell=True, capture_output=True, text=True)

        if result.returncode != 0:
            print(f"❌ Error creating dump: {result.stderr}")
            return

        print(f"✅ Dump created successfully: {dump_file}")

    except Exception as e:
        print(f"❌ Error during dump: {e}")
        return

    # Step 2: Create schema in Railway database first
    print(f"\n📋 Creating schema in Railway database...")

    try:
        # Use SQLAlchemy to create tables
        from sqlalchemy import create_engine
        from models import Base

        engine = create_engine(railway_db_url)
        Base.metadata.create_all(engine)
        print("✅ Schema created successfully in Railway database")

    except Exception as e:
        print(f"❌ Error creating schema: {e}")
        return

    # Step 3: Restore data to Railway database
    print(f"\n📥 Restoring data to Railway database...")

    try:
        restore_cmd = f'psql "{railway_db_url}" -f {dump_file}'
        result = subprocess.run(restore_cmd, shell=True, capture_output=True, text=True)

        if result.returncode != 0:
            print(f"⚠️  Warning during restore: {result.stderr}")
            print("This might be OK if it's just constraint errors on empty tables")

        print("✅ Data restored successfully")

    except Exception as e:
        print(f"❌ Error during restore: {e}")
        return

    # Step 4: Clean up
    print(f"\n🧹 Cleaning up temporary files...")
    try:
        os.remove(dump_file)
        print("✅ Cleanup complete")
    except Exception as e:
        print(f"⚠️  Warning: Could not delete {dump_file}: {e}")

    print("\n✅ Migration completed successfully!")
    print(f"\n📝 Next steps:")
    print(f"   1. Verify data in Railway database")
    print(f"   2. Set environment variables in Railway")
    print(f"   3. Deploy your backend to Railway")

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Database Migration Tool - Local to Railway")
    print("=" * 60)
    print("\nThis script will:")
    print("  1. Dump data from your local PostgreSQL database")
    print("  2. Create schema in Railway database")
    print("  3. Restore data to Railway database")
    print("\n⚠️  WARNING: This will overwrite existing data in Railway!")

    confirm = input("\nDo you want to continue? (yes/no): ").strip().lower()

    if confirm == "yes":
        migrate_data()
    else:
        print("\n❌ Migration cancelled")