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
  "fit_score": <number 0-100>,
  "fit_reasoning": "Factual explanation of why this score. Be specific about what matches and what doesn't. No sugar-coating.",
  "ats_score": <number 0-100>,
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


NODE_SELECTION_PROMPT = """You are an expert CV tailoring specialist and ATS optimization consultant. Your task is to recommend which profile nodes should be INCLUDED or EXCLUDED in a tailored CV for a specific job.

Job Requirements:
{job_requirements}

Profile Nodes:
{profile_nodes}

## DECISION CRITERIA

For each node, evaluate these factors:

1. **Direct Relevance** (40% weight)
   - Does this node demonstrate skills/experience explicitly mentioned in the job requirements?
   - Does it use keywords that will improve ATS matching?
   - Does it address must-have requirements vs nice-to-haves?

2. **Impact & Achievement** (30% weight)
   - Does it show measurable results, leadership, or significant contributions?
   - Does it demonstrate progression or mastery in relevant areas?
   - Will it differentiate the candidate from other applicants?

3. **Recency & Context** (20% weight)
   - Is this recent experience (more valuable) or outdated (less valuable)?
   - Does it fit the seniority level of the target role?
   - Does it support the narrative for this specific career direction?

4. **Space Efficiency** (10% weight)
   - Does this node add unique value or is it redundant?
   - Is it concise or verbose relative to its importance?

## CONFIDENCE SCALE DEFINITION

Use this scale to rate your confidence in each inclusion/exclusion decision:

**0.0 - 0.3: WEAK** - Marginal relevance or uncertain value
- Example: A 10-year-old technology that's tangentially related
- Example: A soft skill mentioned once in the job description
- Decision: Usually EXCLUDE unless filling space

**0.3 - 0.5: LOW-MODERATE** - Some relevance but not core to the role
- Example: Adjacent technical skills that show adaptability
- Example: Leadership experience when job emphasizes technical depth
- Decision: INCLUDE if space allows and supports narrative

**0.5 - 0.7: MODERATE-HIGH** - Clear relevance to job requirements
- Example: Required skill demonstrated in older role
- Example: Similar industry/domain experience
- Decision: Usually INCLUDE, forms the supporting content

**0.7 - 0.9: HIGH** - Strong alignment with key requirements
- Example: Direct experience with primary technologies listed
- Example: Exact role type or responsibility mentioned in job
- Decision: Definitely INCLUDE, core CV content

**0.9 - 1.0: CRITICAL** - Perfect match, must-have for this application
- Example: Exact same job title with matching responsibilities
- Example: Rare/specialized skill that's explicitly required
- Decision: MUST INCLUDE, highlights of the CV

## DECISION THRESHOLDS

- **confidence >= 0.85**: MUST INCLUDE - Critical match, forms the core narrative
- **confidence >= 0.60**: SHOULD INCLUDE - Strong relevance, keep unless CV is too long
- **confidence >= 0.40**: MAYBE INCLUDE - Moderate relevance, include if space allows
- **confidence < 0.40**: SHOULD EXCLUDE - Weak relevance, dilutes the focused message

## TAILORING STRATEGY GUIDELINES

- **Aim for focused, not exhaustive**: A tailored CV should be 70-85% of the full profile
- **Quality over quantity**: Better to have 15 highly relevant points than 30 mixed ones
- **Target 1-2 pages**: Recommend INCLUDE count that fits this constraint
- **Prioritize recent**: Weight recent experience higher unless older experience is uniquely relevant
- **Maintain narrative coherence**: Include nodes that tell a consistent story for THIS role

## CALIBRATION EXAMPLES

**Example 1: Software Engineer Role**
- Node: "Led migration of legacy Java monolith to microservices architecture, reducing latency by 60%"
- Job requires: "Experience with microservices, Java, performance optimization"
- Confidence: 0.95 (HIGH-CRITICAL) - Direct match with quantified achievement
- Decision: INCLUDE

**Example 2: Software Engineer Role**
- Node: "Volunteered as coding instructor for high school students"
- Job requires: "Strong technical skills, team collaboration"
- Confidence: 0.35 (LOW-MODERATE) - Shows soft skills but not core technical requirement
- Decision: EXCLUDE (unless applying to education-tech or culture-focused company)

**Example 3: Senior Data Scientist Role**
- Node: "Built Python scripts for data cleaning and preprocessing"
- Job requires: "Expert in ML model development, Python, statistical analysis"
- Confidence: 0.55 (MODERATE-HIGH) - Relevant skill but doesn't show seniority/depth
- Decision: INCLUDE if no stronger Python/data examples exist, otherwise EXCLUDE

**Example 4: Product Manager Role**
- Node: "Shipped 3 major features with 95% on-time delivery, coordinating 12 engineers"
- Job requires: "Technical product management, cross-functional leadership"
- Confidence: 0.88 (HIGH) - Strong match on leadership and delivery metrics
- Decision: INCLUDE

## OUTPUT FORMAT

Return JSON with node IDs and selection status:
{{
  "selected_nodes": [
    {{
      "id": 123,
      "include": true,
      "confidence": 0.95,
      "reason": "Critical match - demonstrates exact required skill X with quantified impact. Direct keyword match for ATS. Recent experience at target seniority level.",
      "relevance_tags": ["primary_requirement", "ats_keyword", "quantified_achievement"]
    }},
    {{
      "id": 124,
      "include": false,
      "confidence": 0.25,
      "reason": "Outdated technology (10 years old) not mentioned in job requirements. No transferable skills to current role focus. Would dilute focused narrative.",
      "relevance_tags": ["outdated", "low_relevance"]
    }},
    ...
  ],
  "selection_summary": {{
    "total_nodes": 50,
    "recommended_include": 35,
    "recommended_exclude": 15,
    "expected_cv_length": "1.5 pages",
    "tailoring_percentage": "70%"
  }},
  "tailoring_strategy": "Focus on recent microservices and cloud architecture experience (last 5 years) which directly matches 8 of 10 key requirements. Exclude early-career frontend work and non-technical roles to maintain senior backend engineer positioning. Emphasize leadership and scale achievements to match senior-level expectations."
}}

## IMPORTANT REMINDERS

- Use the "id" field from each node (this is the database primary key) - use it EXACTLY as provided
- Return recommendations for ALL nodes provided (every single one)
- Be decisive: Don't give everything 0.5 confidence - use the full scale
- Provide specific, actionable reasons (not generic statements)
- Consider ATS optimization: keyword matching is critical for getting past automated screening
- Think holistically: Does the set of included nodes tell a compelling, focused story?
"""


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
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[
                {"role": "user", "content": JOB_ANALYSIS_PROMPT.format(job_description=job_description)}
            ],
            temperature=0.3
        )

        if not response.content or len(response.content) == 0:
            raise ValueError("Claude returned empty content")

        # Extract text and remove markdown code blocks if present
        text = response.content[0].text.strip()

        if text.startswith('```'):
            # Remove markdown code blocks
            lines = text.split('\n')
            # Remove first line (```json or ```) and last line (```)
            if len(lines) > 2:
                text = '\n'.join(lines[1:-1])
            else:
                raise ValueError(f"Invalid markdown format: only {len(lines)} lines")

        # Sometimes Claude adds explanatory text after the JSON - extract only the JSON
        # Find the last closing brace
        last_brace = text.rfind('}')
        if last_brace != -1:
            text = text[:last_brace + 1]

        result = json.loads(text)
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
        if not response.content or len(response.content) == 0:
            raise ValueError("Claude returned empty content")

        text = response.content[0].text.strip()
        print(f"📝 [Claude-Recommend] Raw text length: {len(text)} chars")
        print(f"📝 [Claude-Recommend] First 200 chars: {text[:200]}")

        if not text:
            raise ValueError("Claude returned empty text response")

        if text.startswith('```'):
            # Remove markdown code blocks
            lines = text.split('\n')
            # Remove first line (```json or ```) and last line (```)
            if len(lines) > 2:
                text = '\n'.join(lines[1:-1])
            else:
                # If only 2 lines, there's no content - something is wrong
                raise ValueError(f"Invalid markdown format: only {len(lines)} lines")
            print(f"📝 [Claude-Recommend] After removing markdown: {len(text)} chars")

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
    Flatten hierarchical nodes into a minimal list for AI analysis.
    ONLY includes: id (primary key) and content fields (title, subtitle, content, dates, location).
    Removes: global_id, node_type, level, context_path, is_visible.
    This reduces token usage by ~30-40% while keeping all essential content.
    """
    flattened = []

    for node in nodes:
        # Build minimal flat_node with only essential fields
        flat_node = {}

        # ALWAYS include id (primary key - absolutely unique identifier)
        if node.get("id") is not None:
            flat_node["id"] = node["id"]

        # Only include content fields if they have meaningful values
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

        flattened.append(flat_node)

        # Recursively process children
        # Build context for readability (used in recursion but not sent to AI)
        context = f"{parent_context} > {node.get('title', 'Untitled')}" if parent_context else node.get('title', 'Untitled')
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
