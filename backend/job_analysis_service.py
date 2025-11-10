"""
Job Description Analysis Service
Analyzes job descriptions using both OpenAI and Anthropic models
"""
import os
import json
from typing import Dict, Any, Optional

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


def analyze_job_with_openai(job_description: str) -> Dict[str, Any]:
    """
    Analyze job description using OpenAI's latest model (GPT-4o)

    Returns structured analysis including:
    - Job category (managerial, leadership, technical, hybrid, etc.)
    - Key requirements (skills, experience, education)
    - Extracted sections from job description
    - Required qualifications
    - Preferred qualifications
    """

    if not openai_client:
        raise Exception("OpenAI client not initialized. Please set OPENAI_API_KEY environment variable.")

    system_prompt = """You are an expert job description analyst. Analyze the provided job description and extract structured information.

Your analysis should include:
1. **Job Category**: Classify the role (e.g., "Pure Technical", "Managerial", "Leadership", "Technical Leadership", "Hybrid Technical-Managerial", "Individual Contributor", etc.)
2. **Key Requirements**: Extract and categorize all requirements found in the job description
3. **Technical Skills**: List all technical skills, tools, and technologies mentioned
4. **Soft Skills**: List all soft skills and interpersonal competencies
5. **Education Requirements**: Any degree, certification, or educational requirements
6. **Experience Requirements**: Years and type of experience required
7. **Responsibilities**: Main responsibilities and duties
8. **Preferred Qualifications**: Nice-to-have skills or qualifications
9. **Job Level**: Junior, Mid-level, Senior, Staff, Principal, etc.
10. **Domain/Industry**: Specific industry or domain knowledge required

Return your analysis as a JSON object with clear structure."""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",  # Latest GPT-4 Optimized model
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Analyze this job description:\n\n{job_description}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.3  # Lower temperature for more consistent analysis
        )

        result = json.loads(response.choices[0].message.content)

        return {
            "provider": "openai",
            "model": "gpt-4o",
            "analysis": result
        }

    except Exception as e:
        raise Exception(f"OpenAI analysis failed: {str(e)}")


def analyze_job_with_claude(job_description: str) -> Dict[str, Any]:
    """
    Analyze job description using Anthropic's Claude (Claude Sonnet 4.5)

    Returns structured analysis including:
    - Job category (managerial, leadership, technical, hybrid, etc.)
    - Key requirements (skills, experience, education)
    - Extracted sections from job description
    - Required qualifications
    - Preferred qualifications
    """

    if not anthropic_client:
        raise Exception("Anthropic client not initialized. Please set ANTHROPIC_API_KEY environment variable.")

    system_prompt = """You are an expert job description analyst. Analyze the provided job description and extract structured information.

Your analysis should include:
1. **Job Category**: Classify the role (e.g., "Pure Technical", "Managerial", "Leadership", "Technical Leadership", "Hybrid Technical-Managerial", "Individual Contributor", etc.)
2. **Key Requirements**: Extract and categorize all requirements found in the job description
3. **Technical Skills**: List all technical skills, tools, and technologies mentioned
4. **Soft Skills**: List all soft skills and interpersonal competencies
5. **Education Requirements**: Any degree, certification, or educational requirements
6. **Experience Requirements**: Years and type of experience required
7. **Responsibilities**: Main responsibilities and duties
8. **Preferred Qualifications**: Nice-to-have skills or qualifications
9. **Job Level**: Junior, Mid-level, Senior, Staff, Principal, etc.
10. **Domain/Industry**: Specific industry or domain knowledge required

Return your analysis as a JSON object with clear structure. Start your response with { and end with }."""

    try:
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",  # Latest Claude Sonnet 4.5 model
            max_tokens=4096,
            temperature=0.3,  # Lower temperature for more consistent analysis
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": f"Analyze this job description:\n\n{job_description}"
                }
            ]
        )

        content = response.content[0].text
        # Parse the JSON response
        result = json.loads(content)

        return {
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "analysis": result
        }

    except json.JSONDecodeError as e:
        # If Claude returns text instead of JSON, wrap it
        return {
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "analysis": {
                "raw_response": content,
                "error": f"Failed to parse JSON: {str(e)}"
            }
        }
    except Exception as e:
        raise Exception(f"Claude analysis failed: {str(e)}")


def analyze_job_description_dual(job_description: str) -> Dict[str, Any]:
    """
    Analyze job description with both OpenAI and Claude, return both results
    """

    results = {
        "job_description": job_description,
        "analyses": []
    }

    # Try OpenAI analysis
    try:
        openai_result = analyze_job_with_openai(job_description)
        results["analyses"].append(openai_result)
    except Exception as e:
        results["analyses"].append({
            "provider": "openai",
            "error": str(e)
        })

    # Try Claude analysis
    try:
        claude_result = analyze_job_with_claude(job_description)
        results["analyses"].append(claude_result)
    except Exception as e:
        results["analyses"].append({
            "provider": "anthropic",
            "error": str(e)
        })

    return results
