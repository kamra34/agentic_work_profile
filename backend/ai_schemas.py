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


# ============================================================================
# Skill Weave Schema (add a new skill across the profile, with a clarify step)
# ============================================================================

SKILL_WEAVE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["needs_clarification", "clarifying_questions", "facts_used", "injections"],
    "properties": {
        # When True, the model is asking for more detail and injections is empty.
        "needs_clarification": {"type": "boolean"},
        "clarifying_questions": {
            "type": "array",
            "items": {"type": "string"}
        },
        # The concrete facts the model took from the person's own words.
        "facts_used": {
            "type": "array",
            "items": {"type": "string"}
        },
        "injections": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "target_kind", "action", "node_id", "parent_node_id",
                    "new_node_type", "original_text", "proposed_text", "rationale"
                ],
                "properties": {
                    "target_kind": {
                        "type": "string",
                        "enum": ["summary", "work_experience", "core_skills", "other"]
                    },
                    "action": {"type": "string", "enum": ["add", "edit"]},
                    # Existing node to edit (for action "edit").
                    "node_id": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
                    # Section/entry to add a new node under (for action "add").
                    "parent_node_id": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
                    "new_node_type": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                    "original_text": {"type": "string"},
                    "proposed_text": {"type": "string"},
                    "rationale": {"type": "string"}
                }
            }
        }
    }
}


# ============================================================================
# Refine-All Schema (one holistic, deduped, tailored rewrite of the whole CV)
# ============================================================================

REFINE_ALL_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["profile_title", "sections", "removed_or_merged", "changes_summary"],
    "properties": {
        # Optional tidied headline/title for the CV; null to leave unchanged.
        "profile_title": {"anyOf": [{"type": "string"}, {"type": "null"}]},
        "sections": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["node_id", "heading", "refined_markdown"],
                "properties": {
                    # The existing section node id (from its [#id] tag).
                    "node_id": {"type": "integer"},
                    "heading": {"type": "string"},
                    # Final content for this section as markdown: a tight paragraph
                    # for the summary, "- bullets" for skills, or
                    # "### Title · Company · dates\n- bullets" entries for experience.
                    "refined_markdown": {"type": "string"}
                }
            }
        },
        # Transparency: duplicates/low-value items that were merged or dropped.
        "removed_or_merged": {"type": "array", "items": {"type": "string"}},
        "changes_summary": {"type": "string"}
    }
}
