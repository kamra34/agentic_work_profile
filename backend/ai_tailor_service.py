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


JOB_ANALYSIS_PROMPT = """Analyze this job description and extract key information with critical precision.

Job Description:
{job_description}

Return a JSON object with:
{{
  "job_metadata": {{
    "title": "extracted job title",
    "company": "company name if mentioned, otherwise null",
    "seniority_level": "Entry/Mid/Senior/Lead/Principal/Executive or null",
    "location": "location if mentioned, otherwise null",
    "job_type": "Full-time/Part-time/Contract/etc or null"
  }},
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


SCORING_PROMPT = """You are a brutally honest technical recruiter and career advisor. Analyze this candidate profile against the job requirements with critical precision. Your goal is to save the candidate's time by being factual, direct, and realistic about their chances.

Job Requirements:
{job_requirements}

Candidate Profile:
{profile_content}

Provide a critical, fact-based analysis:

Return JSON:
{{
  "fit_score": 85,
  "fit_reasoning": "Factual explanation of why this score. Be specific about what matches and what doesn't. No sugar-coating.",
  "ats_score": 78,
  "ats_reasoning": "Specific explanation of ATS compatibility. Mention keyword matches/misses, format issues.",
  "verdict": "SHOULD_APPLY or SHOULD_NOT_APPLY",
  "verdict_reasoning": "Clear, direct explanation of why the candidate should or should not apply. Focus on realistic chances and time investment value.",
  "strengths": ["Specific strength with evidence from profile", ...],
  "missing_skills": ["Skill required by job but absent from profile", ...],
  "critical_gaps": ["Deal-breaker gaps that significantly hurt chances", ...],
  "matching_skills": ["Skills the candidate has that match job requirements", ...],
  "recommendations": ["Actionable recommendation 1", ...]
}}

Be honest and critical. If the fit is poor, say so directly. If it's excellent, explain why with facts. Focus on:
- Exact skill matches vs. missing requirements
- Experience level alignment
- Technical depth in required areas
- Red flags or deal-breakers
- Realistic probability of getting past screening"""


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
    print(f"🤖 [OpenAI-Recommend] Starting with {len(profile_nodes)} nodes")

    if not openai_client:
        print(f"❌ [OpenAI-Recommend] Client not initialized")
        return {
            "success": False,
            "model": "openai-gpt-4o",
            "error": "OpenAI client not initialized. Check API key."
        }

    try:
        prompt_content = NODE_SELECTION_PROMPT.format(
            job_requirements=json.dumps(job_requirements, indent=2),
            profile_nodes=json.dumps(profile_nodes, indent=2)
        )
        prompt_length = len(prompt_content)
        print(f"📤 [OpenAI-Recommend] Sending request to GPT-4o...")
        print(f"📏 [OpenAI-Recommend] Prompt length: {prompt_length} characters ({prompt_length/1000:.1f}K)")

        import time
        request_start = time.time()

        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert CV tailoring specialist. Always respond with valid JSON."},
                {"role": "user", "content": prompt_content}
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
            timeout=180  # 180 second timeout (3 minutes)
        )

        request_duration = time.time() - request_start
        print(f"📥 [OpenAI-Recommend] Response received in {request_duration:.2f}s, parsing...")
        result = json.loads(response.choices[0].message.content)
        print(f"✅ [OpenAI-Recommend] Success! Parsed {len(result.get('selected_nodes', []))} node recommendations")
        return {
            "success": True,
            "model": "openai-gpt-4o",
            "recommendations": result
        }
    except Exception as e:
        print(f"❌ [OpenAI-Recommend] Error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "model": "openai-gpt-4o",
            "error": str(e)
        }


def recommend_nodes_with_claude(job_requirements: Dict, profile_nodes: List[Dict]) -> Dict[str, Any]:
    """Recommend which nodes to include using Claude Sonnet 4.5"""
    print(f"🤖 [Claude-Recommend] Starting with {len(profile_nodes)} nodes")

    if not anthropic_client:
        print(f"❌ [Claude-Recommend] Client not initialized")
        return {
            "success": False,
            "model": "claude-sonnet-4.5",
            "error": "Claude client not initialized. Check API key."
        }

    try:
        prompt_content = NODE_SELECTION_PROMPT.format(
            job_requirements=json.dumps(job_requirements, indent=2),
            profile_nodes=json.dumps(profile_nodes, indent=2)
        )
        prompt_length = len(prompt_content)
        print(f"📤 [Claude-Recommend] Sending request to Claude Sonnet 4...")
        print(f"📏 [Claude-Recommend] Prompt length: {prompt_length} characters ({prompt_length/1000:.1f}K)")

        import time
        request_start = time.time()

        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=8192,
            messages=[
                {"role": "user", "content": prompt_content}
            ],
            temperature=0.3,
            timeout=180.0  # 180 second timeout (3 minutes) - Claude needs more time
        )

        request_duration = time.time() - request_start
        print(f"📥 [Claude-Recommend] Response received in {request_duration:.2f}s, parsing...")
        print(f"📊 [Claude-Recommend] Response type: {type(response)}, has content: {hasattr(response, 'content')}")
        # Extract text and remove markdown code blocks if present
        text = response.content[0].text.strip()
        if text.startswith('```'):
            # Remove markdown code blocks
            lines = text.split('\n')
            # Remove first line (```json or ```) and last line (```)
            text = '\n'.join(lines[1:-1])

        result = json.loads(text)
        print(f"✅ [Claude-Recommend] Success! Parsed {len(result.get('selected_nodes', []))} node recommendations")
        return {
            "success": True,
            "model": "claude-sonnet-4.5",
            "recommendations": result
        }
    except Exception as e:
        print(f"❌ [Claude-Recommend] Error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "model": "claude-sonnet-4.5",
            "error": str(e)
        }


def flatten_nodes_for_analysis(nodes: List[Dict], parent_context: str = "") -> List[Dict]:
    """
    Flatten hierarchical nodes into a list with context for AI analysis.
    Preserves parent-child relationships in a readable format.
    ONLY includes non-empty values to reduce token usage.
    """
    flattened = []

    for node in nodes:
        context = f"{parent_context} > {node.get('title', 'Untitled')}" if parent_context else node.get('title', 'Untitled')

        # Build flat_node, only including non-empty values
        flat_node = {}

        # Always include these critical fields
        if node.get("id") is not None:
            flat_node["id"] = node["id"]
        if node.get("global_id"):
            flat_node["global_id"] = node["global_id"]
        if node.get("node_type"):
            flat_node["node_type"] = node["node_type"]

        # Only include other fields if they have meaningful values
        if node.get("title"):
            flat_node["title"] = node["title"]
        if node.get("subtitle"):
            flat_node["subtitle"] = node["subtitle"]
        if node.get("content"):
            flat_node["content"] = node["content"]
        if node.get("start_date"):
            flat_node["start_date"] = node["start_date"]
        if node.get("end_date"):
            flat_node["end_date"] = node["end_date"]
        if node.get("location"):
            flat_node["location"] = node["location"]

        # Always include level and context_path (non-empty by construction)
        flat_node["level"] = node.get("level", 0)
        flat_node["context_path"] = context

        # Only include is_visible if it's not the default True
        is_visible = node.get("is_visible", True)
        if not is_visible:
            flat_node["is_visible"] = False

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
