"""Health check tool -- verifies system readiness for attestation operations.

Checks signing backend availability (gitsign or ed25519 keys), git accessibility,
and repository status. Returns a structured report for diagnostics.
"""

from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from pedigree_mcp.constants import DEFAULT_TIMEOUT_S
from pedigree_mcp.errors import PedigreeError
from pedigree_mcp.logger import get_logger

_log = get_logger(__name__)


class HealthCheckError(PedigreeError):
    """Raised when health check encounters a critical failure."""


@dataclass(frozen=True)
class HealthStatus:
    """Result of a health check operation.

    Attributes:
        signer_type: Type of signer available ("sigstore", "ed25519", or "none").
        signer_identity: Identity string for the active signer, or error message.
        git_available: Whether git is accessible on PATH.
        repo_root: Absolute path to git repository root, or None if not in a repo.
        tools_registered: List of MCP tool names registered in the server.
    """

    signer_type: str
    signer_identity: str
    git_available: bool
    repo_root: str | None
    tools_registered: list[str]


def _check_git_availability() -> bool:
    """Check if git is available on PATH.

    Returns:
        True if git is accessible, False otherwise.
    """
    return shutil.which("git") is not None


def _get_repo_root() -> str | None:
    """Get the root directory of the current git repository.

    Returns:
        Absolute path to the repository root, or None if not in a git repo.
    """
    if not _check_git_availability():
        return None

    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            timeout=DEFAULT_TIMEOUT_S,
            check=False,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, OSError, Exception):
        pass

    return None


def _check_sigstore_availability() -> tuple[bool, str]:
    """Check if Sigstore (gitsign) is available.

    Returns:
        A tuple of (available, identity_or_error).
        If available is True, identity_or_error contains the Sigstore identity.
        If available is False, identity_or_error contains an error message.
    """
    gitsign_path = shutil.which("gitsign")
    gitsign_attest_path = shutil.which("gitsign-attest")

    if gitsign_path is None:
        return False, "gitsign not found on PATH"
    if gitsign_attest_path is None:
        return False, "gitsign-attest not found on PATH"

    # Try to get the Sigstore identity
    try:
        result = subprocess.run(
            [gitsign_path, "show"],
            capture_output=True,
            text=True,
            timeout=DEFAULT_TIMEOUT_S,
            check=False,
        )
        if result.returncode == 0 and result.stdout.strip():
            return True, f"sigstore:{result.stdout.strip()}"
    except (subprocess.TimeoutExpired, OSError) as exc:
        return True, f"sigstore:error-querying-identity ({type(exc).__name__})"

    return True, "sigstore:pending-oidc-auth"


def _check_ed25519_availability() -> tuple[bool, str]:
    """Check if ed25519 keys are available.

    Returns:
        A tuple of (available, identity_or_error).
        If available is True, identity_or_error contains the key location.
        If available is False, identity_or_error contains an error message.
    """
    keys_dir = Path.home() / ".pedigree" / "keys"

    # Check if keys directory exists
    if not keys_dir.exists():
        return False, "keys directory does not exist (~/.pedigree/keys)"

    # Look for any .priv files (private keys)
    priv_keys = list(keys_dir.glob("*.priv"))
    if not priv_keys:
        return False, "no private keys found in ~/.pedigree/keys"

    # Return the first key found
    key_name = priv_keys[0].stem
    return True, f"ed25519:{key_name}"


def health_check() -> HealthStatus:
    """Perform a comprehensive health check of the pedigree-mcp system.

    Checks:
      1. Signing backend availability (Sigstore or ed25519)
      2. Git accessibility and repository status
      3. Registered MCP tools

    Returns:
        A HealthStatus dataclass with diagnostic information.

    Raises:
        HealthCheckError: If a critical component check fails unexpectedly.
    """
    _log.info("health_check_started")

    # Check git availability
    git_available = _check_git_availability()
    repo_root = _get_repo_root() if git_available else None

    # Check signing backends (prefer Sigstore, fall back to ed25519)
    signer_type = "none"
    signer_identity = "no signer available"

    sigstore_available, sigstore_identity = _check_sigstore_availability()
    if sigstore_available:
        signer_type = "sigstore"
        signer_identity = sigstore_identity
    else:
        ed25519_available, ed25519_identity = _check_ed25519_availability()
        if ed25519_available:
            signer_type = "ed25519"
            signer_identity = ed25519_identity
        else:
            # Neither available - report both errors
            signer_identity = f"sigstore: {sigstore_identity}; ed25519: {ed25519_identity}"

    # List registered tools (hardcoded for now, could be dynamic)
    tools_registered = [
        "attest_commit",
        "verify_chain",
        "render_passport",
        "health_check",
    ]

    status = HealthStatus(
        signer_type=signer_type,
        signer_identity=signer_identity,
        git_available=git_available,
        repo_root=repo_root,
        tools_registered=tools_registered,
    )

    _log.info(
        "health_check_completed",
        signer_type=status.signer_type,
        git_available=status.git_available,
        repo_root=status.repo_root,
    )

    return status


# Made with Bob
