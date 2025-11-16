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


def sanitize_unicode_for_pdf(text: str) -> str:
    """
    Sanitize Unicode characters from AI-generated text to prevent PDF encoding errors.
    Replaces smart quotes, en-dashes, and other Unicode with ASCII equivalents.
    """
    if not text:
        return text

    replacements = {
        '\u2013': '-',      # EN DASH
        '\u2014': '--',     # EM DASH
        '\u2018': "'",      # LEFT SINGLE QUOTATION MARK
        '\u2019': "'",      # RIGHT SINGLE QUOTATION MARK
        '\u201c': '"',      # LEFT DOUBLE QUOTATION MARK
        '\u201d': '"',      # RIGHT DOUBLE QUOTATION MARK
        '\u2022': '*',      # BULLET
        '\u2026': '...',    # HORIZONTAL ELLIPSIS
        '\u00a0': ' ',      # NON-BREAKING SPACE
        '\u2212': '-',      # MINUS SIGN
    }

    for unicode_char, replacement in replacements.items():
        text = text.replace(unicode_char, replacement)

    # Remove any remaining characters outside latin-1 range
    cleaned_chars = []
    for char in text:
        if ord(char) <= 255:
            cleaned_chars.append(char)
        else:
            # Skip or replace with safe character
            pass

    return ''.join(cleaned_chars)

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


SCORING_PROMPT = """You are a brutally honest technical recruiter and career advisor with 15+ years of experience in technical hiring and ATS systems. Analyze this candidate profile against the job requirements with critical precision. Your goal is to save the candidate's time by being factual, direct, and realistic about their chances.

Job Requirements:
{job_requirements}

Candidate Profile:
{profile_content}

## SCORING METHODOLOGY

### FIT SCORE (0-100): Overall Match Quality

Evaluate how well the candidate matches the role requirements using these weighted components:

**Component Breakdown:**
1. **Must-Have Requirements** (50% of fit_score)
   - Count how many critical/required skills the candidate has
   - Full match = 50 points, partial match = 25 points, no match = 0 points

2. **Nice-to-Have Requirements** (20% of fit_score)
   - Bonus points for additional desired skills
   - Shows versatility and growth potential

3. **Experience Level Alignment** (15% of fit_score)
   - Does the candidate's seniority match the role level?
   - Overqualified, underqualified, or just right?

4. **Domain/Industry Knowledge** (15% of fit_score)
   - Relevant industry experience
   - Domain-specific expertise

**Fit Score Scale:**
- **90-100: EXCEPTIONAL** - Rare perfect match. Candidate exceeds requirements in multiple areas. Strong hire signal.
  - Example: 9/10 must-haves + 80% nice-to-haves + perfect seniority match + deep domain expertise

- **75-89: STRONG FIT** - Excellent match. Candidate meets all or nearly all key requirements. High interview probability.
  - Example: 8/10 must-haves + 50% nice-to-haves + good seniority match + some domain knowledge

- **60-74: GOOD FIT** - Solid match. Candidate meets most important requirements with minor gaps. Reasonable chance.
  - Example: 6-7/10 must-haves + 30% nice-to-haves + acceptable seniority + transferable experience

- **45-59: MODERATE/MARGINAL** - Meets baseline but significant gaps exist. Long shot but not impossible.
  - Example: 5/10 must-haves + few nice-to-haves + some seniority mismatch + limited domain knowledge

- **30-44: BELOW AVERAGE** - Missing several key requirements. Low probability of success. Consider only if desperate.
  - Example: 3-4/10 must-haves + minimal nice-to-haves + wrong seniority level + unrelated background

- **0-29: POOR FIT** - Major gaps in core requirements. Very unlikely to pass screening. Not recommended.
  - Example: <3/10 must-haves + major skill gaps + significant experience mismatch

### ATS SCORE (0-100): Automated Screening Compatibility

Evaluate the likelihood of passing automated applicant tracking systems:

**ATS Scoring Factors:**
1. **Keyword Matching** (40% of ats_score)
   - Count exact keyword matches from job description in candidate profile
   - Include: technologies, tools, methodologies, certifications, job titles
   - Exact match > semantic match > missing

2. **Experience Format** (25% of ats_score)
   - Clear job titles, dates, company names
   - Quantified achievements and metrics
   - Proper role descriptions

3. **Education & Certifications** (20% of ats_score)
   - Required degrees present and clearly stated
   - Relevant certifications mentioned
   - Proper formatting of credentials

4. **Recency & Relevance** (15% of ats_score)
   - Recent experience with required technologies
   - Current/recent job titles matching target role
   - No large unexplained gaps

**ATS Score Scale:**
- **85-100: EXCELLENT** - Will definitely pass ATS. Strong keyword density, perfect format, all checkboxes ticked.
  - Example: 90%+ keyword matches, all required credentials, recent relevant experience

- **70-84: GOOD** - Likely to pass ATS. Most keywords present, good format, minor gaps acceptable.
  - Example: 70-80% keyword matches, most credentials, well-formatted experience

- **55-69: MODERATE** - May pass ATS but not guaranteed. Missing some keywords or format issues.
  - Example: 50-60% keyword matches, some credentials missing, experience less clear

- **40-54: BELOW AVERAGE** - Low probability of passing ATS. Significant keyword gaps or format problems.
  - Example: <50% keyword matches, missing key credentials, poor formatting

- **0-39: POOR** - Very unlikely to pass ATS. Major keyword mismatches, missing critical requirements.
  - Example: <30% keyword matches, no required credentials, incompatible format

## VERDICT DECISION LOGIC

Use this decision matrix based on both scores:

**SHOULD_APPLY** - Recommend proceeding with application:
- fit_score >= 70 AND ats_score >= 60, OR
- fit_score >= 80 (even if ATS is 50-59, worth trying), OR
- fit_score >= 65 AND ats_score >= 75 (great ATS optimization can compensate)

**CONSIDER_APPLYING** - On the fence, depends on candidate's risk tolerance:
- fit_score 55-69 AND ats_score 55-74, OR
- fit_score >= 60 AND ats_score 45-59 (fit is there but ATS is risky), OR
- fit_score 45-59 AND ats_score >= 70 (might get through ATS, then interview skill matters)

**SHOULD_NOT_APPLY** - Not recommended, low probability of success:
- fit_score < 55 AND ats_score < 55, OR
- fit_score < 45 (regardless of ATS), OR
- ats_score < 40 AND fit_score < 70 (won't get past screening)

## CALIBRATION EXAMPLES

**Example 1: Senior Backend Engineer Position**
- Job requires: "5+ years Python, microservices, AWS, Kubernetes, SQL, team leadership"
- Candidate has: 6 years Python, 4 years microservices, 3 years AWS, Kubernetes expert, PostgreSQL, led team of 5
- Must-haves: 5/6 (missing nothing critical)
- Nice-to-haves: Has CI/CD, Docker, Redis (bonus)
- Fit Score: 87 (STRONG FIT)
- ATS Score: 92 (EXCELLENT - all keywords present)
- Verdict: SHOULD_APPLY

**Example 2: Data Scientist Role**
- Job requires: "PhD in CS/Stats, 3+ years ML, Python, TensorFlow, NLP, published research"
- Candidate has: MS in CS (not PhD), 2 years ML, Python expert, PyTorch (not TensorFlow), no NLP, 1 blog post
- Must-haves: 2/6 (missing PhD, insufficient years, wrong framework, no NLP, no publications)
- Fit Score: 38 (BELOW AVERAGE)
- ATS Score: 45 (BELOW AVERAGE - missing key keywords: PhD, TensorFlow, NLP, publications)
- Verdict: SHOULD_NOT_APPLY

**Example 3: Full Stack Developer**
- Job requires: "React, Node.js, TypeScript, REST APIs, MongoDB, 3+ years"
- Candidate has: React (4 years), Node.js (3 years), JavaScript (not TypeScript), REST APIs, MySQL (not MongoDB), 4 years total
- Must-haves: 4/6 (has similar tech but not exact matches)
- Fit Score: 68 (GOOD FIT - close enough, transferable skills)
- ATS Score: 58 (MODERATE - missing exact keywords TypeScript, MongoDB)
- Verdict: CONSIDER_APPLYING (fit is decent, could mention willingness to learn TypeScript/MongoDB in cover letter)

**Example 4: Junior Product Manager**
- Job requires: "1-2 years PM experience, user research, roadmap planning, SQL, analytics tools"
- Candidate has: 3 years as Product Analyst (not PM), extensive user research, data analysis, SQL expert, Tableau/Mixpanel
- Must-haves: 4/5 (related role, has most skills)
- Fit Score: 72 (GOOD FIT - related experience counts)
- ATS Score: 78 (GOOD - keywords present, though job title differs)
- Verdict: SHOULD_APPLY (analyst-to-PM transition is common)

## OUTPUT FORMAT

Return JSON:
{{
  "fit_score": <number 0-100>,
  "fit_reasoning": "Detailed explanation with specific component breakdown. State exactly what matches and what doesn't. Reference the scoring methodology. Example: 'Must-haves: 7/10 (has Python, AWS, React but missing Kubernetes, GraphQL, TypeScript) = 35/50 points. Nice-to-haves: 3/5 = 12/20 points. Experience: Senior level matches = 15/15 points. Domain: fintech background relevant = 12/15 points. Total: 74/100.'",

  "ats_score": <number 0-100>,
  "ats_reasoning": "Specific explanation with keyword analysis. Example: 'Keywords: 18/25 matches (72%). Has exact matches for Python, AWS, microservices, Docker, CI/CD. Missing: Kubernetes, Terraform, Golang. Education: BS in CS present = full points. Format: well-structured with dates and metrics = strong. Recency: all required tech used in last 2 years = excellent. Total: 78/100.'",

  "verdict": "SHOULD_APPLY or CONSIDER_APPLYING or SHOULD_NOT_APPLY",

  "verdict_reasoning": "Clear, direct explanation using the decision matrix. Example: 'fit_score=74 and ats_score=78 both exceed thresholds (70/60). Strong match on core requirements with good keyword density. Recommend applying. Estimated interview probability: 60-70% if application is well-tailored.'",

  "strengths": [
    "Specific strength with evidence and impact. Example: 'Expert in Python with 6 years experience including advanced async programming - exceeds job requirement of 3 years'",
    "Leadership experience managing team of 8 engineers - demonstrates readiness for senior role",
    ...
  ],

  "missing_skills": [
    "Skill required by job but absent from profile. Be specific. Example: 'Kubernetes - listed as required, no evidence in profile'",
    "TypeScript - job requires, candidate only shows JavaScript experience",
    ...
  ],

  "critical_gaps": [
    "Deal-breaker gaps with severity assessment. Example: 'PhD required but candidate has MS - may be automatic disqualification depending on how strict requirement is'",
    "No machine learning experience - this is 60% of the role and cannot be learned quickly",
    ...
  ],

  "matching_skills": [
    "Skills with direct evidence. Example: 'Python (6 years, advanced) - EXACT MATCH'",
    "AWS (4 years, certified) - EXACT MATCH",
    "Microservices architecture (designed 3 systems) - EXACT MATCH",
    ...
  ],

  "recommendations": [
    "Actionable, specific recommendation. Example: 'Highlight Kubernetes experience more prominently if you have any, even from side projects or learning'",
    "Emphasize the 60% latency improvement achievement - quantified results stand out",
    "Consider taking a TypeScript crash course and adding a small project to show learning agility",
    ...
  ]
}}

## IMPORTANT GUIDELINES

- **Be mathematically precise**: Show your scoring calculation, don't just guess numbers
- **Be specific, not generic**: "Has Python" is weak. "6 years Python including async, FastAPI, pytest" is strong
- **No sugar-coating**: If it's a poor fit, say so directly and explain why
- **Consider context**: Junior vs Senior roles have different standards
- **ATS reality check**: Many great candidates get filtered by ATS - be realistic about keyword gaps
- **Provide hope when appropriate**: If score is marginal, suggest how to improve chances
- **Be decisive**: Don't waffle. Use the full scale (not everything is 65-75)
- **Think like a recruiter**: What would make YOU excited to interview this person? What would make you pass?

Focus on:
- Exact skill matches vs. missing requirements (with counts)
- Experience level alignment (over/under/right-qualified)
- Technical depth in required areas (beginner/intermediate/expert)
- Red flags or deal-breakers (hard requirements, cultural mismatch)
- Realistic probability of getting past screening (percentage estimate if possible)
"""


NODE_SELECTION_PROMPT = """You are an expert CV tailoring specialist and ATS optimization consultant. Your task is to recommend which profile nodes should be INCLUDED or EXCLUDED in a tailored CV for a specific job.

Job Requirements:
{job_requirements}

Profile Nodes:
{profile_nodes}

## CRITICAL: KEYWORD MATCHING STRATEGY

Before evaluating nodes, carefully extract ALL technical skills, tools, technologies, and keywords from the job requirements. For EACH keyword:

1. **Look for EXACT matches** - Same word/phrase (e.g., "Spark" matches "Spark")
2. **Look for VARIANTS** - Related forms (e.g., "Spark" matches "Apache Spark", "PySpark", "Spark SQL")
3. **Look for SEMANTIC matches** - Related concepts (e.g., "Spark" relates to "distributed computing", "big data processing", "Hadoop ecosystem")
4. **Look for CONTEXTUAL evidence** - Implied usage (e.g., "processed 10TB datasets" implies big data tools like Spark)

**IMPORTANT**: Even if a node doesn't use the EXACT keyword, if it demonstrates the same capability or uses related technologies, it should be considered highly relevant.

Examples of keyword matching:
- Job requires "Spark" → MATCH nodes with: "Spark", "PySpark", "Apache Spark", "Spark SQL", "Spark Streaming", "distributed data processing", "big data frameworks"
- Job requires "machine learning" → MATCH nodes with: "ML", "machine learning", "predictive modeling", "scikit-learn", "TensorFlow", "model training"
- Job requires "cloud" → MATCH nodes with: "AWS", "Azure", "GCP", "cloud infrastructure", "cloud-native", "containerization"

## DECISION CRITERIA

For each node, evaluate these factors:

1. **Direct Relevance** (40% weight)
   - Does this node demonstrate skills/experience explicitly OR implicitly mentioned in the job requirements?
   - Does it use exact keywords, variants, or semantically related terms that will improve ATS matching?
   - Does it address must-have requirements vs nice-to-haves?
   - CHECK THOROUGHLY: Read the entire node content, not just the title - relevant keywords may be buried in descriptions

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

**Example 1: Software Engineer Role (Exact Match)**
- Node: "Led migration of legacy Java monolith to microservices architecture, reducing latency by 60%"
- Job requires: "Experience with microservices, Java, performance optimization"
- Confidence: 0.95 (HIGH-CRITICAL) - Direct exact match with quantified achievement
- Decision: INCLUDE
- Reasoning: Contains exact keywords "microservices", "Java", and demonstrates "performance optimization" with metrics

**Example 2: Data Engineer Role (Semantic Match - IMPORTANT)**
- Node: "Built distributed data pipelines processing 10TB daily using PySpark and Hadoop"
- Job requires: "Spark, big data processing, ETL pipelines"
- Confidence: 0.92 (HIGH-CRITICAL) - Strong semantic match even though "Spark" isn't exact
- Decision: INCLUDE
- Reasoning: "PySpark" is a variant of "Spark", "10TB daily" demonstrates "big data", "pipelines" matches "ETL pipelines"

**Example 3: Data Scientist Role (Variant Match)**
- Node: "Developed ML models using scikit-learn and TensorFlow for customer churn prediction"
- Job requires: "machine learning, predictive modeling, Python"
- Confidence: 0.90 (HIGH) - Excellent match with variants and related terms
- Decision: INCLUDE
- Reasoning: "ML" is variant of "machine learning", "churn prediction" is example of "predictive modeling", libraries imply Python

**Example 4: Software Engineer Role (Contextual Evidence)**
- Node: "Processed large-scale datasets with distributed computing frameworks, optimizing query performance by 3x"
- Job requires: "Spark, data processing, performance tuning"
- Confidence: 0.75 (HIGH) - Strong contextual match
- Decision: INCLUDE
- Reasoning: "distributed computing frameworks" likely includes Spark, "large-scale datasets" = data processing, "3x performance" = tuning

**Example 5: Software Engineer Role (Weak Relevance)**
- Node: "Volunteered as coding instructor for high school students"
- Job requires: "Strong technical skills, team collaboration"
- Confidence: 0.35 (LOW-MODERATE) - Shows soft skills but not core technical requirement
- Decision: EXCLUDE (unless applying to education-tech or culture-focused company)

**Example 6: Senior Data Scientist Role (Insufficient Depth)**
- Node: "Built Python scripts for data cleaning and preprocessing"
- Job requires: "Expert in ML model development, Python, statistical analysis"
- Confidence: 0.55 (MODERATE-HIGH) - Relevant skill but doesn't show seniority/depth
- Decision: INCLUDE if no stronger Python/data examples exist, otherwise EXCLUDE

**Example 7: Product Manager Role (Exact Match)**
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

- **CRITICAL**: Use semantic and variant matching! If job requires "Spark", INCLUDE nodes with "PySpark", "Apache Spark", "distributed computing", etc.
- **READ THOROUGHLY**: Don't just scan titles - read the full content of each node for hidden keywords and relevant experience
- Use the "id" field from each node (this is the database primary key) - use it EXACTLY as provided
- Return recommendations for ALL nodes provided (every single one)
- Be decisive: Don't give everything 0.5 confidence - use the full scale (0.0-1.0)
- For technical skills, be GENEROUS with semantic matching - variants and related technologies should score high
- Provide specific, actionable reasons (not generic statements)
- Consider ATS optimization: exact keywords are best, but variants and semantic matches are also valuable
- Think holistically: Does the set of included nodes tell a compelling, focused story?
- When in doubt about relevance, INCLUDE rather than EXCLUDE - better to have related experience than gaps

## WORKFLOW

1. First, extract ALL keywords and requirements from the job description
2. For each keyword, identify exact matches, variants, and semantic equivalents
3. Read EVERY node completely (title, subtitle, content, dates, location)
4. Mark matches based on exact/variant/semantic/contextual criteria
5. Assign confidence scores based on match quality and other factors
6. Write specific reasoning explaining the match type and relevance
"""


def analyze_job_with_openai(job_description: str) -> Dict[str, Any]:
    """Analyze job description using OpenAI GPT-5.1"""
    if not openai_client:
        return {
            "success": False,
            "model": "openai-gpt-4o",
            "error": "OpenAI client not initialized. Check API key."
        }

    try:
        # Build the exact prompt that will be sent
        user_prompt = JOB_ANALYSIS_PROMPT.format(job_description=job_description)

        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert job requirement analyst. Always respond with valid JSON."},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)
        return {
            "success": True,
            "model": "openai-gpt-4o",
            "analysis": result,
            "prompt_sent": user_prompt  # Include the exact prompt sent
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
        # Build the exact prompt that will be sent
        user_prompt = JOB_ANALYSIS_PROMPT.format(job_description=job_description)

        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[
                {"role": "user", "content": user_prompt}
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
            "analysis": result,
            "prompt_sent": user_prompt  # Include the exact prompt sent
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
    """Score profile fit using OpenAI GPT-5.1"""
    if not openai_client:
        return {
            "success": False,
            "model": "openai-gpt-4o",
            "error": "OpenAI client not initialized. Check API key."
        }

    try:
        # Build the exact prompt that will be sent
        user_prompt = SCORING_PROMPT.format(
            job_requirements=json.dumps(job_requirements, indent=2),
            profile_content=profile_content
        )

        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert recruiter and ATS specialist. Always respond with valid JSON."},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)
        return {
            "success": True,
            "model": "openai-gpt-4o",
            "scores": result,
            "prompt_sent": user_prompt  # Include the exact prompt sent
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
        # Build the exact prompt that will be sent
        user_prompt = SCORING_PROMPT.format(
            job_requirements=json.dumps(job_requirements, indent=2),
            profile_content=profile_content
        )

        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[
                {"role": "user", "content": user_prompt}
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
            "scores": result,
            "prompt_sent": user_prompt  # Include the exact prompt sent
        }
    except Exception as e:
        return {
            "success": False,
            "model": "claude-sonnet-4.5",
            "error": str(e)
        }


def recommend_nodes_with_openai(job_requirements: Dict, profile_nodes: List[Dict]) -> Dict[str, Any]:
    """Recommend which nodes to include using OpenAI GPT-5.1"""
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
        print(f"📤 [OpenAI-Recommend] Sending request to GPT-5.1...")
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
            "recommendations": result,
            "prompt_sent": prompt_content  # Include the exact prompt sent
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
            max_tokens=16384,  # Increased from 8192 to handle larger responses with many nodes
            system="You are an expert CV tailoring specialist. You must respond with ONLY valid JSON, no additional text or explanation before or after the JSON. Ensure your JSON is properly formatted with no trailing commas, all strings properly quoted, and all braces/brackets balanced.",
            messages=[
                {"role": "user", "content": prompt_content}
            ],
            temperature=0.3,
            timeout=180.0  # 180 second timeout (3 minutes) - Claude needs more time
        )

        request_duration = time.time() - request_start
        print(f"📥 [Claude-Recommend] Response received in {request_duration:.2f}s, parsing...")
        print(f"📊 [Claude-Recommend] Response type: {type(response)}, has content: {hasattr(response, 'content')}")

        # Check if response was cut off due to token limit
        if hasattr(response, 'stop_reason'):
            print(f"⚠️ [Claude-Recommend] Stop reason: {response.stop_reason}")
            if response.stop_reason == "max_tokens":
                print(f"⚠️ [Claude-Recommend] WARNING: Response hit max_tokens limit and may be incomplete!")

        # Check token usage if available
        if hasattr(response, 'usage'):
            print(f"📊 [Claude-Recommend] Token usage: {response.usage}")

        # Extract text and remove markdown code blocks if present
        if not response.content or len(response.content) == 0:
            raise ValueError("Claude returned empty content")

        text = response.content[0].text.strip()
        print(f"📝 [Claude-Recommend] Raw text length: {len(text)} chars")
        print(f"📝 [Claude-Recommend] First 200 chars: {text[:200]}")

        if not text:
            raise ValueError("Claude returned empty text response")

        # Try to extract JSON from the response
        json_text = text

        # Remove markdown code blocks if present
        if text.startswith('```'):
            lines = text.split('\n')
            if len(lines) > 2:
                json_text = '\n'.join(lines[1:-1])
            else:
                raise ValueError(f"Invalid markdown format: only {len(lines)} lines")
            print(f"📝 [Claude-Recommend] After removing markdown: {len(json_text)} chars")

        # If text doesn't start with '{', try to find the JSON object
        if not json_text.lstrip().startswith('{'):
            print(f"⚠️ [Claude-Recommend] Response doesn't start with JSON, attempting to extract...")
            # Look for the first '{' and last '}'
            start_idx = json_text.find('{')
            end_idx = json_text.rfind('}')
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                json_text = json_text[start_idx:end_idx+1]
                print(f"📝 [Claude-Recommend] Extracted JSON portion: {len(json_text)} chars")
            else:
                raise ValueError("Could not find JSON object in response")

        # Try to parse JSON
        try:
            result = json.loads(json_text)
        except json.JSONDecodeError as json_error:
            # JSON is malformed - try to fix common issues
            print(f"⚠️ [Claude-Recommend] JSONDecodeError: {str(json_error)}")
            print(f"📝 [Claude-Recommend] Attempting to repair JSON...")

            # Save the malformed JSON for debugging
            import os
            debug_dir = os.path.join(os.path.dirname(__file__), "debug_logs")
            os.makedirs(debug_dir, exist_ok=True)
            debug_file = os.path.join(debug_dir, f"claude_malformed_{int(time.time())}.json")
            with open(debug_file, "w", encoding="utf-8") as f:
                f.write(json_text)
            print(f"💾 [Claude-Recommend] Saved malformed JSON to {debug_file}")

            # Try to fix common JSON errors
            import re
            fixed_text = json_text

            # Step 1: Remove trailing commas before } or ]
            fixed_text = re.sub(r',(\s*[}\]])', r'\1', fixed_text)

            # Step 2: Fix single quotes around property names (but not inside string values)
            # This regex finds patterns like 'property': and replaces with "property":
            fixed_text = re.sub(r"'([^'\"]+)'(\s*:)", r'"\1"\2', fixed_text)

            # Step 3: Fix missing quotes around property names
            # Pattern: word followed by colon (not already quoted)
            fixed_text = re.sub(r'([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)', r'\1"\2"\3', fixed_text)

            # Step 4: Remove control characters that might break JSON
            fixed_text = re.sub(r'[\x00-\x1f\x7f]', '', fixed_text)

            # Step 5: Fix incomplete JSON (missing closing braces)
            # Count opening and closing braces
            open_braces = fixed_text.count('{')
            close_braces = fixed_text.count('}')
            if open_braces > close_braces:
                print(f"⚠️ [Claude-Recommend] Incomplete JSON detected: {open_braces} {{ but only {close_braces} }}")
                fixed_text += '}' * (open_braces - close_braces)
                print(f"📝 [Claude-Recommend] Added {open_braces - close_braces} closing braces")

            # Try parsing the repaired JSON
            try:
                result = json.loads(fixed_text)
                print(f"✅ [Claude-Recommend] Successfully repaired JSON!")

                # Save the repaired version for comparison
                repair_file = os.path.join(debug_dir, f"claude_repaired_{int(time.time())}.json")
                with open(repair_file, "w", encoding="utf-8") as f:
                    f.write(fixed_text)
                print(f"💾 [Claude-Recommend] Saved repaired JSON to {repair_file}")

            except json.JSONDecodeError as second_error:
                # Still can't parse - give up and return error
                print(f"❌ [Claude-Recommend] JSON repair failed: {str(second_error)}")
                print(f"📝 [Claude-Recommend] Error location: line {second_error.lineno}, col {second_error.colno}")

                # Try to show the problematic section
                lines = fixed_text.split('\n')
                if second_error.lineno <= len(lines):
                    error_line = lines[second_error.lineno - 1]
                    print(f"❌ [Claude-Recommend] Problematic line: {error_line[:200]}")

                raise ValueError(f"Claude returned invalid JSON that couldn't be repaired. Error: {str(json_error)}. Debug file: {debug_file}")

        print(f"✅ [Claude-Recommend] Success! Parsed {len(result.get('selected_nodes', []))} node recommendations")
        return {
            "success": True,
            "model": "claude-sonnet-4.5",
            "recommendations": result,
            "prompt_sent": prompt_content  # Include the exact prompt sent
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


def refine_section_content_with_openai(section_content: str, full_cv_content: str, job_description: str, user_instructions: str = None) -> Dict[str, Any]:
    """
    Refine a section's content using OpenAI GPT-4o-mini (fast and cheap).

    Args:
        section_content: Markdown content of the specific section to refine
        full_cv_content: Markdown content of the entire CV (all selected sections) for context
        job_description: The job description for context
        user_instructions: Optional user instructions for refinement

    Returns:
        Dict with refined_content, changes_summary, stats, and prompt_sent
    """
    if not openai_client:
        return {
            "success": False,
            "error": "OpenAI client not initialized",
            "model": "gpt-5.1"
        }

    # Build the refinement prompt with full CV context
    refinement_prompt = f"""I will paste:
1) The full tailored CV content (all selected sections and their children)
2) A job description
3) A specific CV section to refine

You are a senior hiring manager and CV editor.

Your job:
Apply VERY light-touch editing to the SECTION ONLY to make it as strong a fit as possible for THIS specific role, while strictly respecting the constraints below AND reducing length by merging/removing redundancies.

Important context rules:
- Treat the FULL CV content as the source of truth about my background.
- You may assume any information that appears anywhere in the full CV when deciding what is redundant or low-priority in this section.
- However, you may NOT invent new responsibilities, achievements, technologies, or domains that are not present somewhere in the full CV.
- You are only allowed to refine, merge, shorten, re-order, and lightly rephrase the SECTION TO REFINE.

Hard constraints (must follow all):
- Do NOT add or invent any new responsibilities, achievements, technologies, or domains beyond what appears in the full CV.
- You may only use information that is already there in the full CV, possibly rephrased or reordered.
- You may MERGE redundant bullets and REMOVE low-impact or less relevant items. Prefer fewer, denser bullets over many similar ones.
- You may do small wording adjustments to improve clarity, flow, and alignment with the job description.
- You may introduce job-description keywords ONLY when they accurately describe something already present in the full CV (e.g., rephrasing "vector search on embeddings" as "retrieval system with vector indexes" is acceptable if the CV clearly supports it).
- Do NOT exaggerate scope, impact, seniority, or team size beyond what the CV clearly implies.
- Do NOT introduce generic AI-sounding fluff or buzzwords. Keep language human, grounded, and concrete.
- Keep the tone humble but confident, and professional.
- Do NOT move content from this section into other sections or vice versa; you are only editing this section's text.
- Preserve the section heading and general structure (e.g., role title, company, dates); you may reorder bullets inside the section for relevance.

Length & compression rules:
- Actively shorten this section while preserving all major signals that are relevant to this specific role.
- Merge bullets wherever two or more bullets express related ideas that can be combined without losing important information.
- It is encouraged to drop or heavily compress bullets that are clearly low-relevance for this role or duplicative of stronger bullets already in this section or elsewhere in the CV.
- Aim for a noticeable reduction in total characters and bullet count in this section, but do NOT remove unique, high-value content that clearly matches the job description or is important to my profile.

ATS / job-fit optimization rules:
- Prioritize and, if needed, slightly rephrase bullets so they align with the MUST-HAVE parts of the job description.
- Make sure important skills from the full CV that match the job description (e.g., leadership, ML/LLM, MLOps, experimentation, cloud, stakeholder management, product ownership) are easy to spot in this section and use wording that an ATS and a human recruiter will both recognize.
- Preserve tense consistency and a clean, readable Markdown format.

{f"Additional user instructions: {user_instructions}" if user_instructions else ""}

Output format (important):
Return ONLY a JSON object with this exact structure:

{{
  "refined_content": "The improved SECTION ONLY in markdown format with bullets, ready to paste back into my CV",
  "changes_summary": "2-4 sentences summarizing the main edits you made (e.g., merged redundant bullets, tightened wording, reordered for relevance, removed low-relevance items). Do NOT mention the job description explicitly here.",
  "stats": {{
    "original_character_count_estimate": <integer count of characters in the original section>,
    "refined_character_count_estimate": <integer count of characters in the refined section>,
    "characters_reduced_estimate": <original minus refined>,
    "original_bullet_count_estimate": <integer count of bullets in the original section>,
    "refined_bullet_count_estimate": <integer count of bullets in the refined section>,
    "bullets_removed_or_merged_estimate": <original minus refined, or your best estimate>
  }}
}}

Fill in the numeric stats fields with your best estimates based on the SECTION text.

Now I will provide:

FULL CV Content (for context, do NOT rewrite this as a whole):
{full_cv_content}

Job Description (for relevance context):
{job_description}

SECTION TO REFINE (this is the ONLY part you should rewrite):
{section_content}

Remember: Return ONLY the JSON object, no other text."""

    try:
        # Use GPT-5.1 with new responses API
        response = openai_client.responses.create(
            model="gpt-5.1",
            input=refinement_prompt
        )

        # GPT-5.1 response structure: response.output[0].content[0].text contains the JSON string
        if hasattr(response, 'output') and isinstance(response.output, list) and len(response.output) > 0:
            # Get the first message from output
            first_message = response.output[0]

            # Extract text from the message content
            if hasattr(first_message, 'content') and isinstance(first_message.content, list) and len(first_message.content) > 0:
                first_content = first_message.content[0]

                # Get the text from the content item
                if hasattr(first_content, 'text'):
                    result_text = first_content.text
                else:
                    raise ValueError("GPT-5.1 response content has no 'text' attribute")
            else:
                raise ValueError("GPT-5.1 response message has no 'content' list")
        else:
            raise ValueError("GPT-5.1 response has no 'output' list")

        # Parse the JSON string
        result = json.loads(result_text)

        # Sanitize Unicode for PDF compatibility
        if result.get("refined_content"):
            result["refined_content"] = sanitize_unicode_for_pdf(result["refined_content"])
        if result.get("changes_summary"):
            result["changes_summary"] = sanitize_unicode_for_pdf(result["changes_summary"])

        return {
            "success": True,
            "model": "gpt-5.1",
            "refined_content": result.get("refined_content", ""),
            "changes_summary": result.get("changes_summary", ""),
            "stats": result.get("stats", {}),
            "prompt_sent": refinement_prompt
        }

    except json.JSONDecodeError as e:
        return {
            "success": False,
            "error": f"Failed to parse AI response as JSON: {str(e)}",
            "model": "gpt-5.1",
            "raw_response": result_text if 'result_text' in locals() else None,
            "prompt_sent": refinement_prompt
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "model": "gpt-5.1",
            "prompt_sent": refinement_prompt
        }
