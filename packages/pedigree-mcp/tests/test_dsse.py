"""Tests for the DSSE envelope module.

Covers PAE computation, envelope building, parsing, and round-trip
integrity. Also tests error handling for malformed inputs.
"""

from __future__ import annotations

import base64
import json

import pytest
from pedigree_mcp.errors import VerificationError
from pedigree_mcp.signing.dsse import (
    INTOTO_PAYLOAD_TYPE,
    DsseSignature,
    build_envelope,
    compute_pae,
    parse_envelope,
)

# ---------------------------------------------------------------------------
# PAE (Pre-Authentication Encoding)
# ---------------------------------------------------------------------------


class TestComputePae:
    """Tests for the DSSE Pre-Authentication Encoding function."""

    def test_pae_matches_expected_bytes(self) -> None:
        """PAE of a known payload type and body matches the DSSE spec format."""
        payload_type = "application/vnd.in-toto+json"
        payload = b'{"hello":"world"}'
        pae = compute_pae(payload_type, payload)

        type_bytes = payload_type.encode("utf-8")
        expected = (
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
        assert pae == expected

    def test_pae_empty_payload(self) -> None:
        """PAE with an empty payload still produces valid encoding."""
        pae = compute_pae("text/plain", b"")
        assert b"DSSEv1" in pae
        assert b" 0 " in pae

    def test_pae_unicode_type(self) -> None:
        """PAE correctly encodes a payload type with multi-byte UTF-8 chars."""
        payload_type = "type/é"  # e-acute
        payload = b"data"
        pae = compute_pae(payload_type, payload)
        type_bytes = payload_type.encode("utf-8")
        # Length should account for UTF-8 encoding (7 bytes, not 6 chars)
        assert str(len(type_bytes)).encode("ascii") in pae


# ---------------------------------------------------------------------------
# build_envelope
# ---------------------------------------------------------------------------


class TestBuildEnvelope:
    """Tests for DSSE envelope construction."""

    def test_build_produces_valid_json(self) -> None:
        payload = b'{"test":true}'
        sig = DsseSignature(
            keyid="test-key",
            sig=base64.b64encode(b"fake-sig").decode("ascii"),
        )
        result = build_envelope(INTOTO_PAYLOAD_TYPE, payload, [sig])
        parsed = json.loads(result)
        assert parsed["payloadType"] == INTOTO_PAYLOAD_TYPE
        assert "signatures" in parsed
        assert len(parsed["signatures"]) == 1

    def test_build_base64_encodes_payload(self) -> None:
        payload = b"hello-payload"
        sig = DsseSignature(
            keyid="k",
            sig=base64.b64encode(b"s").decode("ascii"),
        )
        result = build_envelope("type/test", payload, [sig])
        parsed = json.loads(result)
        decoded = base64.b64decode(parsed["payload"])
        assert decoded == payload

    def test_build_rejects_empty_signatures(self) -> None:
        with pytest.raises(VerificationError, match="at least one signature"):
            build_envelope(INTOTO_PAYLOAD_TYPE, b"payload", [])

    def test_build_multiple_signatures(self) -> None:
        payload = b"multi-sig-test"
        sigs = [
            DsseSignature(
                keyid=f"key-{i}",
                sig=base64.b64encode(f"sig-{i}".encode()).decode("ascii"),
            )
            for i in range(3)
        ]
        result = build_envelope(INTOTO_PAYLOAD_TYPE, payload, sigs)
        parsed = json.loads(result)
        assert len(parsed["signatures"]) == 3


# ---------------------------------------------------------------------------
# parse_envelope
# ---------------------------------------------------------------------------


class TestParseEnvelope:
    """Tests for DSSE envelope parsing and validation."""

    def test_parse_valid_envelope(self) -> None:
        payload = b'{"statement":"test"}'
        sig = DsseSignature(
            keyid="key-1",
            sig=base64.b64encode(b"sig-bytes").decode("ascii"),
        )
        envelope_bytes = build_envelope(INTOTO_PAYLOAD_TYPE, payload, [sig])
        envelope = parse_envelope(envelope_bytes)
        assert envelope.payload_type == INTOTO_PAYLOAD_TYPE
        assert len(envelope.signatures) == 1
        assert envelope.signatures[0].keyid == "key-1"

    def test_parse_rejects_non_json(self) -> None:
        with pytest.raises(VerificationError, match="not valid JSON"):
            parse_envelope(b"not-json-at-all")

    def test_parse_rejects_json_array(self) -> None:
        with pytest.raises(VerificationError, match="JSON object"):
            parse_envelope(b"[]")

    def test_parse_rejects_missing_payload_type(self) -> None:
        raw = json.dumps(
            {
                "payload": base64.b64encode(b"x").decode("ascii"),
                "signatures": [{"keyid": "k", "sig": base64.b64encode(b"s").decode("ascii")}],
            }
        ).encode("utf-8")
        with pytest.raises(VerificationError, match="payloadType"):
            parse_envelope(raw)

    def test_parse_rejects_missing_payload(self) -> None:
        raw = json.dumps(
            {
                "payloadType": INTOTO_PAYLOAD_TYPE,
                "signatures": [{"keyid": "k", "sig": base64.b64encode(b"s").decode("ascii")}],
            }
        ).encode("utf-8")
        with pytest.raises(VerificationError, match="payload"):
            parse_envelope(raw)

    def test_parse_rejects_missing_signatures(self) -> None:
        raw = json.dumps(
            {
                "payloadType": INTOTO_PAYLOAD_TYPE,
                "payload": base64.b64encode(b"x").decode("ascii"),
            }
        ).encode("utf-8")
        with pytest.raises(VerificationError, match="signatures"):
            parse_envelope(raw)

    def test_parse_rejects_empty_signatures_list(self) -> None:
        raw = json.dumps(
            {
                "payloadType": INTOTO_PAYLOAD_TYPE,
                "payload": base64.b64encode(b"x").decode("ascii"),
                "signatures": [],
            }
        ).encode("utf-8")
        with pytest.raises(VerificationError, match="validation failed"):
            parse_envelope(raw)

    def test_parse_rejects_bad_base64_payload(self) -> None:
        raw = json.dumps(
            {
                "payloadType": INTOTO_PAYLOAD_TYPE,
                "payload": "!!!not-base64!!!",
                "signatures": [{"keyid": "k", "sig": base64.b64encode(b"s").decode("ascii")}],
            }
        ).encode("utf-8")
        with pytest.raises(VerificationError, match="validation failed"):
            parse_envelope(raw)


# ---------------------------------------------------------------------------
# Round-trip tests
# ---------------------------------------------------------------------------


class TestDsseRoundTrip:
    """Tests that build -> parse -> decode produces the original payload."""

    def test_round_trip_simple(self) -> None:
        payload = b'{"round":"trip"}'
        sig = DsseSignature(
            keyid="rt-key",
            sig=base64.b64encode(b"rt-sig").decode("ascii"),
        )
        envelope_bytes = build_envelope(INTOTO_PAYLOAD_TYPE, payload, [sig])
        envelope = parse_envelope(envelope_bytes)
        decoded = envelope.decoded_payload()
        assert decoded == payload

    def test_round_trip_binary_payload(self) -> None:
        payload = bytes(range(256))
        sig = DsseSignature(
            keyid="bin-key",
            sig=base64.b64encode(b"bin-sig").decode("ascii"),
        )
        envelope_bytes = build_envelope("application/octet-stream", payload, [sig])
        envelope = parse_envelope(envelope_bytes)
        assert envelope.decoded_payload() == payload

    def test_round_trip_large_payload(self) -> None:
        payload = b"x" * 100_000
        sig = DsseSignature(
            keyid="big-key",
            sig=base64.b64encode(b"big-sig").decode("ascii"),
        )
        envelope_bytes = build_envelope(INTOTO_PAYLOAD_TYPE, payload, [sig])
        envelope = parse_envelope(envelope_bytes)
        assert envelope.decoded_payload() == payload

    def test_round_trip_preserves_signatures(self) -> None:
        payload = b"sig-test"
        sigs = [
            DsseSignature(
                keyid=f"key-{i}",
                sig=base64.b64encode(f"sig-{i}".encode()).decode("ascii"),
            )
            for i in range(2)
        ]
        envelope_bytes = build_envelope(INTOTO_PAYLOAD_TYPE, payload, sigs)
        envelope = parse_envelope(envelope_bytes)
        assert len(envelope.signatures) == 2
        assert envelope.signatures[0].keyid == "key-0"
        assert envelope.signatures[1].keyid == "key-1"
