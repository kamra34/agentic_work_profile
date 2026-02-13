"""
OpenAI API Wrapper with Dual Parser Support
Supports both GPT-4o (legacy chat.completions API) and GPT-5.1 (new responses API)

This wrapper provides a unified interface for calling OpenAI models regardless of API version.
"""

import os
import json
import time
import re
from typing import Dict, Any, Optional, Literal
from openai import OpenAI
from logger_config import get_logger

# Initialize logger
logger = get_logger("OpenAI-Wrapper")

# Initialize client
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# Configuration from environment variables
DEFAULT_MODEL = os.getenv("OPENAI_MODEL_VERSION", "gpt-4o")  # Default to gpt-4o for safety
DEFAULT_REASONING_EFFORT = os.getenv("OPENAI_REASONING_EFFORT", "medium")  # low, medium, high

ModelVersion = Literal["gpt-4o", "gpt-5.1"]
ReasoningEffort = Literal["none", "low", "medium", "high"]


def _extract_json_and_parse(raw_text: str) -> tuple[Dict[str, Any], str]:
    """
    Parse JSON with tolerant fallbacks for real-world model output.
    Handles:
    - Markdown fences
    - Leading/trailing prose around JSON
    - Trailing commas
    - Control characters
    """
    if not raw_text or not raw_text.strip():
        raise ValueError("Model returned empty text")

    def _uniq_keep_order(items):
        seen = set()
        out = []
        for item in items:
            if not item:
                continue
            key = item.strip()
            if key and key not in seen:
                seen.add(key)
                out.append(key)
        return out

    text = raw_text.strip()
    candidates = [text]

    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 3 and lines[-1].strip().startswith("```"):
            candidates.append("\n".join(lines[1:-1]).strip())

    # Extract object bounds from each candidate
    for candidate in list(candidates):
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start != -1 and end != -1 and end > start:
            candidates.append(candidate[start:end + 1].strip())

    candidates = _uniq_keep_order(candidates)

    # First pass: strict parse
    for candidate in candidates:
        try:
            return json.loads(candidate), candidate
        except json.JSONDecodeError:
            continue

    # Second pass: common safe repairs
    repaired = []
    for candidate in candidates:
        fixed = re.sub(r",(\s*[}\]])", r"\1", candidate)  # trailing commas
        fixed = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", fixed)  # control chars
        repaired.append(fixed)

    repaired = _uniq_keep_order(repaired)
    for candidate in repaired:
        try:
            return json.loads(candidate), candidate
        except json.JSONDecodeError:
            continue

    preview = text[:300].replace("\n", " ")
    raise ValueError(f"Could not parse model output as JSON. Preview: {preview}")


def _extract_responses_text(response: Any) -> str:
    """
    Extract text robustly from OpenAI Responses API response.
    Prefers output_text, falls back to traversing output/content blocks.
    """
    output_text = getattr(response, "output_text", None)
    if output_text and str(output_text).strip():
        return str(output_text).strip()

    chunks = []
    for item in getattr(response, "output", []) or []:
        for content in getattr(item, "content", []) or []:
            text_value = getattr(content, "text", None)
            if text_value:
                chunks.append(str(text_value))
                continue
            if isinstance(content, dict):
                dict_text = content.get("text") or content.get("output_text")
                if dict_text:
                    chunks.append(str(dict_text))

    return "\n".join(chunks).strip()


def call_openai_for_json(
    system_prompt: str,
    user_prompt: str,
    model: Optional[str] = None,
    reasoning_effort: Optional[str] = None,
    temperature: float = 0.3,
    timeout: int = 180
) -> Dict[str, Any]:
    """
    Unified OpenAI API wrapper that handles both GPT-4o and GPT-5.1.

    Automatically detects the model version and uses the appropriate API:
    - GPT-4o: Uses chat.completions.create() with response_format
    - GPT-5.1: Uses responses.create() with reasoning parameter

    Args:
        system_prompt: System message defining the AI's role and behavior
        user_prompt: User message with the actual request
        model: Model to use ("gpt-4o" or "gpt-5.1"). Defaults to env var OPENAI_MODEL_VERSION or "gpt-4o"
        reasoning_effort: For GPT-5.1 only - "none", "low", "medium", or "high". Defaults to env var or "medium"
        temperature: Sampling temperature (only used for GPT-4o, ignored for GPT-5.1)
        timeout: Request timeout in seconds

    Returns:
        Dict containing:
        - success: bool - Whether the call succeeded
        - data: dict - Parsed JSON response (if success=True)
        - model: str - Model used
        - error: str - Error message (if success=False)
        - raw_text: str - Raw JSON text from API (for debugging)
        - reasoning_tokens: int - Number of reasoning tokens used (GPT-5.1 only)

    Raises:
        ValueError: If OpenAI client not initialized or invalid parameters
        Exception: For API errors

    Example:
        result = call_openai_for_json(
            system_prompt="You are a job analyst. Return JSON only.",
            user_prompt="Analyze this job: ...",
            model="gpt-5.1",
            reasoning_effort="medium"
        )

        if result["success"]:
            data = result["data"]
            print(f"Got response from {result['model']}")
            if "reasoning_tokens" in result:
                print(f"Used {result['reasoning_tokens']} reasoning tokens")
        else:
            print(f"Error: {result['error']}")
    """

    # Validate client initialization
    if not openai_client:
        logger.error("OpenAI client not initialized")
        return {
            "success": False,
            "error": "OpenAI client not initialized. Check OPENAI_API_KEY environment variable.",
            "model": model or DEFAULT_MODEL
        }

    # Use defaults if not specified
    if model is None:
        model = DEFAULT_MODEL
    if reasoning_effort is None:
        reasoning_effort = DEFAULT_REASONING_EFFORT

    # Validate model
    if model not in ["gpt-4o", "gpt-5.1"]:
        logger.error(f"Invalid model specified: {model}")
        return {
            "success": False,
            "error": f"Invalid model: {model}. Must be 'gpt-4o' or 'gpt-5.1'",
            "model": model
        }

    # Validate reasoning effort (GPT-5.1 supports: none, low, medium, high)
    if reasoning_effort not in ["none", "low", "medium", "high"]:
        logger.warning(f"Invalid reasoning_effort: {reasoning_effort}, using 'medium'")
        reasoning_effort = "medium"

    # Log the API call
    prompt_preview = system_prompt[:50] + "..." if len(system_prompt) > 50 else system_prompt
    reasoning_label = reasoning_effort if model == "gpt-5.1" else "n/a"
    logger.info(f"Preparing API call: {model} (reasoning: {reasoning_label})")

    try:
        # Route to appropriate API based on model version
        start_time = time.time()

        if model == "gpt-5.1":
            result = _call_gpt51(system_prompt, user_prompt, reasoning_effort, timeout)
        else:
            result = _call_gpt4o(system_prompt, user_prompt, temperature, timeout)

        duration = time.time() - start_time

        # Log result
        if result["success"]:
            token_info = result.get("usage", {})
            logger.model_response(model, True, duration, token_info)
            if "reasoning_tokens" in result and result["reasoning_tokens"] > 0:
                logger.info(f"🧠 Reasoning tokens used: {result['reasoning_tokens']}")
        else:
            logger.model_response(model, False, duration)
            logger.error(f"API call failed: {result.get('error', 'Unknown error')}")

        return result

    except Exception as e:
        logger.error(f"OpenAI API call exception", error=e)
        return {
            "success": False,
            "error": f"OpenAI API call failed: {str(e)}",
            "model": model,
            "exception_type": type(e).__name__
        }


def _call_gpt4o(
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    timeout: int
) -> Dict[str, Any]:
    """
    Call GPT-4o using the legacy chat.completions API.

    Uses response_format={"type": "json_object"} to ensure JSON output.
    """
    logger.model_call("gpt-4o", "chat.completions", f"temperature={temperature}")

    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=temperature,
        response_format={"type": "json_object"},
        timeout=timeout
    )

    # Extract + parse JSON with tolerant fallback
    json_text = response.choices[0].message.content
    parsed_data, parsed_source_text = _extract_json_and_parse(json_text)

    return {
        "success": True,
        "data": parsed_data,
        "model": "gpt-4o",
        "requested_model": "gpt-4o",
        "actual_model": getattr(response, "model", "gpt-4o"),
        "api_name": "chat.completions",
        "raw_text": json_text,
        "parsed_text": parsed_source_text,
        "usage": {
            "prompt_tokens": response.usage.prompt_tokens if hasattr(response, 'usage') else None,
            "completion_tokens": response.usage.completion_tokens if hasattr(response, 'usage') else None,
            "total_tokens": response.usage.total_tokens if hasattr(response, 'usage') else None
        }
    }


def _call_gpt51(
    system_prompt: str,
    user_prompt: str,
    reasoning_effort: str,
    timeout: int
) -> Dict[str, Any]:
    """
    Call GPT-5.1 using the new responses API.

    Uses reasoning parameter and nested message structure.
    Note: GPT-5.1 doesn't support response_format or temperature parameters.
    JSON output must be requested in the prompt.
    """
    logger.model_call("gpt-5.1", "responses.create", f"reasoning_effort={reasoning_effort}")

    # Ensure prompts explicitly request JSON
    enhanced_system_prompt = _ensure_json_instruction(system_prompt)

    response = openai_client.responses.create(
        model="gpt-5.1",
        reasoning={"effort": reasoning_effort},
        input=[
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": enhanced_system_prompt
                    }
                ]
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": user_prompt
                    }
                ]
            }
        ],
        timeout=timeout
    )

    # Extract + parse JSON with tolerant fallback
    json_text = _extract_responses_text(response)
    parsed_data, parsed_source_text = _extract_json_and_parse(json_text)

    # Extract usage information
    reasoning_tokens = 0
    output_tokens = 0
    input_tokens = 0

    if hasattr(response, 'usage'):
        if hasattr(response.usage, 'output_tokens_details'):
            reasoning_tokens = response.usage.output_tokens_details.reasoning_tokens
        output_tokens = response.usage.output_tokens
        input_tokens = response.usage.input_tokens

    return {
        "success": True,
        "data": parsed_data,
        "model": "gpt-5.1",
        "requested_model": "gpt-5.1",
        "actual_model": getattr(response, "model", "gpt-5.1"),
        "api_name": "responses.create",
        "raw_text": json_text,
        "parsed_text": parsed_source_text,
        "reasoning_tokens": reasoning_tokens,
        "usage": {
            "prompt_tokens": input_tokens,
            "completion_tokens": output_tokens,
            "reasoning_tokens": reasoning_tokens,
            "total_tokens": input_tokens + output_tokens
        }
    }


def _ensure_json_instruction(prompt: str) -> str:
    """
    Ensures the system prompt explicitly requests JSON output for GPT-5.1.

    GPT-5.1 doesn't support response_format parameter, so we need to be explicit
    in the prompt about returning JSON.

    If the prompt already mentions JSON, returns it unchanged.
    Otherwise, adds a JSON instruction at the beginning.
    """
    prompt_lower = prompt.lower()

    # Check if prompt already mentions JSON
    json_keywords = ["json", "return a json", "respond with json", "output json"]
    if any(keyword in prompt_lower for keyword in json_keywords):
        return prompt  # Already has JSON instruction

    # Add explicit JSON instruction
    json_instruction = (
        "IMPORTANT: You must respond with ONLY valid JSON. "
        "Do not include any text before or after the JSON object. "
        "Your entire response must be parseable as JSON.\n\n"
    )

    return json_instruction + prompt


def get_current_model_config() -> Dict[str, str]:
    """
    Returns the current model configuration from environment variables.

    Useful for debugging and logging.

    Returns:
        Dict with:
        - model: Current default model
        - reasoning_effort: Current default reasoning effort
        - api_key_set: Whether API key is configured
    """
    return {
        "model": DEFAULT_MODEL,
        "reasoning_effort": DEFAULT_REASONING_EFFORT,
        "api_key_set": bool(OPENAI_API_KEY)
    }


def validate_json_response(data: Dict[str, Any], required_fields: list) -> Dict[str, Any]:
    """
    Helper function to validate that JSON response contains required fields.

    Args:
        data: Parsed JSON data
        required_fields: List of field names that must be present

    Returns:
        Dict with:
        - valid: bool - Whether all required fields are present
        - missing_fields: list - Fields that are missing
    """
    missing_fields = [field for field in required_fields if field not in data]

    return {
        "valid": len(missing_fields) == 0,
        "missing_fields": missing_fields
    }
