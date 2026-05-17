"""Tests for the signer factory (get_signer).

Verifies environment-driven signer selection, Sigstore-to-ed25519
fallback behavior, and error handling for unknown signer modes.
"""

from __future__ import annotations

import pytest
from pedigree_mcp.errors import ConfigError
from pedigree_mcp.signing import get_signer
from pedigree_mcp.signing.ed25519_signer import Ed25519Signer
from pedigree_mcp.signing.interface import StubSigner


class TestGetSigner:
    """Tests for the get_signer factory function."""

    def test_stub_mode_returns_stub_signer(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """PEDIGREE_SIGNER=stub returns a StubSigner."""
        monkeypatch.setenv("PEDIGREE_SIGNER", "stub")
        signer = get_signer()
        assert isinstance(signer, StubSigner)

    def test_ed25519_mode_returns_ed25519_signer(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: object
    ) -> None:
        """PEDIGREE_SIGNER=ed25519 returns an Ed25519Signer."""
        monkeypatch.setenv("PEDIGREE_SIGNER", "ed25519")
        signer = get_signer()
        assert isinstance(signer, Ed25519Signer)

    def test_sigstore_falls_back_to_ed25519(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """PEDIGREE_SIGNER=sigstore falls back to Ed25519 when gitsign is missing."""
        monkeypatch.setenv("PEDIGREE_SIGNER", "sigstore")
        # gitsign should not be on PATH in test environments
        signer = get_signer()
        assert isinstance(signer, Ed25519Signer)

    def test_default_mode_is_sigstore_fallback(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """No PEDIGREE_SIGNER env var defaults to sigstore (falls back to ed25519)."""
        monkeypatch.delenv("PEDIGREE_SIGNER", raising=False)
        signer = get_signer()
        # Without gitsign on PATH, falls back to Ed25519
        assert isinstance(signer, Ed25519Signer)

    def test_unknown_mode_raises_config_error(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Unknown PEDIGREE_SIGNER value raises ConfigError."""
        monkeypatch.setenv("PEDIGREE_SIGNER", "quantum-signer")
        with pytest.raises(ConfigError, match="quantum-signer"):
            get_signer()
