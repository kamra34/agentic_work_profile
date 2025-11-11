#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Quick test for CV tailoring - hardcoded job analysis
"""
import sys
import os
import io
import json
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

load_dotenv()

# Hardcoded job analysis
JOB_ANALYSIS = {
    "Job Category": "Technical Leadership",
    "Key Requirements": {
        "Education": [
            "Advanced degree in a quantitative field (e.g., PhD/MS in EE, CS, Statistics, or related)"
        ],
        "Experience": [
            "6–10+ years across DS/ML/AI",
            "2+ years leading teams or programs (people and delivery)"
        ],
        "Technical Skills": [
            "Python",
            "Familiarity with R/MATLAB",
            "SQL",
            "Modern data tooling",
            "AWS (Bedrock, SageMaker, Lambda, Step Functions) or equivalent clouds",
            "Production experience with retrieval systems (vector indexes, chunking, metadata, eval)",
            "MLOps: containers, CI/CD, experiment tracking, model monitoring, rollback strategies"
        ],
        "Soft Skills": [
            "Strong communicator",
            "Writes clearly",
            "Avoids jargon",
            "Can defend decisions with evidence"
        ]
    },
    "Technical Skills": [
        "Python",
        "R",
        "MATLAB",
        "SQL",
        "AWS (Bedrock, SageMaker, Lambda, Step Functions)",
        "Cloud technologies",
        "Retrieval systems",
        "MLOps",
        "Containers",
        "CI/CD",
        "Experiment tracking",
        "Model monitoring",
        "Rollback strategies"
    ],
    "Soft Skills": [
        "Strong communication",
        "Clear writing",
        "Avoiding jargon",
        "Evidence-based decision making"
    ],
    "Education Requirements": [
        "Advanced degree in a quantitative field (e.g., PhD/MS in EE, CS, Statistics, or related)"
    ],
    "Experience Requirements": [
        "6–10+ years across DS/ML/AI",
        "2+ years leading teams or programs"
    ],
    "Responsibilities": [
        "Leading teams or programs in DS/ML/AI",
        "Hands-on work with Python, SQL, and data tooling",
        "Working with AWS or equivalent cloud technologies",
        "Managing production retrieval systems",
        "Implementing MLOps practices"
    ],
    "Preferred Qualifications": [
        "Familiarity with R/MATLAB"
    ],
    "Job Level": "Senior",
    "Domain/Industry": "Data Science/Machine Learning/Artificial Intelligence"
}

# Setup database
engine = create_engine(os.getenv('DATABASE_URL'))
Session = sessionmaker(bind=engine)
session = Session()

print("="*80)
print("QUICK CV TAILORING TEST")
print("="*80)

print("\n[1] Getting user profile data...")
from models import Profile, Section, SectionEntry, SectionItem

def get_complete_user_profile_data(db, user_id):
    """Fetch complete user profile with all sections, entries, and items"""
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not profile:
        return {}

    sections = db.query(Section).filter(Section.profile_id == profile.id).all()
    contact_info = profile.contact_info or {}

    profile_data = {
        "profile_id": profile.id,
        "profile_title": profile.title,
        "contact_info": contact_info,
        "sections": []
    }

    for section in sections:
        section_data = {
            "id": section.id,
            "type": section.section_type.value if section.section_type else None,
            "title": section.title,
            "content": section.content,
            "content_type": section.content_type.value if section.content_type else None,
            "entries": []
        }

        entries = db.query(SectionEntry).filter(SectionEntry.section_id == section.id).order_by(SectionEntry.order).all()

        for entry in entries:
            date_range = None
            if entry.start_date or entry.end_date:
                date_range = f"{entry.start_date or ''} - {entry.end_date or 'Present'}".strip(' -')

            entry_data = {
                "id": entry.id,
                "title": entry.title,
                "subtitle": entry.subtitle,
                "start_date": entry.start_date,
                "end_date": entry.end_date,
                "date_range": date_range,
                "location": entry.location,
                "description": entry.description,
                "content_type": entry.content_type.value if entry.content_type else None,
                "order": entry.order,
                "parent_entry_id": entry.parent_entry_id,
                "items": []
            }

            items = db.query(SectionItem).filter(SectionItem.entry_id == entry.id).order_by(SectionItem.order).all()

            for item in items:
                entry_data["items"].append({
                    "id": item.id,
                    "content": item.content,
                    "order": item.order
                })

            section_data["entries"].append(entry_data)

        profile_data["sections"].append(section_data)

    return profile_data

user_profile = get_complete_user_profile_data(session, user_id=1)
print(f"✓ Profile loaded: {len(user_profile.get('sections', []))} sections")

print("\n[2] Formatting profile for AI...")
from format_profile_for_ai import format_profile_for_ai
formatted_profile = format_profile_for_ai(session, user_id=1)
print(f"✓ Formatted profile: {len(formatted_profile)} chars")

# Print first part of formatted profile to see IDs
print("\n[DEBUG] First 800 chars of formatted profile:")
print(formatted_profile[:800])

print("\n[3] Calling CV tailoring service...")

# Check if we have cached results
import os
CACHE_FILE = "test_tailor_result.json"

if os.path.exists(CACHE_FILE):
    print("   📦 Loading cached results...")
    with open(CACHE_FILE, 'r', encoding='utf-8') as f:
        result = json.load(f)
else:
    print("   🔄 Calling AI models...")
    from cv_tailoring_service import tailor_cv_dual
    result = tailor_cv_dual(JOB_ANALYSIS, formatted_profile, user_profile)

    # Save for next time
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"   💾 Saved results to {CACHE_FILE}")

print("\n" + "="*80)
print("RESULTS")
print("="*80)

# Check raw recommendations
if 'tailoring_recommendations' in result:
    print(f"\n📋 Raw Recommendations: {len(result['tailoring_recommendations'])} models")
    for rec in result['tailoring_recommendations']:
        provider = rec.get('provider', 'unknown')
        if 'error' in rec:
            print(f"  ❌ {provider}: ERROR - {rec['error']}")
        else:
            print(f"  ✅ {provider}")
            recs = rec.get('recommendations', {})
            summary_ids = recs.get('recommended_summary', [])
            print(f"     Summary IDs: {summary_ids}")
            print(f"     Total summary items: {len(summary_ids)}")

# Check enriched recommendations
if 'enriched_recommendations' in result:
    enriched = result['enriched_recommendations']
    print(f"\n📝 Enriched Summary: {len(enriched.get('summary', []))} items")

    for idx, item in enumerate(enriched.get('summary', [])[:5]):
        by = ', '.join(item.get('recommended_by', []))
        print(f"\n  [{idx+1}] (by: {by})")
        print(f"      {item.get('content', '')[:120]}...")
else:
    print("\n❌ No enriched_recommendations in result!")

print("\n" + "="*80)
session.close()
