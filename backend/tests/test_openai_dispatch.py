"""
Tests for the generalized OpenAI model dispatch in openai_wrapper.

Covers the routing decision (Responses API vs legacy chat.completions) and the
Responses-API call builder, which must pass the *real* model id (not a hardcoded
gpt-5.1) and place structured outputs in the top-level text.format argument.
"""

import json
import types

import openai_wrapper as ow


class TestDispatchHelpers:
    def test_gpt5_and_o_series_use_responses_api(self):
        assert ow._uses_responses_api("gpt-5.5") is True
        assert ow._uses_responses_api("gpt-5.4-mini") is True
        assert ow._uses_responses_api("o3") is True
        assert ow._uses_responses_api("o4-mini") is True

    def test_gpt4o_uses_chat_completions(self):
        assert ow._uses_responses_api("gpt-4o") is False
        assert ow._uses_responses_api("gpt-4o-mini") is False

    def test_unknown_new_model_defaults_to_responses_api(self):
        # A future id we don't recognize should route to the modern API.
        assert ow._uses_responses_api("gpt-6") is True

    def test_looks_like_openai_model(self):
        assert ow._looks_like_openai_model("gpt-5.5")
        assert ow._looks_like_openai_model("o4-mini")
        assert not ow._looks_like_openai_model("claude-opus-4-8")
        assert not ow._looks_like_openai_model("")


def _fake_client(capture):
    class _Responses:
        def create(self, **kwargs):
            capture.update(kwargs)
            return types.SimpleNamespace(
                output_text=json.dumps({"x": 1}),
                model="gpt-5.5",
                usage=types.SimpleNamespace(
                    output_tokens=1,
                    input_tokens=1,
                    output_tokens_details=types.SimpleNamespace(reasoning_tokens=0),
                ),
            )

    class _Client:
        responses = _Responses()

    return _Client()


class TestResponsesApiCall:
    SCHEMA = {
        "type": "object",
        "additionalProperties": False,
        "required": ["x"],
        "properties": {"x": {"type": "integer"}},
    }

    def test_passes_real_model_id(self):
        cap = {}
        out = ow._call_responses_api(
            _fake_client(cap), "gpt-5.5", "system JSON", "user", "medium", 60,
            schema=self.SCHEMA, schema_name="t",
        )
        assert cap["model"] == "gpt-5.5"
        assert out["model"] == "gpt-5.5"
        assert out["requested_model"] == "gpt-5.5"

    def test_none_reasoning_maps_to_minimal(self):
        cap = {}
        ow._call_responses_api(
            _fake_client(cap), "gpt-5.5", "system JSON", "user", "none", 60,
        )
        assert cap["reasoning"]["effort"] == "minimal"

    def test_structured_output_is_top_level_text_format(self):
        cap = {}
        ow._call_responses_api(
            _fake_client(cap), "gpt-5.5", "system JSON", "user", "low", 60,
            schema=self.SCHEMA, schema_name="job_analysis",
        )
        fmt = cap["text"]["format"]
        assert fmt["type"] == "json_schema"
        assert fmt["name"] == "job_analysis"
        assert fmt["strict"] is True
        # Must NOT be nested inside the input content parts (the old bug).
        assert "format" not in cap["input"][0]["content"][0]
