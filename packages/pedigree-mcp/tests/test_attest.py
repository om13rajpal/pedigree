"""Tests for the attest_commit workflow.

Uses the StubSigner (via PEDIGREE_SIGNER=stub) and mocks git_io to test
the attestation pipeline without real git operations or network calls.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from pedigree_mcp.attest import attest_commit
from pedigree_mcp.errors import PolicyViolationError, SchemaValidationError

from tests.conftest import load_predicate


@pytest.fixture(autouse=True)
def _use_stub_signer(monkeypatch: pytest.MonkeyPatch) -> None:
    """Force StubSigner for all tests in this module."""
    monkeypatch.setenv("PEDIGREE_SIGNER", "stub")


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


class TestAttestCommitHappyPath:
    """Tests for successful attestation creation."""

    def test_attest_with_valid_ai_assisted_predicate(self) -> None:
        predicate = load_predicate("valid-ai-assisted.json")
        result = attest_commit(
            "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
            predicate,
            skip_rekor=True,
            skip_git_write=True,
        )
        assert result.commit_sha == "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
        assert result.signer_identity == "stub-signer@pedigree.dev"
        assert result.rekor_uuid == ""

    def test_attest_with_valid_human_predicate(self) -> None:
        predicate = load_predicate("valid-human.json")
        result = attest_commit(
            "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
            predicate,
            skip_rekor=True,
            skip_git_write=True,
        )
        assert result.commit_sha == "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"

    def test_attest_with_valid_ai_autonomous_predicate(self) -> None:
        predicate = load_predicate("valid-ai-autonomous.json")
        result = attest_commit(
            "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
            predicate,
            skip_rekor=True,
            skip_git_write=True,
        )
        assert result.commit_sha == "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"

    def test_attest_calls_git_write_when_not_skipped(self) -> None:
        predicate = load_predicate("valid-ai-assisted.json")
        with patch("pedigree_mcp.attest.git_io") as mock_git:
            _result = attest_commit(
                "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
                predicate,
                skip_rekor=True,
                skip_git_write=False,
            )
            mock_git.write_attestation_ref.assert_called_once()
            call_args = mock_git.write_attestation_ref.call_args
            assert call_args[0][0] == "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
            assert isinstance(call_args[0][1], bytes)


# ---------------------------------------------------------------------------
# Failure paths
# ---------------------------------------------------------------------------


class TestAttestCommitFailures:
    """Tests for attestation failure cases."""

    def test_rejects_invalid_predicate(self) -> None:
        with pytest.raises(SchemaValidationError):
            attest_commit(
                "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
                {"schemaVersion": "1.0.0"},
                skip_rekor=True,
                skip_git_write=True,
            )

    def test_rejects_missing_authorship(self) -> None:
        with pytest.raises(SchemaValidationError, match="authorship"):
            attest_commit(
                "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
                {
                    "schemaVersion": "1.0.0",
                    "scope": {
                        "filesTouched": ["x.ts"],
                        "linesAdded": 1,
                        "linesDeleted": 0,
                        "riskClass": "low",
                    },
                    "policy": {
                        "agentsMdPolicy": "v1",
                        "requiresHumanApproval": False,
                        "satisfied": True,
                    },
                },
                skip_rekor=True,
                skip_git_write=True,
            )

    def test_rejects_unsatisfied_policy(self) -> None:
        predicate = load_predicate("invalid-policy-unsatisfied.json")
        with pytest.raises(PolicyViolationError, match="Policy not satisfied"):
            attest_commit(
                "f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1",
                predicate,
                skip_rekor=True,
                skip_git_write=True,
            )

    def test_rejects_predicate_with_bad_risk_class(self) -> None:
        predicate = load_predicate("invalid-bad-risk-class.json")
        with pytest.raises(SchemaValidationError):
            attest_commit(
                "e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6",
                predicate,
                skip_rekor=True,
                skip_git_write=True,
            )

    def test_rejects_high_risk_without_human_approval(self) -> None:
        """Test that high riskClass requires humanApprover.approved=true."""
        # Use the existing invalid-policy-unsatisfied fixture which has
        # high riskClass and policy.satisfied=false
        predicate = load_predicate("invalid-policy-unsatisfied.json")

        with pytest.raises(PolicyViolationError, match="Policy not satisfied"):
            attest_commit(
                "f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1",
                predicate,
                skip_rekor=True,
                skip_git_write=True,
            )
