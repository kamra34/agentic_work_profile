"""
Job Description Analysis Service
Analyzes job descriptions using both OpenAI and Anthropic models
"""
import os
import json
from typing import Dict, Any, Optional
from openai_wrapper import call_openai_for_json
from logger_config import get_logger

# Initialize logger
logger = get_logger("JobAnalysis")

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


def analyze_job_with_openai(job_description: str, model: str = None) -> Dict[str, Any]:
    """
    Analyze job description using OpenAI (supports both GPT-4o and GPT-5.1)

    Returns structured analysis including:
    - Job category (managerial, leadership, technical, hybrid, etc.)
    - Key requirements (skills, experience, education)
    - Extracted sections from job description
    - Required qualifications
    - Preferred qualifications

    Args:
        job_description: The job description text to analyze
        model: Optional model override ("gpt-4o" or "gpt-5.1"). Uses env var if not specified.
    """
    model_name = model or os.getenv("OPENAI_MODEL_VERSION", "gpt-4o")
    logger.step(f"Analyzing job description with OpenAI ({model_name})", step_num=1)

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
        user_prompt = f"Analyze this job description:\n\n{job_description}"
        logger.info(f"Job description length: {len(job_description)} characters")

        # Use the unified wrapper
        result = call_openai_for_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            model=model
        )

        if not result["success"]:
            logger.error(f"OpenAI analysis failed: {result['error']}")
            raise Exception(result["error"])

        logger.success(f"Job analysis complete using {result['model']}")

        response_data = {
            "provider": "openai",
            "model": result["model"],
            "analysis": result["data"]
        }

        # Include reasoning token count for GPT-5.1
        if "reasoning_tokens" in result:
            response_data["reasoning_tokens"] = result["reasoning_tokens"]
            logger.info(f"🧠 Used {result['reasoning_tokens']} reasoning tokens")

        return response_data

    except Exception as e:
        logger.error("OpenAI job analysis failed", error=e)
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
    logger.dual_analysis_start(["OpenAI", "Claude"])

    results = {
        "job_description": job_description,
        "analyses": []
    }

    analysis_results = {}

    # Try OpenAI analysis
    try:
        logger.step("Running OpenAI analysis", step_num=1)
        openai_result = analyze_job_with_openai(job_description)
        results["analyses"].append(openai_result)
        analysis_results["OpenAI"] = {"success": True, "model": openai_result.get("model", "openai")}
    except Exception as e:
        logger.error(f"OpenAI analysis failed in dual mode", error=e)
        results["analyses"].append({
            "provider": "openai",
            "error": str(e)
        })
        analysis_results["OpenAI"] = {"success": False, "error": str(e)}

    # Try Claude analysis
    try:
        logger.step("Running Claude analysis", step_num=2)
        claude_result = analyze_job_with_claude(job_description)
        results["analyses"].append(claude_result)
        analysis_results["Claude"] = {"success": True, "model": claude_result.get("model", "claude")}
    except Exception as e:
        logger.error(f"Claude analysis failed in dual mode", error=e)
        results["analyses"].append({
            "provider": "anthropic",
            "error": str(e)
        })
        analysis_results["Claude"] = {"success": False, "error": str(e)}

    logger.dual_analysis_summary(analysis_results)

    return results
