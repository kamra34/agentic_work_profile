"""
AI Service for Tailored CV Analysis
Handles job description analysis, scoring, and node selection recommendations
using both OpenAI and Claude models.
"""

import os
import json
from openai import OpenAI
from anthropic import Anthropic
from typing import Dict, Any, List

# Initialize AI clients
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

if not OPENAI_API_KEY:
    print("WARNING: OPENAI_API_KEY not found in environment variables")
if not ANTHROPIC_API_KEY:
    print("WARNING: ANTHROPIC_API_KEY not found in environment variables")

openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None


JOB_ANALYSIS_PROMPT = """Analyze this job description and extract key information.

Job Description:
{job_description}

Return a JSON object with:
{{
  "requirements": {{
    "technical_skills": ["skill1", "skill2", ...],
    "soft_skills": ["skill1", "skill2", ...],
    "experience_years": "X-Y years or null",
    "education": ["requirement1", ...],
    "certifications": ["cert1", ...],
    "responsibilities": ["resp1", "resp2", ...],
    "key_keywords": ["keyword1", "keyword2", ...]
  }},
  "role_summary": "brief summary of the role",
  "company_culture": "description of company culture hints or null",
  "must_haves": ["critical requirement 1", ...],
  "nice_to_haves": ["optional requirement 1", ...]
}}

Be thorough and extract all relevant requirements."""


SCORING_PROMPT = """Analyze how well this candidate profile matches the job requirements.

Job Requirements:
{job_requirements}

Candidate Profile:
{profile_content}

Provide two scores (0-100):
1. **Profile Fit Score**: How well the candidate's experience, skills, and background match the job requirements
2. **ATS Score**: How likely this CV is to pass Applicant Tracking Systems (keyword matching, format compatibility)

Return JSON:
{{
  "fit_score": 85,
  "fit_reasoning": "Explanation of the fit score",
  "ats_score": 78,
  "ats_reasoning": "Explanation of ATS compatibility",
  "strengths": ["strength 1", "strength 2", ...],
  "gaps": ["gap 1", "gap 2", ...],
  "recommendations": ["recommendation 1", ...]
}}"""


NODE_SELECTION_PROMPT = """Given this job description and the candidate's profile nodes, recommend which nodes should be INCLUDED in the tailored CV.

Job Requirements:
{job_requirements}

Profile Nodes (hierarchical structure):
{profile_nodes}

For each node, decide if it should be INCLUDED (visible) or EXCLUDED (hidden) in the tailored CV.
Consider:
- Relevance to the job requirements
- Impact on ATS score
- Demonstrates key skills/experience for this role
- Strengthens the candidate's story for this position

Return JSON with node IDs and selection status:
{{
  "selected_nodes": [
    {{
      "node_id": "uuid-or-id",
      "global_id": "global-uuid",
      "include": true,
      "confidence": 0.95,
      "reason": "Why this should be included/excluded",
      "relevance_tags": ["tag1", "tag2"]
    }},
    ...
  ],
  "selection_summary": {{
    "total_nodes": 50,
    "recommended_include": 35,
    "recommended_exclude": 15
  }},
  "tailoring_strategy": "Brief explanation of the overall tailoring approach"
}}

IMPORTANT: Return recommendations for ALL nodes provided."""


def analyze_job_with_openai(job_description: str) -> Dict[str, Any]:
    """Analyze job description using OpenAI GPT-4o"""
    if not openai_client:
        return {
            "success": False,
            "model": "openai-gpt-4o",
            "error": "OpenAI client not initialized. Check API key."
        }

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert job requirement analyst. Always respond with valid JSON."},
                {"role": "user", "content": JOB_ANALYSIS_PROMPT.format(job_description=job_description)}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)
        return {
            "success": True,
            "model": "openai-gpt-4o",
            "analysis": result
        }
    except Exception as e:
        return {
            "success": False,
            "model": "openai-gpt-4o",
            "error": str(e)
        }


def analyze_job_with_claude(job_description: str) -> Dict[str, Any]:
    """Analyze job description using Claude Sonnet 4.5"""
    if not anthropic_client:
        print("ERROR: Claude client is None - API key not loaded")
        return {
            "success": False,
            "model": "claude-sonnet-4.5",
            "error": "Claude client not initialized. Check API key."
        }

    try:
        print(f"DEBUG: Calling Claude API with job description length: {len(job_description)}")
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[
                {"role": "user", "content": JOB_ANALYSIS_PROMPT.format(job_description=job_description)}
            ],
            temperature=0.3
        )

        print(f"DEBUG: Claude response type: {type(response)}")
        print(f"DEBUG: Claude response content: {response.content if hasattr(response, 'content') else 'NO CONTENT'}")

        if not response.content or len(response.content) == 0:
            raise ValueError("Claude returned empty content")

        # Extract text and remove markdown code blocks if present
        text = response.content[0].text.strip()
        if text.startswith('```'):
            # Remove markdown code blocks
            lines = text.split('\n')
            # Remove first line (```json or ```) and last line (```)
            text = '\n'.join(lines[1:-1])

        result = json.loads(text)
        print(f"DEBUG: Claude analysis successful, keys: {result.keys()}")
        return {
            "success": True,
            "model": "claude-sonnet-4.5",
            "analysis": result
        }
    except Exception as e:
        print(f"ERROR: Claude analysis failed: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "model": "claude-sonnet-4.5",
            "error": str(e)
        }


def score_profile_with_openai(job_requirements: Dict, profile_content: str) -> Dict[str, Any]:
    """Score profile fit using OpenAI"""
    if not openai_client:
        return {
            "success": False,
            "model": "openai-gpt-4o",
            "error": "OpenAI client not initialized. Check API key."
        }

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert recruiter and ATS specialist. Always respond with valid JSON."},
                {"role": "user", "content": SCORING_PROMPT.format(
                    job_requirements=json.dumps(job_requirements, indent=2),
                    profile_content=profile_content
                )}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)
        return {
            "success": True,
            "model": "openai-gpt-4o",
            "scores": result
        }
    except Exception as e:
        return {
            "success": False,
            "model": "openai-gpt-4o",
            "error": str(e)
        }


def score_profile_with_claude(job_requirements: Dict, profile_content: str) -> Dict[str, Any]:
    """Score profile fit using Claude Sonnet 4.5"""
    if not anthropic_client:
        return {
            "success": False,
            "model": "claude-sonnet-4.5",
            "error": "Claude client not initialized. Check API key."
        }

    try:
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[
                {"role": "user", "content": SCORING_PROMPT.format(
                    job_requirements=json.dumps(job_requirements, indent=2),
                    profile_content=profile_content
                )}
            ],
            temperature=0.3
        )

        # Extract text and remove markdown code blocks if present
        text = response.content[0].text.strip()
        if text.startswith('```'):
            # Remove markdown code blocks
            lines = text.split('\n')
            # Remove first line (```json or ```) and last line (```)
            text = '\n'.join(lines[1:-1])

        result = json.loads(text)
        return {
            "success": True,
            "model": "claude-sonnet-4.5",
            "scores": result
        }
    except Exception as e:
        return {
            "success": False,
            "model": "claude-sonnet-4.5",
            "error": str(e)
        }


def recommend_nodes_with_openai(job_requirements: Dict, profile_nodes: List[Dict]) -> Dict[str, Any]:
    """Recommend which nodes to include using OpenAI"""
    if not openai_client:
        return {
            "success": False,
            "model": "openai-gpt-4o",
            "error": "OpenAI client not initialized. Check API key."
        }

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert CV tailoring specialist. Always respond with valid JSON."},
                {"role": "user", "content": NODE_SELECTION_PROMPT.format(
                    job_requirements=json.dumps(job_requirements, indent=2),
                    profile_nodes=json.dumps(profile_nodes, indent=2)
                )}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)
        return {
            "success": True,
            "model": "openai-gpt-4o",
            "recommendations": result
        }
    except Exception as e:
        return {
            "success": False,
            "model": "openai-gpt-4o",
            "error": str(e)
        }


def recommend_nodes_with_claude(job_requirements: Dict, profile_nodes: List[Dict]) -> Dict[str, Any]:
    """Recommend which nodes to include using Claude Sonnet 4.5"""
    if not anthropic_client:
        return {
            "success": False,
            "model": "claude-sonnet-4.5",
            "error": "Claude client not initialized. Check API key."
        }

    try:
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=8192,
            messages=[
                {"role": "user", "content": NODE_SELECTION_PROMPT.format(
                    job_requirements=json.dumps(job_requirements, indent=2),
                    profile_nodes=json.dumps(profile_nodes, indent=2)
                )}
            ],
            temperature=0.3
        )

        # Extract text and remove markdown code blocks if present
        text = response.content[0].text.strip()
        if text.startswith('```'):
            # Remove markdown code blocks
            lines = text.split('\n')
            # Remove first line (```json or ```) and last line (```)
            text = '\n'.join(lines[1:-1])

        result = json.loads(text)
        return {
            "success": True,
            "model": "claude-sonnet-4.5",
            "recommendations": result
        }
    except Exception as e:
        return {
            "success": False,
            "model": "claude-sonnet-4.5",
            "error": str(e)
        }


def flatten_nodes_for_analysis(nodes: List[Dict], parent_context: str = "") -> List[Dict]:
    """
    Flatten hierarchical nodes into a list with context for AI analysis.
    Preserves parent-child relationships in a readable format.
    """
    flattened = []

    for node in nodes:
        context = f"{parent_context} > {node.get('title', 'Untitled')}" if parent_context else node.get('title', 'Untitled')

        flat_node = {
            "id": node.get("id"),
            "global_id": node.get("global_id"),
            "node_type": node.get("node_type"),
            "title": node.get("title"),
            "subtitle": node.get("subtitle"),
            "content": node.get("content"),
            "start_date": node.get("start_date"),
            "end_date": node.get("end_date"),
            "location": node.get("location"),
            "level": node.get("level", 0),
            "context_path": context,
            "is_visible": node.get("is_visible", True)
        }

        flattened.append(flat_node)

        # Recursively process children
        if node.get("children"):
            flattened.extend(flatten_nodes_for_analysis(node["children"], context))

    return flattened


def profile_nodes_to_text(nodes: List[Dict]) -> str:
    """Convert profile nodes to readable text for AI analysis"""
    text_parts = []

    for node in nodes:
        if node.get("node_type") == "section":
            text_parts.append(f"\n## {node.get('title', 'Section')}\n")
        elif node.get("node_type") == "entry":
            title = node.get("title", "")
            subtitle = node.get("subtitle", "")
            dates = f"{node.get('start_date', '')} - {node.get('end_date', '')}" if node.get("start_date") else ""
            location = node.get("location", "")

            text_parts.append(f"**{title}**")
            if subtitle:
                text_parts.append(f" | {subtitle}")
            if dates:
                text_parts.append(f" | {dates}")
            if location:
                text_parts.append(f" | {location}")
            text_parts.append("\n")

            if node.get("content"):
                text_parts.append(f"{node['content']}\n")
        elif node.get("node_type") in ["bullet", "item"]:
            text_parts.append(f"• {node.get('content', node.get('title', ''))}\n")
        elif node.get("node_type") == "paragraph":
            text_parts.append(f"{node.get('content', '')}\n")

        # Process children
        if node.get("children"):
            text_parts.append(profile_nodes_to_text(node["children"]))

    return "".join(text_parts)
