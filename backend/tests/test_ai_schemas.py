"""
Tests for AI response schemas (structured outputs for OpenAI JSON Schema and Claude tool-use).
"""

import pytest
from ai_schemas import (
    JOB_ANALYSIS_SCHEMA,
    SCORING_SCHEMA,
    NODE_SELECTION_SCHEMA,
    SKILL_WEAVE_SCHEMA,
    claude_tool
)


class TestJobAnalysisSchema:
    """Validate JOB_ANALYSIS_SCHEMA structure."""

    def test_schema_is_object(self):
        """Schema must be an object type."""
        assert JOB_ANALYSIS_SCHEMA["type"] == "object"

    def test_has_required_fields(self):
        """Schema must have all required fields."""
        required = JOB_ANALYSIS_SCHEMA.get("required", [])
        assert "job_metadata" in required
        assert "requirements" in required
        assert "role_summary" in required
        assert "company_culture" in required
        assert "must_haves" in required
        assert "nice_to_haves" in required

    def test_no_additional_properties(self):
        """Schema must set additionalProperties to false (OpenAI strict-mode)."""
        assert JOB_ANALYSIS_SCHEMA.get("additionalProperties") is False

    def test_job_metadata_structure(self):
        """job_metadata should be an object with nullable string fields."""
        metadata = JOB_ANALYSIS_SCHEMA["properties"]["job_metadata"]
        assert metadata["type"] == "object"
        assert metadata.get("additionalProperties") is False
        for field in ["title", "company", "seniority_level", "location", "job_type"]:
            assert field in metadata["properties"]
            # Nullable fields use anyOf
            prop = metadata["properties"][field]
            assert "anyOf" in prop or prop.get("type") is not None


class TestScoringSchema:
    """Validate SCORING_SCHEMA structure."""

    def test_schema_is_object(self):
        """Schema must be an object type."""
        assert SCORING_SCHEMA["type"] == "object"

    def test_has_required_fields(self):
        """Schema must have all required fields."""
        required = SCORING_SCHEMA.get("required", [])
        assert "fit_score" in required
        assert "fit_reasoning" in required
        assert "ats_score" in required
        assert "ats_reasoning" in required
        assert "verdict" in required
        assert "verdict_reasoning" in required
        assert "strengths" in required
        assert "missing_skills" in required
        assert "critical_gaps" in required
        assert "matching_skills" in required
        assert "recommendations" in required

    def test_no_additional_properties(self):
        """Schema must set additionalProperties to false."""
        assert SCORING_SCHEMA.get("additionalProperties") is False

    def test_verdict_is_enum(self):
        """verdict must be an enum with specific values."""
        verdict = SCORING_SCHEMA["properties"]["verdict"]
        assert verdict["type"] == "string"
        assert "enum" in verdict
        assert "SHOULD_APPLY" in verdict["enum"]
        assert "CONSIDER_APPLYING" in verdict["enum"]
        assert "SHOULD_NOT_APPLY" in verdict["enum"]


class TestNodeSelectionSchema:
    """Validate NODE_SELECTION_SCHEMA structure."""

    def test_schema_is_object(self):
        """Schema must be an object type."""
        assert NODE_SELECTION_SCHEMA["type"] == "object"

    def test_has_required_fields(self):
        """Schema must have all required fields."""
        required = NODE_SELECTION_SCHEMA.get("required", [])
        assert "selected_nodes" in required
        assert "selection_summary" in required
        assert "tailoring_strategy" in required

    def test_no_additional_properties(self):
        """Schema must set additionalProperties to false."""
        assert NODE_SELECTION_SCHEMA.get("additionalProperties") is False

    def test_selected_nodes_item_structure(self):
        """Each selected_nodes item must have id, include, confidence, reason, relevance_tags."""
        selected_nodes = NODE_SELECTION_SCHEMA["properties"]["selected_nodes"]
        assert selected_nodes["type"] == "array"
        item_schema = selected_nodes["items"]
        assert item_schema["type"] == "object"
        assert item_schema.get("additionalProperties") is False
        for field in ["id", "include", "confidence", "reason", "relevance_tags"]:
            assert field in item_schema["properties"]

    def test_node_id_is_integer(self):
        """Node ID must be integer type (not string)."""
        selected_nodes = NODE_SELECTION_SCHEMA["properties"]["selected_nodes"]
        item_schema = selected_nodes["items"]
        id_field = item_schema["properties"]["id"]
        assert id_field["type"] == "integer"


class TestClaudeTool:
    """Validate claude_tool helper function."""

    def test_tool_structure(self):
        """claude_tool must return correct structure."""
        tool = claude_tool("test_tool", "Test description", {"type": "object"})
        assert "name" in tool
        assert "description" in tool
        assert "input_schema" in tool

    def test_tool_values(self):
        """claude_tool must preserve name, description, and schema."""
        schema = {"type": "object", "properties": {}}
        tool = claude_tool("my_tool", "My description", schema)
        assert tool["name"] == "my_tool"
        assert tool["description"] == "My description"
        assert tool["input_schema"] == schema


class TestOpenAIStrictMode:
    """Validate all schemas meet OpenAI strict-mode requirements."""

    @staticmethod
    def _check_strict_mode(schema, path=""):
        """Recursively check schema for strict-mode compliance."""
        issues = []

        if schema.get("type") == "object":
            # Every property must be in required
            props = schema.get("properties", {})
            required = schema.get("required", [])
            for key in props:
                if key not in required:
                    issues.append(f"{path}.{key} not in required")

            # additionalProperties must be false
            if schema.get("additionalProperties") is not False:
                issues.append(f"{path} additionalProperties not false")

            # Recurse into properties
            for key, prop_schema in props.items():
                issues.extend(TestOpenAIStrictMode._check_strict_mode(prop_schema, f"{path}.{key}"))

        elif schema.get("type") == "array":
            # Recurse into items
            if "items" in schema:
                issues.extend(TestOpenAIStrictMode._check_strict_mode(schema["items"], f"{path}[]"))

        return issues

    def test_job_analysis_strict_mode(self):
        """JOB_ANALYSIS_SCHEMA must meet strict-mode requirements."""
        issues = self._check_strict_mode(JOB_ANALYSIS_SCHEMA, "JOB_ANALYSIS_SCHEMA")
        assert not issues, f"Strict-mode issues: {issues}"

    def test_scoring_strict_mode(self):
        """SCORING_SCHEMA must meet strict-mode requirements."""
        issues = self._check_strict_mode(SCORING_SCHEMA, "SCORING_SCHEMA")
        assert not issues, f"Strict-mode issues: {issues}"

    def test_node_selection_strict_mode(self):
        """NODE_SELECTION_SCHEMA must meet strict-mode requirements."""
        issues = self._check_strict_mode(NODE_SELECTION_SCHEMA, "NODE_SELECTION_SCHEMA")
        assert not issues, f"Strict-mode issues: {issues}"

    def test_skill_weave_strict_mode(self):
        """SKILL_WEAVE_SCHEMA must meet strict-mode requirements."""
        issues = self._check_strict_mode(SKILL_WEAVE_SCHEMA, "SKILL_WEAVE_SCHEMA")
        assert not issues, f"Strict-mode issues: {issues}"


class TestSkillWeaveSchema:
    """Validate SKILL_WEAVE_SCHEMA structure."""

    def test_top_level_fields(self):
        required = SKILL_WEAVE_SCHEMA.get("required", [])
        for field in ["needs_clarification", "clarifying_questions", "facts_used", "injections"]:
            assert field in required

    def test_injection_item_fields(self):
        item = SKILL_WEAVE_SCHEMA["properties"]["injections"]["items"]
        assert item.get("additionalProperties") is False
        for field in ["target_kind", "action", "node_id", "parent_node_id",
                      "new_node_type", "original_text", "proposed_text", "rationale"]:
            assert field in item["properties"]
            assert field in item["required"]

    def test_action_and_kind_enums(self):
        item = SKILL_WEAVE_SCHEMA["properties"]["injections"]["items"]
        assert set(item["properties"]["action"]["enum"]) == {"add", "edit"}
        assert "summary" in item["properties"]["target_kind"]["enum"]

    def test_nullable_ids_use_anyof(self):
        item = SKILL_WEAVE_SCHEMA["properties"]["injections"]["items"]
        for field in ["node_id", "parent_node_id", "new_node_type"]:
            assert "anyOf" in item["properties"][field]
