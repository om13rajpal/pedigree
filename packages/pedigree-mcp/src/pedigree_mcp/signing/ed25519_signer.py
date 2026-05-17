"""Ed25519 fallback signer using the cryptography library.

Generates and persists ed25519 keypairs under ~/.pedigree/keys/ and uses
them to produce DSSE envelopes. This is the fallback path when Sigstore
(gitsign) is unavailable -- keys are project-scoped by repository name.
"""

from __future__ import annotations

import base64
import hashlib
import os
import stat
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

from pedigree_mcp.errors import SigningError, VerificationError
from pedigree_mcp.logger import get_logger
from pedigree_mcp.signing.dsse import (
    INTOTO_PAYLOAD_TYPE,
    DsseSignature,
    build_envelope,
    compute_pae,
    parse_envelope,
)

_log = get_logger(__name__)

# Default directory for pedigree keypairs.
_DEFAULT_KEYS_DIR = Path.home() / ".pedigree" / "keys"


class Ed25519Signer:
    """Ed25519 signer that persists keys to disk.

    On construction, looks for an existing keypair at the configured
    directory. If absent, generates a new one and saves it with
    restrictive permissions (chmod 600 on private key).

    Attributes:
        _private_key: The loaded or generated Ed25519 private key.
        _public_key: The corresponding public key.
        _key_dir: Directory where keypair files are stored.
        _repo_name: Name used to scope the keypair to a repository.
    """

    def __init__(
        self,
        *,
        repo_name: str = "default",
        keys_dir: Path | None = None,
    ) -> None:
        """Initialize the Ed25519 signer, loading or generating keys.

        Args:
            repo_name: Repository name used to scope the keypair file.
            keys_dir: Override the default keys directory (useful for testing).

        Raises:
            SigningError: If key loading or generation fails.
        """
        self._repo_name = repo_name
        self._key_dir = keys_dir or _DEFAULT_KEYS_DIR
        self._key_dir.mkdir(parents=True, exist_ok=True)

        private_path = self._key_dir / f"{repo_name}.ed25519"
        public_path = self._key_dir / f"{repo_name}.ed25519.pub"

        if private_path.exists():
            self._private_key = self._load_private_key(private_path)
            self._public_key = self._private_key.public_key()
            _log.info(
                "ed25519_key_loaded",
                repo_name=repo_name,
                public_key_fingerprint=self._public_key_fingerprint(),
            )
        else:
            self._private_key = Ed25519PrivateKey.generate()
            self._public_key = self._private_key.public_key()
            self._save_private_key(private_path)
            self._save_public_key(public_path)
            _log.info(
                "ed25519_key_generated",
                repo_name=repo_name,
                public_key_fingerprint=self._public_key_fingerprint(),
            )

    @property
    def identity(self) -> str:
        """Return the signer identity as ed25519:{sha256-of-public-key-bytes}.

        Returns:
            A string of the form "ed25519:<hex-digest>" identifying this key.
        """
        return f"ed25519:{self._public_key_fingerprint()}"

    def sign(self, statement_bytes: bytes) -> bytes:
        """Sign an in-toto Statement and wrap it in a DSSE envelope.

        Computes the PAE over the payload, signs it with the ed25519
        private key, then wraps the payload and signature into a DSSE
        envelope.

        Args:
            statement_bytes: The canonical JSON-serialized in-toto Statement.

        Returns:
            The DSSE envelope bytes containing the signed Statement.

        Raises:
            SigningError: If the ed25519 signing operation fails.
        """
        try:
            pae = compute_pae(INTOTO_PAYLOAD_TYPE, statement_bytes)
            sig_bytes = self._private_key.sign(pae)
            sig_b64 = base64.b64encode(sig_bytes).decode("ascii")

            signature = DsseSignature(keyid=self.identity, sig=sig_b64)
            return build_envelope(INTOTO_PAYLOAD_TYPE, statement_bytes, [signature])
        except Exception as exc:
            raise SigningError(
                f"Ed25519 signing failed: {exc}",
                context={"stage": "ed25519_sign"},
            ) from exc

    def verify(self, envelope_bytes: bytes) -> bytes:
        """Verify a DSSE envelope and extract the payload.

        Parses the envelope, recomputes the PAE, and verifies the ed25519
        signature against the public key.

        Args:
            envelope_bytes: The DSSE envelope bytes to verify.

        Returns:
            The verified payload bytes (the original Statement).

        Raises:
            VerificationError: If the envelope is malformed or the
                signature does not verify against the public key.
        """
        envelope = parse_envelope(envelope_bytes)
        payload = envelope.decoded_payload()
        pae = compute_pae(envelope.payload_type, payload)

        sig_b64 = envelope.signatures[0].sig
        sig_bytes = base64.b64decode(sig_b64)

        try:
            self._public_key.verify(sig_bytes, pae)
        except Exception as exc:
            raise VerificationError(
                "Ed25519 signature verification failed",
                context={"stage": "ed25519_verify"},
            ) from exc

        return payload

    def get_public_key(self) -> Ed25519PublicKey:
        """Return the public key for external verification.

        Returns:
            The Ed25519 public key object.
        """
        return self._public_key

    def _public_key_fingerprint(self) -> str:
        """Compute SHA-256 hex digest of the raw public key bytes.

        Returns:
            Lowercase hex SHA-256 of the public key in raw format.
        """
        raw = self._public_key.public_bytes_raw()
        return hashlib.sha256(raw).hexdigest()

    def _load_private_key(self, path: Path) -> Ed25519PrivateKey:
        """Load an ed25519 private key from a PEM file.

        Args:
            path: Path to the PEM-encoded private key file.

        Returns:
            The loaded Ed25519PrivateKey.

        Raises:
            SigningError: If the file cannot be read or parsed.
        """
        try:
            pem_bytes = path.read_bytes()
            key = serialization.load_pem_private_key(pem_bytes, password=None)
            if not isinstance(key, Ed25519PrivateKey):
                raise SigningError(
                    f"Key at {path} is not an Ed25519 private key",
                    context={"path": str(path)},
                )
            return key
        except SigningError:
            raise
        except Exception as exc:
            raise SigningError(
                f"Failed to load Ed25519 private key from {path}: {exc}",
                context={"path": str(path)},
            ) from exc

    def _save_private_key(self, path: Path) -> None:
        """Save the private key to a PEM file with chmod 600.

        Args:
            path: Destination path for the PEM-encoded private key.

        Raises:
            SigningError: If the file cannot be written.
        """
        try:
            pem_bytes = self._private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            path.write_bytes(pem_bytes)
            os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)  # 600
        except Exception as exc:
            raise SigningError(
                f"Failed to save Ed25519 private key to {path}: {exc}",
                context={"path": str(path)},
            ) from exc

    def _save_public_key(self, path: Path) -> None:
        """Save the public key to a PEM file.

        Args:
            path: Destination path for the PEM-encoded public key.

        Raises:
            SigningError: If the file cannot be written.
        """
        try:
            pem_bytes = self._public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo,
            )
            path.write_bytes(pem_bytes)
        except Exception as exc:
            raise SigningError(
                f"Failed to save Ed25519 public key to {path}: {exc}",
                context={"path": str(path)},
            ) from exc
