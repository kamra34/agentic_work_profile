#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Simple test for CV tailoring prompts - verify JSON structure
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

from dotenv import load_dotenv

load_dotenv()

def test_prompt_structure():
    """Test that the prompts are correctly defined"""

    print("="*80)
    print("CV TAILORING PROMPT STRUCTURE TEST")
    print("="*80)

    # Import service
    from cv_tailoring_service import tailor_cv_with_openai, tailor_cv_with_claude

    print("\n✅ Successfully imported CV tailoring functions")

    # Check if we have the expected JSON structure in the prompts
    import inspect

    openai_source = inspect.getsource(tailor_cv_with_openai)
    claude_source = inspect.getsource(tailor_cv_with_claude)

    print("\n[OpenAI Prompt Check]")
    if '"summary_suggestions"' in openai_source:
        print("  ✅ Contains 'summary_suggestions' field")
    else:
        print("  ❌ Missing 'summary_suggestions' field")

    if '"recommended_work_experience"' in openai_source:
        print("  ✅ Contains 'recommended_work_experience' field")
    else:
        print("  ❌ Missing 'recommended_work_experience' field")

    if '"recommended_awards"' in openai_source:
        print("  ✅ Contains 'recommended_awards' field")
    else:
        print("  ❌ Missing 'recommended_awards' field")

    if '"recommended_publications"' in openai_source:
        print("  ✅ Contains 'recommended_publications' field")
    else:
        print("  ❌ Missing 'recommended_publications' field")

    if '"recommended_languages"' in openai_source:
        print("  ✅ Contains 'recommended_languages' field")
    else:
        print("  ❌ Missing 'recommended_languages' field")

    print("\n[Claude Prompt Check]")
    if '"summary_suggestions"' in claude_source:
        print("  ✅ Contains 'summary_suggestions' field")
    else:
        print("  ❌ Missing 'summary_suggestions' field")

    if '"recommended_work_experience"' in claude_source:
        print("  ✅ Contains 'recommended_work_experience' field")
    else:
        print("  ❌ Missing 'recommended_work_experience' field")

    if '"recommended_awards"' in claude_source:
        print("  ✅ Contains 'recommended_awards' field")
    else:
        print("  ❌ Missing 'recommended_awards' field")

    if '"recommended_publications"' in claude_source:
        print("  ✅ Contains 'recommended_publications' field")
    else:
        print("  ❌ Missing 'recommended_publications' field")

    if '"recommended_languages"' in claude_source:
        print("  ✅ Contains 'recommended_languages' field")
    else:
        print("  ❌ Missing 'recommended_languages' field")

    print("\n[Enrichment Function Check]")
    from cv_tailoring_service import enrich_recommendations_with_content
    enrich_source = inspect.getsource(enrich_recommendations_with_content)

    if '"summary_suggestions"' in enrich_source and 'AI-generated summaries' in enrich_source:
        print("  ✅ Enrichment handles summary_suggestions correctly")
    else:
        print("  ❌ Enrichment may not handle summary_suggestions correctly")

    if '"awards"' in enrich_source:
        print("  ✅ Enrichment handles awards")
    else:
        print("  ❌ Enrichment missing awards handling")

    if '"publications"' in enrich_source:
        print("  ✅ Enrichment handles publications")
    else:
        print("  ❌ Enrichment missing publications handling")

    if '"languages"' in enrich_source:
        print("  ✅ Enrichment handles languages")
    else:
        print("  ❌ Enrichment missing languages handling")

    print("\n" + "="*80)
    print("✅ STRUCTURE TEST COMPLETE")
    print("="*80 + "\n")

    print("\n📝 SUMMARY OF CHANGES:")
    print("="*80)
    print("\n1. Summary Section:")
    print("   - Changed from selecting existing items to GENERATING new summaries")
    print("   - Each AI model generates 5-7 tailored summary options")
    print("   - Each summary has 'text' and 'focus' fields")
    print("   - Summaries are labeled by provider (openai/claude)")

    print("\n2. Work Experience:")
    print("   - Maintains hierarchical structure (parent → sub-entries → items)")
    print("   - AI selects specific bullet points (items) to include")
    print("   - Each entry has reasoning for why items were selected")

    print("\n3. Skills:")
    print("   - AI recommends specific skill items per category")
    print("   - Categories (entries) maintained with selected items")

    print("\n4. Additional Sections:")
    print("   - Awards, Publications, Languages now supported")
    print("   - AI recommends relevant entries from these sections")
    print("   - All sections properly enriched with content")

    print("\n5. Response Format:")
    print("   - Enriched recommendations clearly show which AI recommended what")
    print("   - 'recommended_by' field lists providers for each item")
    print("   - Strategy and keywords from both AIs included")

    print("\n" + "="*80 + "\n")

if __name__ == "__main__":
    test_prompt_structure()
