"""Tests for the Ed25519 fallback signer.

Uses temporary directories for key storage to avoid polluting ~/.pedigree.
Covers sign/verify round-trips, key generation, permissions, identity
format, and cross-key verification failure.
"""

from __future__ import annotations

import os
import stat
from pathlib import Path  # noqa: TCH003 -- used at runtime in fixtures

import pytest
from pedigree_mcp.errors import VerificationError
from pedigree_mcp.signing.ed25519_signer import Ed25519Signer

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def keys_dir(tmp_path: Path) -> Path:
    """Return a temporary directory for key storage."""
    d = tmp_path / "keys"
    d.mkdir()
    return d


@pytest.fixture()
def signer(keys_dir: Path) -> Ed25519Signer:
    """Return an Ed25519Signer using a temp keys directory."""
    return Ed25519Signer(repo_name="test-repo", keys_dir=keys_dir)


# ---------------------------------------------------------------------------
# Key generation
# ---------------------------------------------------------------------------


class TestKeyGeneration:
    """Tests for Ed25519 key generation and persistence."""

    def test_generates_key_files(self, keys_dir: Path) -> None:
        """First construction generates private and public key files."""
        Ed25519Signer(repo_name="gen-test", keys_dir=keys_dir)
        assert (keys_dir / "gen-test.ed25519").exists()
        assert (keys_dir / "gen-test.ed25519.pub").exists()

    def test_private_key_permissions(self, keys_dir: Path) -> None:
        """Private key file has chmod 600 (owner read/write only)."""
        Ed25519Signer(repo_name="perm-test", keys_dir=keys_dir)
        private_path = keys_dir / "perm-test.ed25519"
        file_stat = os.stat(private_path)
        mode = stat.S_IMODE(file_stat.st_mode)
        assert mode == 0o600, f"Expected 0o600, got {oct(mode)}"

    def test_loads_existing_key(self, keys_dir: Path) -> None:
        """Second construction loads the existing key rather than regenerating."""
        signer1 = Ed25519Signer(repo_name="reload-test", keys_dir=keys_dir)
        signer2 = Ed25519Signer(repo_name="reload-test", keys_dir=keys_dir)
        assert signer1.identity == signer2.identity

    def test_different_repos_get_different_keys(self, keys_dir: Path) -> None:
        """Different repo names produce different keypairs."""
        s1 = Ed25519Signer(repo_name="repo-a", keys_dir=keys_dir)
        s2 = Ed25519Signer(repo_name="repo-b", keys_dir=keys_dir)
        assert s1.identity != s2.identity

    def test_creates_keys_dir_if_missing(self, tmp_path: Path) -> None:
        """Signer creates the keys directory if it does not exist."""
        deep_dir = tmp_path / "nested" / "deep" / "keys"
        Ed25519Signer(repo_name="mkdir-test", keys_dir=deep_dir)
        assert deep_dir.exists()
        assert (deep_dir / "mkdir-test.ed25519").exists()


# ---------------------------------------------------------------------------
# Identity
# ---------------------------------------------------------------------------


class TestIdentity:
    """Tests for the ed25519 signer identity format."""

    def test_identity_format(self, signer: Ed25519Signer) -> None:
        """Identity matches the expected ed25519:<hex-sha256> pattern."""
        identity = signer.identity
        assert identity.startswith("ed25519:")
        hex_part = identity.split(":", 1)[1]
        assert len(hex_part) == 64  # SHA-256 hex
        assert all(c in "0123456789abcdef" for c in hex_part)

    def test_identity_is_stable(self, signer: Ed25519Signer) -> None:
        """Calling identity multiple times returns the same value."""
        assert signer.identity == signer.identity


# ---------------------------------------------------------------------------
# Sign / verify round-trip
# ---------------------------------------------------------------------------


class TestSignVerify:
    """Tests for ed25519 sign and verify operations."""

    def test_round_trip_succeeds(self, signer: Ed25519Signer) -> None:
        """Sign then verify returns the original statement bytes."""
        statement = b'{"_type":"https://in-toto.io/Statement/v1","test":true}'
        envelope = signer.sign(statement)
        recovered = signer.verify(envelope)
        assert recovered == statement

    def test_round_trip_with_large_payload(self, signer: Ed25519Signer) -> None:
        """Sign/verify works with a large payload."""
        statement = b"A" * 50_000
        envelope = signer.sign(statement)
        recovered = signer.verify(envelope)
        assert recovered == statement

    def test_round_trip_with_binary_payload(self, signer: Ed25519Signer) -> None:
        """Sign/verify works with arbitrary binary data."""
        statement = bytes(range(256)) * 4
        envelope = signer.sign(statement)
        recovered = signer.verify(envelope)
        assert recovered == statement

    def test_verify_with_wrong_key_fails(self, keys_dir: Path) -> None:
        """Verifying with a different key than the one that signed fails."""
        signer_a = Ed25519Signer(repo_name="signer-a", keys_dir=keys_dir)
        signer_b = Ed25519Signer(repo_name="signer-b", keys_dir=keys_dir)

        statement = b'{"test":"cross-key"}'
        envelope = signer_a.sign(statement)

        with pytest.raises(VerificationError, match="verification failed"):
            signer_b.verify(envelope)

    def test_verify_rejects_tampered_payload(self, signer: Ed25519Signer) -> None:
        """Modifying the payload in the envelope causes verification failure."""
        import base64
        import json

        statement = b'{"original":"data"}'
        envelope = signer.sign(statement)

        # Tamper with the payload
        envelope_dict = json.loads(envelope)
        envelope_dict["payload"] = base64.b64encode(b'{"tampered":"data"}').decode("ascii")
        tampered = json.dumps(envelope_dict, separators=(",", ":")).encode("utf-8")

        with pytest.raises(VerificationError):
            signer.verify(tampered)

    def test_verify_rejects_tampered_signature(self, signer: Ed25519Signer) -> None:
        """Modifying the signature in the envelope causes verification failure."""
        import base64
        import json

        statement = b'{"original":"data"}'
        envelope = signer.sign(statement)

        # Tamper with the signature
        envelope_dict = json.loads(envelope)
        envelope_dict["signatures"][0]["sig"] = base64.b64encode(b"bad-sig-bytes" * 5).decode(
            "ascii"
        )
        tampered = json.dumps(envelope_dict, separators=(",", ":")).encode("utf-8")

        with pytest.raises(VerificationError):
            signer.verify(tampered)

    def test_verify_rejects_malformed_envelope(self, signer: Ed25519Signer) -> None:
        """Verifying non-JSON bytes raises VerificationError."""
        with pytest.raises(VerificationError):
            signer.verify(b"not-an-envelope")


# ---------------------------------------------------------------------------
# No private key leakage
# ---------------------------------------------------------------------------


class TestNoKeyLeakage:
    """Ensure private key material never appears in identity or sign output."""

    def test_identity_does_not_contain_private_key(self, signer: Ed25519Signer) -> None:
        """The identity string does not contain the private key."""
        # The identity is a public key hash, not the raw key
        assert "PRIVATE" not in signer.identity.upper()

    def test_envelope_does_not_contain_private_key(self, signer: Ed25519Signer) -> None:
        """The DSSE envelope bytes do not contain the PEM private key."""
        statement = b'{"test":"leakage"}'
        envelope = signer.sign(statement)
        envelope_str = envelope.decode("utf-8")
        assert "PRIVATE" not in envelope_str.upper()
        assert "BEGIN" not in envelope_str  # No PEM markers
