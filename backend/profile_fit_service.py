"""
Profile Fit Analysis Service
Analyzes how well a user's profile matches a job description
Uses both OpenAI and Anthropic for unbiased, comprehensive assessment
"""
import os
import json
from typing import Dict, Any, Optional

# Initialize clients conditionally (same as job_analysis_service)
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


def analyze_profile_fit_with_openai(job_analysis: Dict[str, Any], user_profile: str) -> Dict[str, Any]:
    """
    Analyze profile fit using OpenAI GPT-4o with strict, unbiased evaluation

    Args:
        job_analysis: The analyzed job description data
        user_profile: Formatted profile text from format_profile_for_ai()
    """
    if not openai_client:
        raise Exception("OpenAI client not initialized. Please set OPENAI_API_KEY environment variable.")

    system_prompt = """You are a brutally honest and unbiased career fit analyst. Your job is to evaluate how well a candidate's profile matches a job description.

CRITICAL INSTRUCTIONS:
- Be FAIR and HONEST, not nice or encouraging
- Do NOT show positive bias or try to be encouraging
- Evaluate based on ACTUAL match, not potential
- If there are gaps, state them clearly
- If the candidate is not qualified, say so directly
- A bad match is a waste of time for both the candidate and company
- Consider that applying to poorly matched jobs damages the candidate's reputation

Your analysis must include:
1. **Fit Percentage**: A number from 0-100 representing actual match quality
   - 90-100: Exceptional match, candidate exceeds requirements
   - 75-89: Strong match, candidate meets all key requirements
   - 60-74: Moderate match, candidate meets most requirements with some gaps
   - 40-59: Weak match, significant gaps in key requirements
   - 0-39: Poor match, candidate should not apply

2. **Fit Summary**: 2-3 sentences on overall match quality

3. **Strengths**: Specific areas where candidate's profile aligns well with job requirements

4. **Critical Gaps**: Requirements the candidate does NOT meet or areas where they fall short

5. **Experience Match**: How well candidate's experience level matches the job level

6. **Technical Skills Match**: Percentage of required technical skills the candidate has

7. **ATS Compatibility Score**: Score from 0-100 for Applicant Tracking System compatibility
   - Keyword matching: exact keywords from job description in profile
   - Skills coverage: percentage of required skills present
   - Quantifiable achievements: presence of numbers, metrics, percentages
   - Action verbs: strong action verbs used in experience
   - Format compatibility: profile structure (JSON format is ATS-friendly)
   Include breakdown: {"keyword_match": <0-100>, "skills_coverage": <0-100>, "has_metrics": <true/false>, "action_verbs_score": <0-100>, "overall_ats_score": <0-100>}

8. **Recommendation**: Clear YES/NO on whether candidate should apply, with brief reasoning

Return your analysis as a JSON object with this exact structure:
{
  "fit_percentage": <number 0-100>,
  "fit_summary": "<honest assessment>",
  "strengths": ["<specific strength 1>", "<specific strength 2>", ...],
  "critical_gaps": ["<gap 1>", "<gap 2>", ...],
  "experience_match": "<assessment>",
  "technical_skills_match": <percentage 0-100>,
  "ats_compatibility": {
    "keyword_match": <number 0-100>,
    "skills_coverage": <number 0-100>,
    "has_metrics": <boolean>,
    "action_verbs_score": <number 0-100>,
    "overall_ats_score": <number 0-100>,
    "ats_notes": "<brief explanation of ATS scoring>"
  },
  "recommendation": {
    "should_apply": <true/false>,
    "reasoning": "<clear explanation>"
  }
}"""

    user_content = f"""Job Requirements Analysis:
{json.dumps(job_analysis, indent=2)}

Candidate Profile:
{user_profile}

Analyze how well this candidate's profile matches the job requirements. Be honest and unbiased."""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            response_format={"type": "json_object"},
            temperature=0.2  # Low temperature for consistent, unbiased analysis
        )

        result = json.loads(response.choices[0].message.content)

        return {
            "provider": "openai",
            "model": "gpt-4o",
            "fit_analysis": result
        }

    except Exception as e:
        raise Exception(f"OpenAI fit analysis failed: {str(e)}")


def analyze_profile_fit_with_claude(job_analysis: Dict[str, Any], user_profile: str) -> Dict[str, Any]:
    """
    Analyze profile fit using Claude Sonnet 4.5 with strict, unbiased evaluation

    Args:
        job_analysis: The analyzed job description data
        user_profile: Formatted profile text from format_profile_for_ai()
    """
    if not anthropic_client:
        raise Exception("Anthropic client not initialized. Please set ANTHROPIC_API_KEY environment variable.")

    system_prompt = """You are a brutally honest and unbiased career fit analyst. Your job is to evaluate how well a candidate's profile matches a job description.

CRITICAL INSTRUCTIONS:
- Be FAIR and HONEST, not nice or encouraging
- Do NOT show positive bias or try to be encouraging
- Evaluate based on ACTUAL match, not potential
- If there are gaps, state them clearly
- If the candidate is not qualified, say so directly
- A bad match is a waste of time for both the candidate and company
- Consider that applying to poorly matched jobs damages the candidate's reputation

Your analysis must include:
1. **Fit Percentage**: A number from 0-100 representing actual match quality
   - 90-100: Exceptional match, candidate exceeds requirements
   - 75-89: Strong match, candidate meets all key requirements
   - 60-74: Moderate match, candidate meets most requirements with some gaps
   - 40-59: Weak match, significant gaps in key requirements
   - 0-39: Poor match, candidate should not apply

2. **Fit Summary**: 2-3 sentences on overall match quality

3. **Strengths**: Specific areas where candidate's profile aligns well with job requirements

4. **Critical Gaps**: Requirements the candidate does NOT meet or areas where they fall short

5. **Experience Match**: How well candidate's experience level matches the job level

6. **Technical Skills Match**: Percentage of required technical skills the candidate has

7. **ATS Compatibility Score**: Score from 0-100 for Applicant Tracking System compatibility
   - Keyword matching: exact keywords from job description in profile
   - Skills coverage: percentage of required skills present
   - Quantifiable achievements: presence of numbers, metrics, percentages
   - Action verbs: strong action verbs used in experience
   - Format compatibility: profile structure (JSON format is ATS-friendly)
   Include breakdown: {"keyword_match": <0-100>, "skills_coverage": <0-100>, "has_metrics": <true/false>, "action_verbs_score": <0-100>, "overall_ats_score": <0-100>}

8. **Recommendation**: Clear YES/NO on whether candidate should apply, with brief reasoning

Return your analysis as a JSON object with this exact structure:
{
  "fit_percentage": <number 0-100>,
  "fit_summary": "<honest assessment>",
  "strengths": ["<specific strength 1>", "<specific strength 2>", ...],
  "critical_gaps": ["<gap 1>", "<gap 2>", ...],
  "experience_match": "<assessment>",
  "technical_skills_match": <percentage 0-100>,
  "ats_compatibility": {
    "keyword_match": <number 0-100>,
    "skills_coverage": <number 0-100>,
    "has_metrics": <boolean>,
    "action_verbs_score": <number 0-100>,
    "overall_ats_score": <number 0-100>,
    "ats_notes": "<brief explanation of ATS scoring>"
  },
  "recommendation": {
    "should_apply": <true/false>,
    "reasoning": "<clear explanation>"
  }
}

Start your response with { and end with }."""

    user_content = f"""Job Requirements Analysis:
{json.dumps(job_analysis, indent=2)}

Candidate Profile:
{user_profile}

Analyze how well this candidate's profile matches the job requirements. Be honest and unbiased."""

    try:
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            temperature=0.2,  # Low temperature for consistent, unbiased analysis
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
            "fit_analysis": result
        }

    except json.JSONDecodeError as e:
        return {
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "fit_analysis": {
                "raw_response": content,
                "error": f"Failed to parse JSON: {str(e)}"
            }
        }
    except Exception as e:
        raise Exception(f"Claude fit analysis failed: {str(e)}")


def analyze_profile_fit_dual(job_analysis: Dict[str, Any], formatted_profile: str) -> Dict[str, Any]:
    """
    Analyze profile fit with both OpenAI and Claude, return both results for comparison

    Args:
        job_analysis: The analyzed job description data
        formatted_profile: Formatted profile text from format_profile_for_ai()
    """
    results = {
        "job_analysis": job_analysis,
        "input_data": {
            "job_analysis": job_analysis,
            "formatted_profile": formatted_profile
        },
        "fit_analyses": []
    }

    # Try OpenAI analysis
    try:
        openai_result = analyze_profile_fit_with_openai(job_analysis, formatted_profile)
        results["fit_analyses"].append(openai_result)
    except Exception as e:
        results["fit_analyses"].append({
            "provider": "openai",
            "error": str(e)
        })

    # Try Claude analysis
    try:
        claude_result = analyze_profile_fit_with_claude(job_analysis, formatted_profile)
        results["fit_analyses"].append(claude_result)
    except Exception as e:
        results["fit_analyses"].append({
            "provider": "anthropic",
            "error": str(e)
        })

    # Debug: Print to verify input_data is included
    print(f"[DEBUG] Response has input_data: {'input_data' in results}")
    print(f"[DEBUG] Response keys: {results.keys()}")

    return results
