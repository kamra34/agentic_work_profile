"""
AI response schemas for structured outputs (OpenAI JSON Schema / Claude tool-use).
Enforces OpenAI strict-mode constraints: additionalProperties false, all properties in required,
nullable fields expressed as anyOf with null.
"""

from typing import Dict, Any


def claude_tool(name: str, description: str, schema: Dict[str, Any]) -> Dict[str, Any]:
    """Build a Claude tool definition for structured output via tool-use."""
    return {
        "name": name,
        "description": description,
        "input_schema": schema
    }


# ============================================================================
# Job Analysis Schema
# ============================================================================

JOB_ANALYSIS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "job_metadata",
        "requirements",
        "role_summary",
        "company_culture",
        "must_haves",
        "nice_to_haves"
    ],
    "properties": {
        "job_metadata": {
            "type": "object",
            "additionalProperties": False,
            "required": ["title", "company", "seniority_level", "location", "job_type"],
            "properties": {
                "title": {
                    "anyOf": [{"type": "string"}, {"type": "null"}]
                },
                "company": {
                    "anyOf": [{"type": "string"}, {"type": "null"}]
                },
                "seniority_level": {
                    "anyOf": [{"type": "string"}, {"type": "null"}]
                },
                "location": {
                    "anyOf": [{"type": "string"}, {"type": "null"}]
                },
                "job_type": {
                    "anyOf": [{"type": "string"}, {"type": "null"}]
                }
            }
        },
        "requirements": {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "technical_skills",
                "soft_skills",
                "experience_years",
                "education",
                "certifications",
                "responsibilities",
                "key_keywords"
            ],
            "properties": {
                "technical_skills": {
                    "type": "array",
                    "items": {"type": "string"}
                },
                "soft_skills": {
                    "type": "array",
                    "items": {"type": "string"}
                },
                "experience_years": {
                    "anyOf": [{"type": "number"}, {"type": "null"}]
                },
                "education": {
                    "anyOf": [{"type": "string"}, {"type": "null"}]
                },
                "certifications": {
                    "type": "array",
                    "items": {"type": "string"}
                },
                "responsibilities": {
                    "type": "array",
                    "items": {"type": "string"}
                },
                "key_keywords": {
                    "type": "array",
                    "items": {"type": "string"}
                }
            }
        },
        "role_summary": {"type": "string"},
        "company_culture": {
            "anyOf": [{"type": "string"}, {"type": "null"}]
        },
        "must_haves": {
            "type": "array",
            "items": {"type": "string"}
        },
        "nice_to_haves": {
            "type": "array",
            "items": {"type": "string"}
        }
    }
}


# ============================================================================
# Scoring Schema
# ============================================================================

SCORING_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "fit_score",
        "fit_reasoning",
        "ats_score",
        "ats_reasoning",
        "verdict",
        "verdict_reasoning",
        "strengths",
        "missing_skills",
        "critical_gaps",
        "matching_skills",
        "recommendations"
    ],
    "properties": {
        "fit_score": {"type": "number"},
        "fit_reasoning": {"type": "string"},
        "ats_score": {"type": "number"},
        "ats_reasoning": {"type": "string"},
        "verdict": {
            "type": "string",
            "enum": ["SHOULD_APPLY", "CONSIDER_APPLYING", "SHOULD_NOT_APPLY"]
        },
        "verdict_reasoning": {"type": "string"},
        "strengths": {
            "type": "array",
            "items": {"type": "string"}
        },
        "missing_skills": {
            "type": "array",
            "items": {"type": "string"}
        },
        "critical_gaps": {
            "type": "array",
            "items": {"type": "string"}
        },
        "matching_skills": {
            "type": "array",
            "items": {"type": "string"}
        },
        "recommendations": {
            "type": "array",
            "items": {"type": "string"}
        }
    }
}


# ============================================================================
# Node Selection Schema
# ============================================================================

NODE_SELECTION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["selected_nodes", "selection_summary", "tailoring_strategy"],
    "properties": {
        "selected_nodes": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["id", "include", "confidence", "reason", "relevance_tags"],
                "properties": {
                    "id": {"type": "integer"},
                    "include": {"type": "boolean"},
                    "confidence": {"type": "number"},
                    "reason": {"type": "string"},
                    "relevance_tags": {
                        "type": "array",
                        "items": {"type": "string"}
                    }
                }
            }
        },
        "selection_summary": {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "total_nodes",
                "recommended_include",
                "recommended_exclude",
                "expected_cv_length",
                "tailoring_percentage"
            ],
            "properties": {
                "total_nodes": {"type": "integer"},
                "recommended_include": {"type": "integer"},
                "recommended_exclude": {"type": "integer"},
                "expected_cv_length": {"type": "string"},
                "tailoring_percentage": {"type": "string"}
            }
        },
        "tailoring_strategy": {"type": "string"}
    }
}
