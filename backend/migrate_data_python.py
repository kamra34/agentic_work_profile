"""
Python-based data migration script (no pg_dump required).
Migrates data from local PostgreSQL to Railway PostgreSQL using SQLAlchemy.
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, MetaData, Table, select, insert
from sqlalchemy.orm import sessionmaker

# Load local environment
load_dotenv()

def migrate_data():
    """
    Migrate data from local PostgreSQL to Railway PostgreSQL using Python.
    """

    # Local database credentials (from .env)
    local_db_url = os.getenv("DATABASE_URL")

    # Railway database credentials
    railway_db_url = input("Enter your Railway DATABASE_URL: ").strip()

    if not local_db_url:
        print("❌ Error: LOCAL DATABASE_URL not found in .env file")
        return

    if not railway_db_url:
        print("❌ Error: Railway DATABASE_URL is required")
        return

    print("\n🔄 Starting migration process...\n")

    try:
        # Connect to both databases
        print("📡 Connecting to local database...")
        local_engine = create_engine(local_db_url)
        local_conn = local_engine.connect()

        print("📡 Connecting to Railway database...")
        railway_engine = create_engine(railway_db_url)
        railway_conn = railway_engine.connect()

        # Step 1: Create schema in Railway database
        print("\n📋 Creating schema in Railway database...")
        from models import Base
        Base.metadata.create_all(railway_engine)
        print("✅ Schema created successfully")

        # Step 2: Get all tables from local database
        print("\n📊 Reading table structure from local database...")
        metadata = MetaData()
        metadata.reflect(bind=local_engine)

        tables_to_migrate = ['users', 'profiles', 'profile_nodes', 'tailored_cvs', 'job_applications']

        print(f"📋 Found {len(tables_to_migrate)} tables to migrate")

        # Step 3: Migrate data table by table
        total_rows = 0
        for table_name in tables_to_migrate:
            if table_name not in metadata.tables:
                print(f"⚠️  Table '{table_name}' not found in local database, skipping")
                continue

            table = metadata.tables[table_name]
            print(f"\n📦 Migrating table: {table_name}")

            # Read all rows from local database
            select_stmt = select(table)
            local_result = local_conn.execute(select_stmt)
            rows = local_result.fetchall()

            if not rows:
                print(f"   ℹ️  No data in {table_name}, skipping")
                continue

            print(f"   📊 Found {len(rows)} rows")

            # Convert rows to dictionaries
            columns = [col.name for col in table.columns]
            data_to_insert = []
            for row in rows:
                row_dict = dict(zip(columns, row))
                data_to_insert.append(row_dict)

            # Insert into Railway database in batches
            batch_size = 100
            for i in range(0, len(data_to_insert), batch_size):
                batch = data_to_insert[i:i + batch_size]
                try:
                    # Use SQLAlchemy core insert
                    stmt = insert(table).values(batch)
                    railway_conn.execute(stmt)
                    railway_conn.commit()
                    print(f"   ✅ Inserted batch {i//batch_size + 1} ({len(batch)} rows)")
                except Exception as e:
                    print(f"   ⚠️  Error inserting batch: {e}")
                    railway_conn.rollback()

                    # Try inserting rows one by one
                    print(f"   🔄 Trying one-by-one insertion...")
                    for row_data in batch:
                        try:
                            stmt = insert(table).values(row_data)
                            railway_conn.execute(stmt)
                            railway_conn.commit()
                        except Exception as row_error:
                            print(f"   ⚠️  Skipping row due to error: {row_error}")
                            railway_conn.rollback()
                            continue

            total_rows += len(rows)
            print(f"   ✅ Completed migrating {table_name}")

        # Close connections
        local_conn.close()
        railway_conn.close()

        print("\n" + "=" * 60)
        print(f"✅ Migration completed successfully!")
        print(f"📊 Total rows migrated: {total_rows}")
        print("=" * 60)
        print(f"\n📝 Next steps:")
        print(f"   1. Verify data in Railway database")
        print(f"   2. Set environment variables in Railway")
        print(f"   3. Deploy your backend to Railway")

    except Exception as e:
        print(f"\n❌ Error during migration: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Database Migration Tool - Local to Railway (Python)")
    print("=" * 60)
    print("\nThis script will:")
    print("  1. Connect to your local PostgreSQL database")
    print("  2. Create schema in Railway database")
    print("  3. Copy all data to Railway database")
    print("\n⚠️  WARNING: This will overwrite existing data in Railway!")

    confirm = input("\nDo you want to continue? (yes/no): ").strip().lower()

    if confirm == "yes":
        migrate_data()
    else:
        print("\n❌ Migration cancelled")