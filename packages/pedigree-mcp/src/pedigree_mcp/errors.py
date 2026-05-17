"""Pedigree error hierarchy -- all raised errors extend PedigreeError."""

from __future__ import annotations


class PedigreeError(Exception):
    """Base error for all Pedigree operations.

    Every error in the pedigree-mcp package subclasses this so callers can
    catch the entire family with a single handler when appropriate.
    """

    def __init__(self, message: str, *, context: dict[str, str] | None = None) -> None:
        super().__init__(message)
        self.context: dict[str, str] = context or {}


class SchemaValidationError(PedigreeError):
    """Raised when a predicate or statement fails schema validation."""


class SigningError(PedigreeError):
    """Raised when cryptographic signing fails."""


class SignerUnavailableError(SigningError):
    """Raised when a signing backend is not available (e.g. gitsign not installed)."""


class VerificationError(PedigreeError):
    """Raised when DSSE envelope or signature verification fails."""


class RekorError(PedigreeError):
    """Raised when a Rekor transparency log operation fails."""


class PolicyViolationError(PedigreeError):
    """Raised when a commit violates the AGENTS.md provenance policy."""


class ConfigError(PedigreeError):
    """Raised when server or signer configuration is invalid or missing."""


class GitError(PedigreeError):
    """Raised when a git subprocess command fails."""
