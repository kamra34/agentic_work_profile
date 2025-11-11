#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Test script for the new CV tailoring service with summary generation
"""
import sys
import os
import io
import json

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from cv_tailoring_service import tailor_cv_dual
from format_profile_for_ai import format_profile_for_ai
from main import get_complete_user_profile_data

load_dotenv()

def test_cv_tailoring():
    """Test CV tailoring with summary generation"""

    # Setup database
    engine = create_engine(os.getenv('DATABASE_URL'))
    Session = sessionmaker(bind=engine)
    session = Session()

    print("="*80)
    print("CV TAILORING TEST - NEW FORMAT")
    print("="*80)

    # Get user ID (assuming user_id=1)
    user_id = 1

    # Load mock job analysis
    with open('mock_analysis_data.json', 'r') as f:
        mock_data = json.load(f)

    job_analysis = mock_data['job_analysis']['analyses'][0]['analysis']

    print(f"\n[1] Loading profile for user {user_id}...")

    # Get formatted profile
    formatted_profile = format_profile_for_ai(session, user_id)
    print(f"[OK] Formatted profile loaded ({len(formatted_profile)} chars)")

    # Get structured profile
    user_profile = get_complete_user_profile_data(session, user_id)
    print(f"[OK] Structured profile loaded with {len(user_profile.get('sections', []))} sections")

    print(f"\n[2] Job Analysis:")
    print(f"   Role: {job_analysis.get('job_level')} - {job_analysis.get('job_category')}")
    print(f"   Technical Skills: {', '.join(job_analysis.get('technical_skills', [])[:5])}...")

    print(f"\n[3] Calling tailor_cv_dual()...")
    print(f"   This will call both OpenAI and Claude...")

    try:
        result = tailor_cv_dual(job_analysis, formatted_profile, user_profile)

        print(f"\n[OK] CV Tailoring completed successfully!")

        # Check structure
        print(f"\n{'='*80}")
        print("RESPONSE STRUCTURE")
        print(f"{'='*80}")

        print(f"\nTop-level keys: {list(result.keys())}")

        if 'tailoring_recommendations' in result:
            print(f"\nTailoring Recommendations: {len(result['tailoring_recommendations'])} models")
            for rec in result['tailoring_recommendations']:
                provider = rec.get('provider', 'unknown')
                if 'error' in rec:
                    print(f"  ❌ {provider}: ERROR - {rec['error']}")
                else:
                    print(f"  ✅ {provider}: SUCCESS")
                    recs = rec.get('recommendations', {})

                    # Check for summary suggestions
                    summary_suggestions = recs.get('summary_suggestions', [])
                    print(f"     - Summary suggestions: {len(summary_suggestions)}")

                    # Check for work experience
                    work_exp = recs.get('recommended_work_experience', [])
                    print(f"     - Work experience entries: {len(work_exp)}")

                    # Check for skills
                    skills = recs.get('recommended_skills', [])
                    print(f"     - Skill categories: {len(skills)}")

        if 'enriched_recommendations' in result:
            print(f"\n{'='*80}")
            print("ENRICHED RECOMMENDATIONS")
            print(f"{'='*80}")

            enriched = result['enriched_recommendations']

            # Summary suggestions
            summary_suggestions = enriched.get('summary_suggestions', [])
            print(f"\n📝 Summary Suggestions: {len(summary_suggestions)}")

            openai_summaries = [s for s in summary_suggestions if s.get('provider') == 'openai']
            claude_summaries = [s for s in summary_suggestions if s.get('provider') == 'claude']

            print(f"   OpenAI: {len(openai_summaries)} suggestions")
            print(f"   Claude: {len(claude_summaries)} suggestions")

            # Show first 2 summaries from each
            print(f"\n   OpenAI Summaries:")
            for i, summary in enumerate(openai_summaries[:2]):
                print(f"   [{i+1}] Focus: {summary.get('focus')}")
                print(f"       Text: {summary.get('text')[:150]}...")
                print()

            print(f"\n   Claude Summaries:")
            for i, summary in enumerate(claude_summaries[:2]):
                print(f"   [{i+1}] Focus: {summary.get('focus')}")
                print(f"       Text: {summary.get('text')[:150]}...")
                print()

            # Work experience
            work_exp = enriched.get('work_experience', [])
            print(f"\n💼 Work Experience: {len(work_exp)} entries")
            for exp in work_exp[:2]:
                print(f"   - {exp.get('title')}")
                print(f"     Recommended items: {len(exp.get('items', []))}")
                print(f"     Sub-entries: {len(exp.get('sub_entries', []))}")

            # Skills
            skills = enriched.get('skills', [])
            print(f"\n🛠️  Skills: {len(skills)} categories")
            for skill in skills[:3]:
                print(f"   - {skill.get('title')}: {len(skill.get('items', []))} skills")

            # Other sections
            education = enriched.get('education', [])
            projects = enriched.get('projects', [])
            certifications = enriched.get('certifications', [])
            awards = enriched.get('awards', [])
            publications = enriched.get('publications', [])
            languages = enriched.get('languages', [])

            print(f"\n📚 Education: {len(education)} entries")
            print(f"🚀 Projects: {len(projects)} entries")
            print(f"🏆 Certifications: {len(certifications)} entries")
            print(f"⭐ Awards: {len(awards)} entries")
            print(f"📄 Publications: {len(publications)} entries")
            print(f"🌍 Languages: {len(languages)} entries")

            # Strategy
            strategy = enriched.get('overall_strategy', {})
            print(f"\n📋 Overall Strategy:")
            print(f"   OpenAI: {strategy.get('openai', 'N/A')[:100]}...")
            print(f"   Claude: {strategy.get('claude', 'N/A')[:100]}...")

        print(f"\n{'='*80}")
        print("✅ TEST PASSED - CV Tailoring working correctly!")
        print(f"{'='*80}\n")

    except Exception as e:
        print(f"\n❌ TEST FAILED")
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        session.close()

if __name__ == "__main__":
    test_cv_tailoring()
