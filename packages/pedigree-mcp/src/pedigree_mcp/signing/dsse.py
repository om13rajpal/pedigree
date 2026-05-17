"""DSSE (Dead Simple Signing Envelope) pure functions.

Provides Pre-Authentication Encoding, envelope construction, and envelope
parsing per the DSSE specification. All functions are pure -- no side
effects, no network, no filesystem access.
"""

from __future__ import annotations

import base64
import json
from typing import Final

from pydantic import BaseModel, Field, field_validator

from pedigree_mcp.errors import VerificationError

# The payload type for in-toto attestations inside DSSE envelopes.
INTOTO_PAYLOAD_TYPE: Final[str] = "application/vnd.in-toto+json"


class DsseSignature(BaseModel):
    """A single signature entry inside a DSSE envelope.

    Attributes:
        keyid: Identifier for the signing key or identity.
        sig: Base64-encoded signature bytes.
    """

    keyid: str
    sig: str

    @field_validator("sig")
    @classmethod
    def _validate_base64(cls, v: str) -> str:
        """Verify the sig value is valid base64."""
        try:
            base64.b64decode(v, validate=True)
        except Exception as exc:
            msg = f"sig must be valid base64: {exc}"
            raise ValueError(msg) from exc
        return v


class DsseEnvelope(BaseModel):
    """Parsed DSSE envelope with validated structure.

    Attributes:
        payload_type: The media type of the payload (must be in-toto JSON).
        payload: Base64-encoded payload bytes.
        signatures: List of signature entries (at least one required).
    """

    payload_type: str = Field(alias="payloadType")
    payload: str
    signatures: list[DsseSignature] = Field(min_length=1)

    model_config = {"populate_by_name": True}

    @field_validator("payload")
    @classmethod
    def _validate_payload_base64(cls, v: str) -> str:
        """Verify the payload value is valid base64."""
        try:
            base64.b64decode(v, validate=True)
        except Exception as exc:
            msg = f"payload must be valid base64: {exc}"
            raise ValueError(msg) from exc
        return v

    def decoded_payload(self) -> bytes:
        """Decode and return the raw payload bytes.

        Returns:
            The original payload bytes before base64 encoding.
        """
        return base64.b64decode(self.payload)


def compute_pae(payload_type: str, payload: bytes) -> bytes:
    """Compute the DSSE Pre-Authentication Encoding.

    The PAE is defined as:
        "DSSEv1" SP LEN(type) SP type SP LEN(body) SP body

    where SP is a space (0x20) and LEN is the ASCII decimal length.

    Args:
        payload_type: The media type string (e.g. "application/vnd.in-toto+json").
        payload: The raw payload bytes to be signed.

    Returns:
        The PAE bytes ready to be fed into a signing function.
    """
    type_bytes = payload_type.encode("utf-8")
    return (
        b"DSSEv1"
        + b" "
        + str(len(type_bytes)).encode("ascii")
        + b" "
        + type_bytes
        + b" "
        + str(len(payload)).encode("ascii")
        + b" "
        + payload
    )


def build_envelope(
    payload_type: str,
    payload: bytes,
    signatures: list[DsseSignature],
) -> bytes:
    """Build a DSSE JSON envelope from a payload and signatures.

    Args:
        payload_type: The media type of the payload.
        payload: The raw payload bytes (will be base64-encoded in the envelope).
        signatures: One or more signatures to include.

    Returns:
        The canonical JSON bytes of the DSSE envelope.

    Raises:
        VerificationError: If no signatures are provided.
    """
    if not signatures:
        raise VerificationError(
            "DSSE envelope requires at least one signature",
            context={"stage": "envelope_build"},
        )

    payload_b64 = base64.b64encode(payload).decode("ascii")
    envelope_dict = {
        "payloadType": payload_type,
        "payload": payload_b64,
        "signatures": [{"keyid": s.keyid, "sig": s.sig} for s in signatures],
    }
    return json.dumps(envelope_dict, separators=(",", ":")).encode("utf-8")


def parse_envelope(envelope_bytes: bytes) -> DsseEnvelope:
    """Parse and validate a DSSE envelope from raw bytes.

    Validates JSON structure, base64 fields, and the presence of at least
    one signature.

    Args:
        envelope_bytes: The raw bytes of a JSON DSSE envelope.

    Returns:
        A validated DsseEnvelope instance.

    Raises:
        VerificationError: If the bytes are not valid JSON, required fields
            are missing, base64 is malformed, or no signatures are present.
    """
    try:
        raw = json.loads(envelope_bytes)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise VerificationError(
            f"DSSE envelope is not valid JSON: {exc}",
            context={"stage": "envelope_parse"},
        ) from exc

    if not isinstance(raw, dict):
        raise VerificationError(
            "DSSE envelope must be a JSON object",
            context={"stage": "envelope_parse"},
        )

    required_fields = ("payloadType", "payload", "signatures")
    for field in required_fields:
        if field not in raw:
            raise VerificationError(
                f"DSSE envelope missing required field: {field}",
                context={"stage": "envelope_parse", "field": field},
            )

    try:
        return DsseEnvelope.model_validate(raw)
    except Exception as exc:
        raise VerificationError(
            f"DSSE envelope validation failed: {exc}",
            context={"stage": "envelope_parse"},
        ) from exc
