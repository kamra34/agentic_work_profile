"""
CV Tailoring Service
AI-powered CV tailoring that recommends which specific bullets, items, and sections
to include for a specific job application
"""
import os
import json
from typing import Dict, Any, List

# Initialize clients conditionally
openai_client = None
anthropic_client = None

try:
    from openai import OpenAI
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if openai_api_key:
        openai_client = OpenAI(api_key=openai_api_key)
except Exception as e:
    print(f"OpenAI client initialization failed: {e}")

try:
    import anthropic
    anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
    if anthropic_api_key:
        anthropic_client = anthropic.Anthropic(api_key=anthropic_api_key)
except Exception as e:
    print(f"Anthropic client initialization failed: {e}")


def tailor_cv_with_openai(job_analysis: Dict[str, Any], formatted_profile: str) -> Dict[str, Any]:
    """
    Recommend which specific content to include for this job using OpenAI

    Args:
        job_analysis: The analyzed job description data
        formatted_profile: Formatted profile text from format_profile_for_ai()
    """
    if not openai_client:
        raise Exception("OpenAI client not initialized. Please set OPENAI_API_KEY environment variable.")

    system_prompt = """You are an expert CV tailoring assistant. Your job is to recommend which specific content from a candidate's master profile should be included in a tailored CV for a specific job application.

CRITICAL INSTRUCTIONS:

**SUMMARY SECTION:**
- The candidate has existing summary items in their profile (you'll see item IDs in the Summary section)
- YOU MUST SELECT EXACTLY 5-7 ITEM IDs from the candidate's existing summary items
- Return these as an array of item_ids: "recommended_summary": [123, 456, 789, ...]
- Choose the summary items that best highlight relevant aspects for this specific role
- IMPORTANT: Select 5-7 items, not just 1 or 2

**WORK EXPERIENCE:**
- Recommend SPECIFIC bullet point IDs (you'll see IDs in the profile structure)
- The candidate has a hierarchical structure: companies → roles/subsections → bullet points
- For EACH role entry and sub-entry, recommend which specific bullet points to include
- Select bullets that best match the job requirements and demonstrate relevant skills
- Be selective - quality over quantity

**SKILLS:**
- The candidate has skill categories/groups
- For EACH category (entry_id), recommend which specific skill items to include
- Prioritize skills mentioned in the job description

**EDUCATION, PROJECTS, CERTIFICATIONS:**
- Recommend entire entries (by entry_id) that are most relevant
- All bullets within recommended entries will be included

**IMPORTANT NOTES:**
- Prioritize content that matches job requirements and keywords
- Consider ATS optimization - include exact keyword matches
- Keep CV length reasonable (1-2 pages worth of content)

Your recommendations must be in this JSON structure:
{
  "recommended_summary": [123, 456, 789, 101, 112, 131, 145],  // EXACTLY 5-7 item IDs from Summary section
  "recommended_work_experience": [
    {
      "entry_id": <entry_id>,
      "entry_type": "<'parent' or 'sub_entry'>",
      "recommended_items": [<item_id>, <item_id>, ...],
      "reasoning": "<why these bullets are relevant>"
    }
  ],
  "recommended_skills": [
    {
      "entry_id": <entry_id>,
      "recommended_items": [<item_id>, <item_id>, ...],
      "reasoning": "<why these skills>"
    }
  ],
  "recommended_education": [<entry_id>, <entry_id>, ...],
  "recommended_projects": [<entry_id>, <entry_id>, ...],
  "recommended_certifications": [<entry_id>, <entry_id>, ...],
  "recommended_awards": [<entry_id>, <entry_id>, ...],
  "recommended_publications": [<entry_id>, <entry_id>, ...],
  "recommended_languages": [<entry_id>, <entry_id>, ...],
  "overall_strategy": "<brief explanation of tailoring strategy>",
  "key_keywords_to_include": ["<keyword1>", "<keyword2>", ...],
  "estimated_page_count": <number>
}

Return ONLY the JSON object, no other text."""

    user_content = f"""Job Requirements:
{json.dumps(job_analysis, indent=2)}

Candidate Master Profile:
{formatted_profile}

Recommend which specific items to include in a tailored CV for this job. Be selective and strategic."""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )

        result = json.loads(response.choices[0].message.content)

        return {
            "provider": "openai",
            "model": "gpt-4o",
            "recommendations": result
        }

    except Exception as e:
        raise Exception(f"OpenAI CV tailoring failed: {str(e)}")


def tailor_cv_with_claude(job_analysis: Dict[str, Any], formatted_profile: str) -> Dict[str, Any]:
    """
    Recommend which specific content to include for this job using Claude

    Args:
        job_analysis: The analyzed job description data
        formatted_profile: Formatted profile text from format_profile_for_ai()
    """
    if not anthropic_client:
        raise Exception("Anthropic client not initialized. Please set ANTHROPIC_API_KEY environment variable.")

    system_prompt = """You are an expert CV tailoring assistant. Your job is to recommend which specific content from a candidate's master profile should be included in a tailored CV for a specific job application.

CRITICAL INSTRUCTIONS:

**SUMMARY SECTION:**
- The candidate has existing summary items in their profile (you'll see item IDs in the Summary section)
- YOU MUST SELECT EXACTLY 5-7 ITEM IDs from the candidate's existing summary items
- Return these as an array of item_ids: "recommended_summary": [123, 456, 789, ...]
- Choose the summary items that best highlight relevant aspects for this specific role
- IMPORTANT: Select 5-7 items, not just 1 or 2

**WORK EXPERIENCE:**
- Recommend SPECIFIC bullet point IDs (you'll see IDs in the profile structure)
- The candidate has a hierarchical structure: companies → roles/subsections → bullet points
- For EACH role entry and sub-entry, recommend which specific bullet points to include
- Select bullets that best match the job requirements and demonstrate relevant skills
- Be selective - quality over quantity

**SKILLS:**
- The candidate has skill categories/groups
- For EACH category (entry_id), recommend which specific skill items to include
- Prioritize skills mentioned in the job description

**EDUCATION, PROJECTS, CERTIFICATIONS:**
- Recommend entire entries (by entry_id) that are most relevant
- All bullets within recommended entries will be included

**IMPORTANT NOTES:**
- Prioritize content that matches job requirements and keywords
- Consider ATS optimization - include exact keyword matches
- Keep CV length reasonable (1-2 pages worth of content)

Your recommendations must be in this JSON structure:
{
  "recommended_summary": [123, 456, 789, 101, 112, 131, 145],  // EXACTLY 5-7 item IDs from Summary section
  "recommended_work_experience": [
    {
      "entry_id": <entry_id>,
      "entry_type": "<'parent' or 'sub_entry'>",
      "recommended_items": [<item_id>, <item_id>, ...],
      "reasoning": "<why these bullets are relevant>"
    }
  ],
  "recommended_skills": [
    {
      "entry_id": <entry_id>,
      "recommended_items": [<item_id>, <item_id>, ...],
      "reasoning": "<why these skills>"
    }
  ],
  "recommended_education": [<entry_id>, <entry_id>, ...],
  "recommended_projects": [<entry_id>, <entry_id>, ...],
  "recommended_certifications": [<entry_id>, <entry_id>, ...],
  "recommended_awards": [<entry_id>, <entry_id>, ...],
  "recommended_publications": [<entry_id>, <entry_id>, ...],
  "recommended_languages": [<entry_id>, <entry_id>, ...],
  "overall_strategy": "<brief explanation of tailoring strategy>",
  "key_keywords_to_include": ["<keyword1>", "<keyword2>", ...],
  "estimated_page_count": <number>
}

Start your response with { and end with }."""

    user_content = f"""Job Requirements:
{json.dumps(job_analysis, indent=2)}

Candidate Master Profile:
{formatted_profile}

Recommend which specific items to include in a tailored CV for this job. Be selective and strategic."""

    try:
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            temperature=0.3,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": user_content
                }
            ]
        )

        content = response.content[0].text
        result = json.loads(content)

        return {
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "recommendations": result
        }

    except json.JSONDecodeError as e:
        return {
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "recommendations": {
                "raw_response": content,
                "error": f"Failed to parse JSON: {str(e)}"
            }
        }
    except Exception as e:
        raise Exception(f"Claude CV tailoring failed: {str(e)}")


def enrich_recommendations_with_content(recommendations: List[Dict], user_profile: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enrich AI recommendations with actual content from user profile and merge recommendations from both models.
    Returns a unified structure showing which model recommends each item.
    """
    # Build lookup dictionaries for quick access
    items_lookup = {}  # item_id -> {content, entry_id, section_type}
    entries_lookup = {}  # entry_id -> {title, subtitle, etc.}

    # Index all items and entries from user profile
    for section in user_profile.get("sections", []):
        section_type = section.get("type")
        for entry in section.get("entries", []):
            entry_id = entry.get("id")
            entries_lookup[entry_id] = {
                "id": entry_id,
                "title": entry.get("title"),
                "subtitle": entry.get("subtitle"),
                "date_range": entry.get("date_range"),
                "location": entry.get("location"),
                "description": entry.get("description"),
                "parent_entry_id": entry.get("parent_entry_id"),  # Store parent relationship
                "section_type": section_type
            }

            for item in entry.get("items", []):
                item_id = item.get("id")
                items_lookup[item_id] = {
                    "id": item_id,
                    "content": item.get("content"),
                    "entry_id": entry_id,
                    "section_type": section_type
                }

    # Process recommendations from both models
    openai_recs = None
    claude_recs = None

    for rec in recommendations:
        if rec.get("provider") == "openai" and not rec.get("error"):
            openai_recs = rec.get("recommendations", {})
        elif rec.get("provider") == "anthropic" and not rec.get("error"):
            claude_recs = rec.get("recommendations", {})

    # Merge and enrich recommendations
    enriched = {
        "summary": [],  # Selected summary items from candidate's existing summaries
        "work_experience": [],
        "skills": [],
        "education": [],
        "projects": [],
        "certifications": [],
        "awards": [],
        "publications": [],
        "languages": [],
        "overall_strategy": {
            "openai": openai_recs.get("overall_strategy") if openai_recs else None,
            "claude": claude_recs.get("overall_strategy") if claude_recs else None
        },
        "key_keywords": {
            "openai": openai_recs.get("key_keywords_to_include", []) if openai_recs else [],
            "claude": claude_recs.get("key_keywords_to_include", []) if claude_recs else []
        },
        "estimated_pages": {
            "openai": openai_recs.get("estimated_page_count") if openai_recs else None,
            "claude": claude_recs.get("estimated_page_count") if claude_recs else None
        }
    }

    # Enrich summary (item-level selection from existing summaries)
    openai_summary = set(openai_recs.get("recommended_summary", []) if openai_recs else [])
    claude_summary = set(claude_recs.get("recommended_summary", []) if claude_recs else [])
    all_summary_items = openai_summary | claude_summary

    for item_id in all_summary_items:
        if item_id in items_lookup:
            item_data = items_lookup[item_id].copy()
            item_data["recommended_by"] = []
            if item_id in openai_summary:
                item_data["recommended_by"].append("openai")
            if item_id in claude_summary:
                item_data["recommended_by"].append("claude")
            enriched["summary"].append(item_data)

    # Enrich work experience (handle hierarchical structure: parent entries with sub-entries)
    openai_work = openai_recs.get("recommended_work_experience", []) if openai_recs else []
    claude_work = claude_recs.get("recommended_work_experience", []) if claude_recs else []

    # Group by entry_id (both parent and sub-entries)
    work_by_entry = {}
    for exp in openai_work:
        entry_id = exp.get("entry_id")
        if entry_id not in work_by_entry:
            work_by_entry[entry_id] = {"openai": exp, "claude": None}
        else:
            work_by_entry[entry_id]["openai"] = exp

    for exp in claude_work:
        entry_id = exp.get("entry_id")
        if entry_id not in work_by_entry:
            work_by_entry[entry_id] = {"openai": None, "claude": exp}
        else:
            work_by_entry[entry_id]["claude"] = exp

    # Separate parent entries and sub-entries
    parent_entries = {}
    sub_entries_by_parent = {}

    for entry_id in work_by_entry.keys():
        if entry_id in entries_lookup:
            entry = entries_lookup[entry_id]
            parent_id = entry.get("parent_entry_id")

            if parent_id is None:
                # This is a parent entry
                parent_entries[entry_id] = work_by_entry[entry_id]
            else:
                # This is a sub-entry
                if parent_id not in sub_entries_by_parent:
                    sub_entries_by_parent[parent_id] = {}
                sub_entries_by_parent[parent_id][entry_id] = work_by_entry[entry_id]

    # Enrich each parent work entry with its sub-entries
    for parent_id, models_data in parent_entries.items():
        if parent_id in entries_lookup:
            entry_info = entries_lookup[parent_id].copy()
            entry_info["items"] = []
            entry_info["sub_entries"] = []

            # Collect items directly attached to parent entry (not items from sub-entries)
            openai_items = set(models_data["openai"].get("recommended_items", []) if models_data["openai"] else [])
            claude_items = set(models_data["claude"].get("recommended_items", []) if models_data["claude"] else [])
            all_parent_items = openai_items | claude_items

            for item_id in all_parent_items:
                if item_id in items_lookup:
                    item_data = items_lookup[item_id].copy()
                    # Only include if this item actually belongs to the parent entry (not a sub-entry)
                    if item_data["entry_id"] == parent_id:
                        item_data["recommended_by"] = []
                        if item_id in openai_items:
                            item_data["recommended_by"].append("openai")
                        if item_id in claude_items:
                            item_data["recommended_by"].append("claude")
                        entry_info["items"].append(item_data)

            # Add sub-entries (e.g., "Delivery & Stakeholder Management", "Product Management")
            if parent_id in sub_entries_by_parent:
                for sub_id, sub_models_data in sub_entries_by_parent[parent_id].items():
                    if sub_id in entries_lookup:
                        sub_entry_info = entries_lookup[sub_id].copy()
                        sub_entry_info["items"] = []

                        # Collect items for this sub-entry
                        openai_sub_items = set(sub_models_data["openai"].get("recommended_items", []) if sub_models_data["openai"] else [])
                        claude_sub_items = set(sub_models_data["claude"].get("recommended_items", []) if sub_models_data["claude"] else [])
                        all_sub_items = openai_sub_items | claude_sub_items

                        for item_id in all_sub_items:
                            if item_id in items_lookup:
                                item_data = items_lookup[item_id].copy()
                                item_data["recommended_by"] = []
                                if item_id in openai_sub_items:
                                    item_data["recommended_by"].append("openai")
                                if item_id in claude_sub_items:
                                    item_data["recommended_by"].append("claude")
                                sub_entry_info["items"].append(item_data)

                        sub_entry_info["reasoning"] = {
                            "openai": sub_models_data["openai"].get("reasoning") if sub_models_data["openai"] else None,
                            "claude": sub_models_data["claude"].get("reasoning") if sub_models_data["claude"] else None
                        }

                        entry_info["sub_entries"].append(sub_entry_info)

            entry_info["reasoning"] = {
                "openai": models_data["openai"].get("reasoning") if models_data["openai"] else None,
                "claude": models_data["claude"].get("reasoning") if models_data["claude"] else None
            }

            enriched["work_experience"].append(entry_info)

    # Enrich skills (similar to work experience - category level with items)
    openai_skills = openai_recs.get("recommended_skills", []) if openai_recs else []
    claude_skills = claude_recs.get("recommended_skills", []) if claude_recs else []

    skills_by_entry = {}
    for skill in openai_skills:
        entry_id = skill.get("entry_id")
        if entry_id not in skills_by_entry:
            skills_by_entry[entry_id] = {"openai": skill, "claude": None}
        else:
            skills_by_entry[entry_id]["openai"] = skill

    for skill in claude_skills:
        entry_id = skill.get("entry_id")
        if entry_id not in skills_by_entry:
            skills_by_entry[entry_id] = {"openai": None, "claude": skill}
        else:
            skills_by_entry[entry_id]["claude"] = skill

    # Enrich each skill category
    for entry_id, models_data in skills_by_entry.items():
        if entry_id in entries_lookup:
            entry_info = entries_lookup[entry_id].copy()
            entry_info["items"] = []

            # Collect all recommended items for this skill category
            openai_items = set(models_data["openai"].get("recommended_items", []) if models_data["openai"] else [])
            claude_items = set(models_data["claude"].get("recommended_items", []) if models_data["claude"] else [])
            all_items = openai_items | claude_items

            for item_id in all_items:
                if item_id in items_lookup:
                    item_data = items_lookup[item_id].copy()
                    item_data["recommended_by"] = []
                    if item_id in openai_items:
                        item_data["recommended_by"].append("openai")
                    if item_id in claude_items:
                        item_data["recommended_by"].append("claude")
                    entry_info["items"].append(item_data)

            entry_info["reasoning"] = {
                "openai": models_data["openai"].get("reasoning") if models_data["openai"] else None,
                "claude": models_data["claude"].get("reasoning") if models_data["claude"] else None
            }

            enriched["skills"].append(entry_info)

    # Enrich education (entry-level recommendations)
    openai_edu = set(openai_recs.get("recommended_education", []) if openai_recs else [])
    claude_edu = set(claude_recs.get("recommended_education", []) if claude_recs else [])
    all_edu = openai_edu | claude_edu

    for entry_id in all_edu:
        if entry_id in entries_lookup:
            entry_info = entries_lookup[entry_id].copy()
            entry_info["recommended_by"] = []
            if entry_id in openai_edu:
                entry_info["recommended_by"].append("openai")
            if entry_id in claude_edu:
                entry_info["recommended_by"].append("claude")

            # Include all items for this education entry
            entry_info["items"] = []
            for item_id, item_data in items_lookup.items():
                if item_data["entry_id"] == entry_id:
                    entry_info["items"].append(item_data)

            enriched["education"].append(entry_info)

    # Enrich projects (entry-level recommendations)
    openai_proj = set(openai_recs.get("recommended_projects", []) if openai_recs else [])
    claude_proj = set(claude_recs.get("recommended_projects", []) if claude_recs else [])
    all_proj = openai_proj | claude_proj

    for entry_id in all_proj:
        if entry_id in entries_lookup:
            entry_info = entries_lookup[entry_id].copy()
            entry_info["recommended_by"] = []
            if entry_id in openai_proj:
                entry_info["recommended_by"].append("openai")
            if entry_id in claude_proj:
                entry_info["recommended_by"].append("claude")

            # Include all items for this project entry
            entry_info["items"] = []
            for item_id, item_data in items_lookup.items():
                if item_data["entry_id"] == entry_id:
                    entry_info["items"].append(item_data)

            enriched["projects"].append(entry_info)

    # Enrich certifications (entry-level recommendations)
    openai_cert = set(openai_recs.get("recommended_certifications", []) if openai_recs else [])
    claude_cert = set(claude_recs.get("recommended_certifications", []) if claude_recs else [])
    all_cert = openai_cert | claude_cert

    for entry_id in all_cert:
        if entry_id in entries_lookup:
            entry_info = entries_lookup[entry_id].copy()
            entry_info["recommended_by"] = []
            if entry_id in openai_cert:
                entry_info["recommended_by"].append("openai")
            if entry_id in claude_cert:
                entry_info["recommended_by"].append("claude")

            # Include all items for this certification entry
            entry_info["items"] = []
            for item_id, item_data in items_lookup.items():
                if item_data["entry_id"] == entry_id:
                    entry_info["items"].append(item_data)

            enriched["certifications"].append(entry_info)

    # Enrich awards (entry-level recommendations)
    openai_awards = set(openai_recs.get("recommended_awards", []) if openai_recs else [])
    claude_awards = set(claude_recs.get("recommended_awards", []) if claude_recs else [])
    all_awards = openai_awards | claude_awards

    for entry_id in all_awards:
        if entry_id in entries_lookup:
            entry_info = entries_lookup[entry_id].copy()
            entry_info["recommended_by"] = []
            if entry_id in openai_awards:
                entry_info["recommended_by"].append("openai")
            if entry_id in claude_awards:
                entry_info["recommended_by"].append("claude")

            # Include all items for this award entry
            entry_info["items"] = []
            for item_id, item_data in items_lookup.items():
                if item_data["entry_id"] == entry_id:
                    entry_info["items"].append(item_data)

            enriched["awards"].append(entry_info)

    # Enrich publications (entry-level recommendations)
    openai_pubs = set(openai_recs.get("recommended_publications", []) if openai_recs else [])
    claude_pubs = set(claude_recs.get("recommended_publications", []) if claude_recs else [])
    all_pubs = openai_pubs | claude_pubs

    for entry_id in all_pubs:
        if entry_id in entries_lookup:
            entry_info = entries_lookup[entry_id].copy()
            entry_info["recommended_by"] = []
            if entry_id in openai_pubs:
                entry_info["recommended_by"].append("openai")
            if entry_id in claude_pubs:
                entry_info["recommended_by"].append("claude")

            # Include all items for this publication entry
            entry_info["items"] = []
            for item_id, item_data in items_lookup.items():
                if item_data["entry_id"] == entry_id:
                    entry_info["items"].append(item_data)

            enriched["publications"].append(entry_info)

    # Enrich languages (entry-level recommendations)
    openai_langs = set(openai_recs.get("recommended_languages", []) if openai_recs else [])
    claude_langs = set(claude_recs.get("recommended_languages", []) if claude_recs else [])
    all_langs = openai_langs | claude_langs

    for entry_id in all_langs:
        if entry_id in entries_lookup:
            entry_info = entries_lookup[entry_id].copy()
            entry_info["recommended_by"] = []
            if entry_id in openai_langs:
                entry_info["recommended_by"].append("openai")
            if entry_id in claude_langs:
                entry_info["recommended_by"].append("claude")

            # Include all items for this language entry
            entry_info["items"] = []
            for item_id, item_data in items_lookup.items():
                if item_data["entry_id"] == entry_id:
                    entry_info["items"].append(item_data)

            enriched["languages"].append(entry_info)

    return enriched


def tailor_cv_dual(job_analysis: Dict[str, Any], formatted_profile: str, user_profile: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get CV tailoring recommendations from both OpenAI and Claude, then enrich with actual content

    Args:
        job_analysis: The analyzed job description data
        formatted_profile: Formatted profile text from format_profile_for_ai()
        user_profile: Structured user profile data (needed for enrichment)
    """
    results = {
        "job_analysis": job_analysis,
        "input_data": {
            "job_analysis": job_analysis,
            "formatted_profile": formatted_profile
        },
        "tailoring_recommendations": []
    }

    # Try OpenAI
    try:
        openai_result = tailor_cv_with_openai(job_analysis, formatted_profile)
        results["tailoring_recommendations"].append(openai_result)
    except Exception as e:
        results["tailoring_recommendations"].append({
            "provider": "openai",
            "error": str(e)
        })

    # Try Claude
    try:
        claude_result = tailor_cv_with_claude(job_analysis, formatted_profile)
        results["tailoring_recommendations"].append(claude_result)
    except Exception as e:
        results["tailoring_recommendations"].append({
            "provider": "anthropic",
            "error": str(e)
        })

    # Enrich recommendations with actual content (still needs structured profile)
    enriched_recs = enrich_recommendations_with_content(
        results["tailoring_recommendations"],
        user_profile
    )

    results["enriched_recommendations"] = enriched_recs

    return results
