"""Signer protocol and StubSigner for Phase 3 testing.

Defines the abstract interface every signer must implement and provides
a StubSigner that returns deterministic dummy DSSE envelopes so the
attest/verify pipeline can be tested without real cryptographic keys.
"""

from __future__ import annotations

import base64
import json
from typing import Protocol, runtime_checkable


@runtime_checkable
class Signer(Protocol):
    """Protocol for cryptographic signers that produce DSSE envelopes.

    Implementations wrap different backends (Sigstore, ed25519) behind
    a uniform interface so the signing mechanism is swappable at runtime.
    """

    @property
    def identity(self) -> str:
        """Return a human-readable identity string for the signer.

        Returns:
            A string identifying the signer (e.g. OIDC subject, key fingerprint).
        """
        ...

    def sign(self, statement_bytes: bytes) -> bytes:
        """Sign an in-toto Statement and wrap it in a DSSE envelope.

        Args:
            statement_bytes: The canonical JSON-serialized in-toto Statement.

        Returns:
            The DSSE envelope bytes containing the signed Statement.

        Raises:
            SigningError: If signing fails for any reason.
        """
        ...

    def verify(self, envelope_bytes: bytes) -> bytes:
        """Verify a DSSE envelope and extract the payload.

        Args:
            envelope_bytes: The DSSE envelope bytes to verify.

        Returns:
            The verified payload bytes (the original Statement).

        Raises:
            VerificationError: If signature verification fails.
        """
        ...


# Constant marker identifying stub signatures so they are never confused with
# real cryptographic signatures in verification paths.
STUB_SIGNATURE_MARKER = "STUB_SIGNATURE_FOR_TESTING"


class StubSigner:
    """Deterministic stub signer for Phase 3 testing.

    Produces valid-looking DSSE envelopes with a known marker signature.
    Never use in production -- real signing implementations (Sigstore,
    ed25519) replace this in Phase 4.
    """

    @property
    def identity(self) -> str:
        """Return the stub signer identity.

        Returns:
            A fixed string identifying this as a stub signer.
        """
        return "stub-signer@pedigree.dev"

    def sign(self, statement_bytes: bytes) -> bytes:
        """Wrap the statement in a DSSE envelope with a stub signature.

        Args:
            statement_bytes: The canonical JSON-serialized in-toto Statement.

        Returns:
            A DSSE envelope with the payload and a stub signature.
        """
        payload_b64 = base64.b64encode(statement_bytes).decode("ascii")
        envelope = {
            "payloadType": "application/vnd.in-toto+json",
            "payload": payload_b64,
            "signatures": [
                {
                    "keyid": self.identity,
                    "sig": base64.b64encode(STUB_SIGNATURE_MARKER.encode("utf-8")).decode("ascii"),
                }
            ],
        }
        return json.dumps(envelope, separators=(",", ":")).encode("utf-8")

    def verify(self, envelope_bytes: bytes) -> bytes:
        """Extract and return the payload from a stub-signed DSSE envelope.

        Checks that the signature matches the stub marker. Does not perform
        real cryptographic verification.

        Args:
            envelope_bytes: The DSSE envelope bytes to verify.

        Returns:
            The payload bytes extracted from the envelope.

        Raises:
            VerificationError: If the envelope is malformed or the stub
                signature marker is missing.
        """
        from pedigree_mcp.errors import VerificationError

        try:
            envelope = json.loads(envelope_bytes)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise VerificationError(
                f"Failed to parse DSSE envelope: {exc}",
                context={"stage": "envelope_parse"},
            ) from exc

        signatures = envelope.get("signatures", [])
        if not signatures:
            raise VerificationError(
                "DSSE envelope contains no signatures",
                context={"stage": "signature_check"},
            )

        sig_bytes = base64.b64decode(signatures[0].get("sig", ""))
        if sig_bytes.decode("utf-8", errors="replace") != STUB_SIGNATURE_MARKER:
            raise VerificationError(
                "Stub signature marker not found -- this envelope was not signed by StubSigner",
                context={"stage": "signature_check"},
            )

        payload_b64 = envelope.get("payload", "")
        return base64.b64decode(payload_b64)
