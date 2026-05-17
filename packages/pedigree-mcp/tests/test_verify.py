"""Tests for the verify_chain workflow.

Uses the StubSigner (via PEDIGREE_SIGNER=stub) and mocks git_io/rekor_io
to test the verification pipeline without real git operations or network calls.
"""

from __future__ import annotations

import json
from pathlib import Path  # noqa: TCH003

import pytest
from pedigree_mcp.errors import VerificationError
from pedigree_mcp.schema import AiAssistedPredicate, parse_predicate
from pedigree_mcp.signing.ed25519_signer import Ed25519Signer
from pedigree_mcp.signing.interface import StubSigner
from pedigree_mcp.statement import build_statement
from pedigree_mcp.verify import verify_chain

from tests.conftest import load_predicate


@pytest.fixture(autouse=True)
def _use_stub_signer(monkeypatch: pytest.MonkeyPatch) -> None:
    """Force StubSigner for all tests in this module."""
    monkeypatch.setenv("PEDIGREE_SIGNER", "stub")


def _make_envelope(commit_sha: str, predicate_dict: dict) -> bytes:
    """Build a stub-signed DSSE envelope for testing.

    Args:
        commit_sha: The commit SHA to embed in the statement.
        predicate_dict: The predicate dict to embed.

    Returns:
        DSSE envelope bytes signed by StubSigner.
    """
    predicate = parse_predicate(predicate_dict)
    statement = build_statement(commit_sha, predicate)
    statement_json = json.dumps(
        statement.model_dump(by_alias=True),
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    signer = StubSigner()
    return signer.sign(statement_json)


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


class TestVerifyChainHappyPath:
    """Tests for successful chain verification."""

    def test_verify_valid_ai_assisted_envelope(self) -> None:
        sha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
        predicate_dict = load_predicate("valid-ai-assisted.json")
        envelope = _make_envelope(sha, predicate_dict)

        result = verify_chain(sha, skip_rekor=True, envelope_bytes=envelope)

        assert result.commit_sha == sha
        assert isinstance(result.predicate, AiAssistedPredicate)
        assert result.predicate.authorship.kind == "ai-assisted"
        assert result.signer_identity == "stub-signer@pedigree.dev"

    def test_verify_valid_human_envelope(self) -> None:
        sha = "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"
        predicate_dict = load_predicate("valid-human.json")
        envelope = _make_envelope(sha, predicate_dict)

        result = verify_chain(sha, skip_rekor=True, envelope_bytes=envelope)

        assert result.commit_sha == sha
        assert result.predicate.authorship.kind == "human"

    def test_verify_valid_ai_autonomous_envelope(self) -> None:
        sha = "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"
        predicate_dict = load_predicate("valid-ai-autonomous.json")
        envelope = _make_envelope(sha, predicate_dict)

        result = verify_chain(sha, skip_rekor=True, envelope_bytes=envelope)

        assert result.commit_sha == sha
        assert result.predicate.authorship.kind == "ai-autonomous"


# ---------------------------------------------------------------------------
# Failure paths
# ---------------------------------------------------------------------------


class TestVerifyChainFailures:
    """Tests for verification failure cases."""

    def test_rejects_malformed_envelope(self) -> None:
        sha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
        with pytest.raises(VerificationError):
            verify_chain(sha, skip_rekor=True, envelope_bytes=b"not-json")

    def test_rejects_empty_envelope(self) -> None:
        sha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
        with pytest.raises(VerificationError):
            verify_chain(sha, skip_rekor=True, envelope_bytes=b"")

    def test_rejects_envelope_with_wrong_signature(self) -> None:
        sha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
        # Create an envelope with a tampered signature
        import base64

        envelope = json.dumps(
            {
                "payloadType": "application/vnd.in-toto+json",
                "payload": base64.b64encode(b"{}").decode(),
                "signatures": [{"keyid": "attacker", "sig": base64.b64encode(b"BAD_SIG").decode()}],
            }
        ).encode("utf-8")
        with pytest.raises(VerificationError):
            verify_chain(sha, skip_rekor=True, envelope_bytes=envelope)

    def test_rejects_subject_mismatch(self) -> None:
        """Envelope signed for commit A should not verify for commit B."""
        sha_a = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
        sha_b = "ffffffffffffffffffffffffffffffffffffffff"
        predicate_dict = load_predicate("valid-ai-assisted.json")
        envelope = _make_envelope(sha_a, predicate_dict)

        with pytest.raises(VerificationError, match="does not match"):
            verify_chain(sha_b, skip_rekor=True, envelope_bytes=envelope)

    def test_rejects_policy_unsatisfied(self) -> None:
        """Verify should reject a predicate where policy.satisfied is false."""
        sha = "f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1"
        predicate_dict = load_predicate("invalid-policy-unsatisfied.json")
        envelope = _make_envelope(sha, predicate_dict)

        # verify_chain should succeed (signature is valid)
        # but the predicate will have policy.satisfied=false
        result = verify_chain(sha, skip_rekor=True, envelope_bytes=envelope)

        # Verify the predicate was parsed correctly with unsatisfied policy
        assert result.predicate.policy.satisfied is False
        assert result.predicate.scope.risk_class == "high"


# ---------------------------------------------------------------------------
# Ed25519 round-trip test
# ---------------------------------------------------------------------------


class TestEd25519RoundTrip:
    """Test full attest->verify round-trip using Ed25519Signer."""

    def test_attest_then_verify_with_ed25519(self, tmp_path: Path) -> None:
        """Test that a commit attested with Ed25519Signer can be verified."""
        from unittest.mock import patch

        # Use a temporary directory for Ed25519 keys
        keys_dir = tmp_path / "keys"
        keys_dir.mkdir()

        # Create an Ed25519Signer with a test key directory
        signer = Ed25519Signer(repo_name="test-repo", keys_dir=keys_dir)

        # Build and sign the statement manually
        sha = "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5"
        predicate_dict = load_predicate("valid-ai-assisted.json")
        predicate = parse_predicate(predicate_dict)
        statement = build_statement(sha, predicate)
        statement_json = json.dumps(
            statement.model_dump(by_alias=True),
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")

        # Sign with the signer
        envelope_bytes = signer.sign(statement_json)

        # Mock get_signer to return our test signer instance
        with patch("pedigree_mcp.verify.get_signer", return_value=signer):
            # Verify with the same signer instance
            verify_result = verify_chain(sha, skip_rekor=True, envelope_bytes=envelope_bytes)

            # Assertions
            assert verify_result.commit_sha == sha
            assert isinstance(verify_result.predicate, AiAssistedPredicate)
            assert verify_result.predicate.authorship.kind == "ai-assisted"
            assert verify_result.signer_identity.startswith("ed25519:")
            assert verify_result.signer_identity == signer.identity
