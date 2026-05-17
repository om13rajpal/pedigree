"""Tests for the Sigstore signer.

Most tests verify behavior when gitsign is NOT installed (the common dev
case). Integration tests that require gitsign on PATH are marked with
@pytest.mark.integration and can be skipped in CI.
"""

from __future__ import annotations

import shutil

import pytest
from pedigree_mcp.errors import SignerUnavailableError
from pedigree_mcp.signing.sigstore_signer import SigstoreSigner

# ---------------------------------------------------------------------------
# gitsign not on PATH (expected in most dev/test environments)
# ---------------------------------------------------------------------------


class TestSigstoreSignerUnavailable:
    """Tests for behavior when gitsign is not installed."""

    def test_raises_when_gitsign_missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Construction raises SignerUnavailableError when gitsign is not on PATH."""
        monkeypatch.setattr(shutil, "which", lambda _name: None)
        with pytest.raises(SignerUnavailableError, match="gitsign not found"):
            SigstoreSigner()

    def test_raises_when_gitsign_attest_missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Construction raises when gitsign exists but gitsign-attest does not."""

        def mock_which(name: str) -> str | None:
            if name == "gitsign":
                return "/usr/local/bin/gitsign"
            return None

        monkeypatch.setattr(shutil, "which", mock_which)
        with pytest.raises(SignerUnavailableError, match="gitsign-attest not found"):
            SigstoreSigner()

    def test_error_is_subclass_of_signing_error(self) -> None:
        """SignerUnavailableError is catchable as SigningError."""
        from pedigree_mcp.errors import SigningError

        assert issubclass(SignerUnavailableError, SigningError)


# ---------------------------------------------------------------------------
# Integration tests (only run when gitsign is installed)
# ---------------------------------------------------------------------------


_gitsign_available = shutil.which("gitsign") is not None


@pytest.mark.integration
@pytest.mark.skipif(not _gitsign_available, reason="gitsign not installed")
class TestSigstoreSignerIntegration:
    """Integration tests that require gitsign on PATH."""

    def test_construction_succeeds(self) -> None:
        """SigstoreSigner can be constructed when gitsign is available."""
        signer = SigstoreSigner(commit_sha="abc123")
        assert signer.identity.startswith("sigstore:")

    def test_sign_and_verify_round_trip(self) -> None:
        """Sign then verify returns the original statement bytes."""
        signer = SigstoreSigner(commit_sha="abc123")
        statement = b'{"test":"sigstore-integration"}'
        envelope = signer.sign(statement)
        recovered = signer.verify(envelope)
        assert recovered == statement
