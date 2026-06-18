"""
Tests for the skill-weave human-voice sanitizer (strip_ai_dashes).

The hard product constraint is "no em-dashes / no '--'": a dash used as a clause
separator becomes a comma, while real hyphenated words are left intact.
"""

from ai_tailor_service import strip_ai_dashes


class TestStripAiDashes:
    def test_em_dash_becomes_comma(self):
        assert strip_ai_dashes("I used Databricks — mostly for ETL") == \
            "I used Databricks, mostly for ETL"

    def test_double_hyphen_becomes_comma(self):
        assert strip_ai_dashes("Built pipelines -- fast and clean") == \
            "Built pipelines, fast and clean"

    def test_en_dash_becomes_comma(self):
        assert strip_ai_dashes("Python – SQL – AWS") == "Python, SQL, AWS"

    def test_spaced_single_hyphen_becomes_comma(self):
        assert strip_ai_dashes("I did X - then Y") == "I did X, then Y"

    def test_hyphenated_words_preserved(self):
        assert strip_ai_dashes("data-driven, real-time work") == \
            "data-driven, real-time work"

    def test_no_dash_leak_after_strip(self):
        out = strip_ai_dashes("A—B -- C – D - E")
        assert "—" not in out and "--" not in out and "–" not in out

    def test_smart_quotes_normalized(self):
        assert strip_ai_dashes("“Databricks” is ‘fun’") == \
            '"Databricks" is \'fun\''

    def test_empty_and_none_safe(self):
        assert strip_ai_dashes("") == ""
        assert strip_ai_dashes(None) is None
