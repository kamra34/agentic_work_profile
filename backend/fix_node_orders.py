#!/usr/bin/env python3
"""
Fix existing node orders by assigning sequential values to siblings.
Run this once to fix nodes that were created with order=0.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from models import ProfileNode

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def fix_orders():
    db = SessionLocal()

    try:
        # Get all profiles
        profiles = db.query(ProfileNode.profile_id).distinct().all()

        for (profile_id,) in profiles:
            print(f"\nFixing orders for profile {profile_id}")

            # Get all unique parent_ids (including NULL)
            parent_ids = db.query(ProfileNode.parent_id).filter(
                ProfileNode.profile_id == profile_id
            ).distinct().all()

            for (parent_id,) in parent_ids:
                # Get siblings (nodes with same parent_id)
                siblings = db.query(ProfileNode).filter(
                    ProfileNode.profile_id == profile_id,
                    ProfileNode.parent_id == parent_id
                ).order_by(ProfileNode.id).all()

                if siblings:
                    parent_desc = f"parent_id={parent_id}" if parent_id else "root level"
                    print(f"  Fixing {len(siblings)} nodes at {parent_desc}")

                    # Assign sequential orders
                    for idx, node in enumerate(siblings):
                        node.order = idx
                        print(f"    Node {node.id} ({node.node_type}): order = {idx}")

        db.commit()
        print("\n✓ All orders fixed successfully!")

    except Exception as e:
        db.rollback()
        print(f"\n✗ Error: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 80)
    print("FIX NODE ORDERS")
    print("=" * 80)
    print("\nThis will assign sequential order values to all existing nodes.")
    print()

    response = input("Continue? (yes/no): ")
    if response.lower() != 'yes':
        print("Aborted.")
        exit(0)

    fix_orders()

    print("\n" + "=" * 80)
    print("DONE! Restart your backend server to see the changes.")
    print("=" * 80)
