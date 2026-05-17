"""Sigstore signer wrapping gitsign CLI tools.

Primary signing path that uses gitsign-attest to produce Sigstore-backed
DSSE envelopes. Falls back gracefully when gitsign is not installed --
the factory in __init__.py catches SignerUnavailableError and switches
to the ed25519 fallback.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from pedigree_mcp.constants import DEFAULT_TIMEOUT_S
from pedigree_mcp.errors import SignerUnavailableError, SigningError, VerificationError
from pedigree_mcp.logger import get_logger

_log = get_logger(__name__)

# Transient network errors that warrant retry.
_TRANSIENT_ERRORS = (subprocess.TimeoutExpired, OSError)


class SigstoreSigner:
    """Sigstore signer using gitsign CLI for OIDC-based signing.

    Produces DSSE envelopes via gitsign-attest and verifies them via
    gitsign-attest verify. Requires gitsign to be installed and on PATH.

    The constructor checks for gitsign availability and raises
    SignerUnavailableError if not found, enabling the factory to fall
    back to ed25519 without impacting callers.
    """

    def __init__(self, *, commit_sha: str = "") -> None:
        """Initialize the Sigstore signer, verifying gitsign availability.

        Args:
            commit_sha: The commit SHA to attest (used in sign/verify CLI calls).

        Raises:
            SignerUnavailableError: If gitsign is not installed on PATH.
        """
        self._commit_sha = commit_sha
        self._gitsign_path = shutil.which("gitsign")
        self._gitsign_attest_path = shutil.which("gitsign-attest")

        if self._gitsign_path is None:
            raise SignerUnavailableError(
                "gitsign not found on PATH -- install gitsign to use Sigstore signing",
                context={"binary": "gitsign"},
            )
        if self._gitsign_attest_path is None:
            raise SignerUnavailableError(
                "gitsign-attest not found on PATH -- install gitsign to use Sigstore signing",
                context={"binary": "gitsign-attest"},
            )

        _log.info(
            "sigstore_signer_init",
            gitsign=self._gitsign_path,
            gitsign_attest=self._gitsign_attest_path,
        )

    @property
    def identity(self) -> str:
        """Return the Sigstore signer identity.

        Queries gitsign for the Fulcio certificate subject. If the query
        fails (e.g. no active OIDC session), returns a placeholder.

        Returns:
            A string of the form "sigstore:<fulcio-subject>" or a fallback.
        """
        try:
            result = subprocess.run(
                [self._gitsign_path, "show"],
                capture_output=True,
                text=True,
                timeout=DEFAULT_TIMEOUT_S,
                check=False,
            )
            if result.returncode == 0 and result.stdout.strip():
                return f"sigstore:{result.stdout.strip()}"
        except (subprocess.TimeoutExpired, OSError):
            pass

        return "sigstore:pending-oidc-auth"

    @retry(
        retry=retry_if_exception_type(_TRANSIENT_ERRORS),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    def _run_attest(self, predicate_path: str) -> subprocess.CompletedProcess[str]:
        """Run gitsign-attest add with retry on transient errors.

        Args:
            predicate_path: Path to the predicate tempfile.

        Returns:
            The completed subprocess result.

        Raises:
            subprocess.TimeoutExpired: On timeout after retries.
            OSError: On OS-level errors after retries.
        """
        return subprocess.run(
            [
                self._gitsign_attest_path,
                "add",
                "--predicate",
                predicate_path,
                "--type",
                "application/vnd.in-toto+json",
                self._commit_sha,
            ],
            capture_output=True,
            text=True,
            timeout=DEFAULT_TIMEOUT_S,
            check=False,
        )

    def sign(self, statement_bytes: bytes) -> bytes:
        """Sign an in-toto Statement via gitsign-attest.

        Writes the statement to a temporary file, invokes gitsign-attest
        add, and returns the resulting DSSE envelope bytes. Retries up to
        3 times on transient network errors.

        Args:
            statement_bytes: The canonical JSON-serialized in-toto Statement.

        Returns:
            The DSSE envelope bytes produced by gitsign-attest.

        Raises:
            SigningError: If gitsign-attest fails after retries.
        """
        with tempfile.NamedTemporaryFile(
            suffix=".json",
            mode="wb",
            delete=False,
        ) as tmp:
            tmp.write(statement_bytes)
            tmp_path = tmp.name

        try:
            result = self._run_attest(tmp_path)

            if result.returncode != 0:
                raise SigningError(
                    f"gitsign-attest failed with exit code {result.returncode}: {result.stderr}",
                    context={
                        "exit_code": str(result.returncode),
                        "stderr": result.stderr[:500],
                    },
                )

            # gitsign-attest writes the envelope to stdout
            envelope_str = result.stdout.strip()
            if not envelope_str:
                raise SigningError(
                    "gitsign-attest produced empty output",
                    context={"stage": "sigstore_sign"},
                )

            _log.info("sigstore_sign_success", commit_sha=self._commit_sha)
            return envelope_str.encode("utf-8")

        except SigningError:
            raise
        except _TRANSIENT_ERRORS as exc:
            raise SigningError(
                f"gitsign-attest failed after retries: {exc}",
                context={"stage": "sigstore_sign"},
            ) from exc
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    @retry(
        retry=retry_if_exception_type(_TRANSIENT_ERRORS),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    def _run_verify(self, envelope_path: str) -> subprocess.CompletedProcess[str]:
        """Run gitsign-attest verify with retry on transient errors.

        Args:
            envelope_path: Path to the envelope tempfile.

        Returns:
            The completed subprocess result.

        Raises:
            subprocess.TimeoutExpired: On timeout after retries.
            OSError: On OS-level errors after retries.
        """
        return subprocess.run(
            [
                self._gitsign_attest_path,
                "verify",
                "--envelope",
                envelope_path,
                self._commit_sha,
            ],
            capture_output=True,
            text=True,
            timeout=DEFAULT_TIMEOUT_S,
            check=False,
        )

    def verify(self, envelope_bytes: bytes) -> bytes:
        """Verify a DSSE envelope via gitsign-attest verify.

        Writes the envelope to a temporary file, invokes gitsign-attest
        verify, and extracts the payload on success.

        Args:
            envelope_bytes: The DSSE envelope bytes to verify.

        Returns:
            The verified payload bytes (the original Statement).

        Raises:
            VerificationError: If gitsign-attest verify fails.
        """
        with tempfile.NamedTemporaryFile(
            suffix=".json",
            mode="wb",
            delete=False,
        ) as tmp:
            tmp.write(envelope_bytes)
            tmp_path = tmp.name

        try:
            result = self._run_verify(tmp_path)

            if result.returncode != 0:
                raise VerificationError(
                    f"gitsign-attest verify failed: {result.stderr}",
                    context={
                        "exit_code": str(result.returncode),
                        "stderr": result.stderr[:500],
                    },
                )

            # On success, extract the payload from the envelope ourselves
            import base64

            envelope_dict = json.loads(envelope_bytes)
            payload_b64 = envelope_dict.get("payload", "")
            payload = base64.b64decode(payload_b64)

            _log.info("sigstore_verify_success", commit_sha=self._commit_sha)
            return payload

        except VerificationError:
            raise
        except _TRANSIENT_ERRORS as exc:
            raise VerificationError(
                f"gitsign-attest verify failed after retries: {exc}",
                context={"stage": "sigstore_verify"},
            ) from exc
        except (json.JSONDecodeError, KeyError) as exc:
            raise VerificationError(
                f"Failed to extract payload from verified envelope: {exc}",
                context={"stage": "sigstore_verify"},
            ) from exc
        finally:
            Path(tmp_path).unlink(missing_ok=True)
