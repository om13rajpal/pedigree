"""Canonical constants for the Pedigree predicate schema and MCP server."""

from typing import Final

# The in-toto predicate type URI for AI authorship attestations.
PREDICATE_TYPE_V1: Final[str] = "dev.pedigree/ai-authorship/v1"

# The in-toto Statement type URI.
STATEMENT_TYPE_V1: Final[str] = "https://in-toto.io/Statement/v1"

# Current schema version.
SCHEMA_VERSION: Final[str] = "1.0.0"

# Valid values for scope.riskClass.
RISK_CLASSES: Final[tuple[str, ...]] = ("low", "medium", "high")

# Valid values for authorship.kind.
AUTHORSHIP_KINDS: Final[tuple[str, ...]] = ("human", "ai-assisted", "ai-autonomous")

# Default network timeout in seconds.
DEFAULT_TIMEOUT_S: Final[int] = 10

# Rekor public instance URL.
REKOR_PUBLIC_URL: Final[str] = "https://rekor.sigstore.dev"

# Git attestation ref prefix.
ATTESTATION_REF_PREFIX: Final[str] = "refs/attestations/commits"

# Fixed subject name for git commit subjects in in-toto statements.
COMMIT_SUBJECT_NAME: Final[str] = "git+commit"
