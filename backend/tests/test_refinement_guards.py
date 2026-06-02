"""Tests for the 'polish, never invent' refinement guardrails."""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from refinement_guards import (  # noqa: E402
    extract_numbers,
    check_no_invented_numbers,
    check_no_invented_terms,
    audit_refinement,
)


def test_extract_numbers_handles_formats():
    nums = extract_numbers("Cut latency by 60%, saved $1,200,000 and ran 3.5x faster on 250 nodes")
    assert "60" in nums
    assert "1200000" in nums
    assert "3.5" in nums
    assert "250" in nums


def test_invented_number_is_flagged():
    original = "Improved pipeline performance and reliability"
    refined = "Improved pipeline performance by 40%, boosting reliability"
    report = check_no_invented_numbers(original, refined)
    assert report["ok"] is False
    assert "40" in report["invented_numbers"]


def test_preserved_number_is_allowed():
    original = "Reduced costs by 30% across the platform"
    refined = "Drove a 30% reduction in platform costs"
    assert check_no_invented_numbers(original, refined)["ok"] is True


def test_number_present_in_profile_corpus_is_allowed():
    # A figure the refinement surfaces may legitimately live elsewhere in the profile.
    original = "Led the migration effort"
    refined = "Led the migration of 12 services"
    assert check_no_invented_numbers(original, refined)["ok"] is False
    assert check_no_invented_numbers(original, refined, extra_corpus="Owned 12 services")["ok"] is True


def test_new_skill_term_is_flagged_as_warning():
    original = "Built data pipelines in Python"
    refined = "Built data pipelines in Python and Kubernetes"
    report = check_no_invented_terms(original, refined)
    assert report["ok"] is False
    assert "Kubernetes" in report["new_terms"]


def test_audit_separates_hard_violations_from_warnings():
    original = "Built services and improved throughput"
    refined = "Built services in Rust and improved throughput by 50%"
    report = audit_refinement(original, refined)
    assert report["hard_violation"] is True          # invented 50%
    assert "50" in report["invented_numbers"]
    assert any("Rust" in w for w in report["warnings"])  # advisory term warning
    assert report["ok"] is False


def test_clean_rephrase_passes():
    original = "Managed a team of 5 engineers delivering features on time"
    refined = "Led a 5-engineer team that consistently delivered features on schedule"
    report = audit_refinement(original, refined)
    assert report["hard_violation"] is False
    assert report["ok"] is True
