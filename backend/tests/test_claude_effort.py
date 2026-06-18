"""
Tests for Claude thinking-effort resolution and structured-output JSON extraction
(output_config.format path, which is compatible with extended thinking).
"""

import pytest
from ai_tailor_service import (
    _resolve_claude_effort,
    _extract_claude_json,
    DEFAULT_CLAUDE_EFFORT,
    VALID_CLAUDE_EFFORT,
)


class _Block:
    """Minimal stand-in for an Anthropic response content block."""

    def __init__(self, type, text=None, input=None):
        self.type = type
        if text is not None:
            self.text = text
        if input is not None:
            self.input = input


class _Resp:
    def __init__(self, content):
        self.content = content


class TestResolveClaudeEffort:
    def test_default_is_high(self):
        assert DEFAULT_CLAUDE_EFFORT == "high"
        assert _resolve_claude_effort(None) == "high"
        assert _resolve_claude_effort("") == "high"

    def test_valid_levels_passthrough(self):
        for level in ["off", "low", "medium", "high", "max"]:
            assert _resolve_claude_effort(level) == level

    def test_case_and_whitespace_normalized(self):
        assert _resolve_claude_effort("  MAX ") == "max"
        assert _resolve_claude_effort("High") == "high"

    def test_invalid_falls_back_to_default(self):
        assert _resolve_claude_effort("turbo") == "high"
        assert _resolve_claude_effort("xhigh") == "high"  # not exposed in our UI set

    def test_valid_set_contents(self):
        assert VALID_CLAUDE_EFFORT == {"off", "low", "medium", "high", "max"}


class TestExtractClaudeJson:
    def test_plain_text_block(self):
        resp = _Resp([_Block("text", text='{"a": 1, "b": "x"}')])
        assert _extract_claude_json(resp) == {"a": 1, "b": "x"}

    def test_skips_leading_thinking_block(self):
        resp = _Resp([
            _Block("thinking", text="let me reason about this..."),
            _Block("text", text='{"ok": true}'),
        ])
        assert _extract_claude_json(resp) == {"ok": True}

    def test_tool_use_block_is_honored(self):
        # Back-compat: a tool_use response still parses via its input.
        resp = _Resp([_Block("tool_use", input={"verdict": "SHOULD_APPLY"})])
        assert _extract_claude_json(resp) == {"verdict": "SHOULD_APPLY"}

    def test_strips_code_fences(self):
        resp = _Resp([_Block("text", text='```json\n{"x": 2}\n```')])
        assert _extract_claude_json(resp) == {"x": 2}

    def test_extracts_object_with_surrounding_prose(self):
        resp = _Resp([_Block("text", text='Here you go: {"y": 3} thanks')])
        assert _extract_claude_json(resp) == {"y": 3}

    def test_empty_content_raises(self):
        with pytest.raises(ValueError):
            _extract_claude_json(_Resp([]))

    def test_only_thinking_block_raises(self):
        with pytest.raises(ValueError):
            _extract_claude_json(_Resp([_Block("thinking", text="...")]))
