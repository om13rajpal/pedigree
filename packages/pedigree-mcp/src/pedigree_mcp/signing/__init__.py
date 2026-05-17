"""Signer factory for the pedigree-mcp server.

Provides get_signer() which returns the appropriate Signer implementation
based on the PEDIGREE_SIGNER environment variable. Defaults to Sigstore
with automatic fallback to ed25519 when gitsign is unavailable.
"""

from __future__ import annotations

import os

from pedigree_mcp.errors import ConfigError, SignerUnavailableError
from pedigree_mcp.logger import get_logger
from pedigree_mcp.signing.ed25519_signer import Ed25519Signer
from pedigree_mcp.signing.interface import Signer, StubSigner
from pedigree_mcp.signing.sigstore_signer import SigstoreSigner

_log = get_logger(__name__)


def get_signer() -> Signer:
    """Return the active Signer implementation based on configuration.

    Reads PEDIGREE_SIGNER from the environment:
      - "sigstore" (default): try SigstoreSigner, fall back to Ed25519Signer.
      - "ed25519": always use Ed25519Signer.
      - "stub": use StubSigner (for Phase 3 compatibility and tests).

    Returns:
        A Signer implementation ready for use.

    Raises:
        ConfigError: If PEDIGREE_SIGNER contains an unrecognized value.
    """
    mode = os.environ.get("PEDIGREE_SIGNER", "sigstore")

    if mode == "sigstore":
        try:
            return SigstoreSigner()
        except SignerUnavailableError as exc:
            _log.warning(
                "sigstore_unavailable_fallback_ed25519",
                reason=str(exc),
            )
            return Ed25519Signer()
    elif mode == "ed25519":
        return Ed25519Signer()
    elif mode == "stub":
        return StubSigner()
    else:
        raise ConfigError(
            f"Unknown PEDIGREE_SIGNER value: {mode!r} -- expected 'sigstore', 'ed25519', or 'stub'",
            context={"env_var": "PEDIGREE_SIGNER", "value": mode},
        )


__all__ = [
    "Ed25519Signer",
    "Signer",
    "SigstoreSigner",
    "StubSigner",
    "get_signer",
]
