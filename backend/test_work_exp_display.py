#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Test work experience display to check for duplicates
"""
import sys
import io
import json

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Load cached results
with open('test_tailor_result.json', 'r', encoding='utf-8') as f:
    result = json.load(f)

enriched = result.get('enriched_recommendations', {})
work_exp = enriched.get('work_experience', [])

print("="*80)
print("WORK EXPERIENCE DISPLAY TEST")
print("="*80)

for idx, exp in enumerate(work_exp):
    print(f"\n{'─'*80}")
    print(f"{exp.get('title')}")
    print(f"{exp.get('subtitle')}")
    if exp.get('date_range'):
        print(f"{exp.get('date_range')}")
    if exp.get('location'):
        print(f"📍 {exp.get('location')}")

    # Parent-level items
    parent_items = exp.get('items', [])
    if parent_items:
        print(f"\nKey Achievements ({len(parent_items)}):")
        for item in parent_items:
            by = ', '.join(item.get('recommended_by', []))
            print(f"\n• {item.get('content')[:100]}...")
            print(f"  Recommended by: {by}")

    # Sub-entries
    sub_entries = exp.get('sub_entries', [])
    if sub_entries:
        print(f"\nRole Categories ({len(sub_entries)}):")
        for sub in sub_entries:
            print(f"\n  └─ {sub.get('title')}")
            sub_items = sub.get('items', [])
            for item in sub_items:
                by = ', '.join(item.get('recommended_by', []))
                print(f"    • {item.get('content')[:80]}...")
                print(f"      By: {by}")

            # Show reasoning if exists
            reasoning = sub.get('reasoning', {})
            if reasoning.get('openai') or reasoning.get('claude'):
                print(f"    💡 Why this matters:")
                if reasoning.get('openai'):
                    print(f"      🟢 {reasoning.get('openai')[:100]}...")
                if reasoning.get('claude'):
                    print(f"      🔵 {reasoning.get('claude')[:100]}...")

print("\n" + "="*80)
