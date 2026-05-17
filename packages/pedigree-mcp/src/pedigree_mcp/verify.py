"""Verification tool -- validates attestation chain for a commit.

Reads the DSSE envelope from git refs, verifies the signature, validates
the predicate schema, and optionally confirms Rekor inclusion.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

from pedigree_mcp import git_io
from pedigree_mcp.errors import VerificationError
from pedigree_mcp.logger import get_logger
from pedigree_mcp.schema import PedigreePredicate, parse_predicate
from pedigree_mcp.signing import get_signer

_log = get_logger(__name__)


@dataclass(frozen=True)
class VerifyResult:
    """Result of a successful chain verification."""

    commit_sha: str
    predicate: PedigreePredicate
    signer_identity: str
    rekor_verified: bool


def verify_chain(
    commit_sha: str,
    *,
    skip_rekor: bool = False,
    envelope_bytes: bytes | None = None,
) -> VerifyResult:
    """Verify the attestation chain for a commit.

    Reads the DSSE envelope from git attestation refs (or accepts it
    directly), verifies the signature, validates the embedded predicate,
    and optionally confirms Rekor inclusion.

    Args:
        commit_sha: The git commit SHA-1 to verify.
        skip_rekor: If True, skip Rekor inclusion check.
        envelope_bytes: If provided, use these bytes instead of reading
            from git refs. Useful for testing and pipeline integration.

    Returns:
        A VerifyResult with the validated predicate and verification status.

    Raises:
        VerificationError: If the DSSE envelope is invalid or signature fails.
        SchemaValidationError: If the predicate fails schema validation.
        GitError: If reading the attestation ref fails.
        RekorError: If Rekor verification fails.
    """
    _log.info("verify_chain_start", commit_sha=commit_sha)

    # Step 1: Read the DSSE envelope
    if envelope_bytes is None:
        envelope_bytes = git_io.read_attestation_ref(commit_sha)

    # Step 2: Verify the DSSE signature and extract payload
    signer = get_signer()
    try:
        payload_bytes = signer.verify(envelope_bytes)
    except Exception as exc:
        raise VerificationError(
            f"DSSE signature verification failed for commit {commit_sha}",
            context={"commit_sha": commit_sha},
        ) from exc

    # Step 3: Parse the statement payload
    try:
        statement_dict = json.loads(payload_bytes)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise VerificationError(
            f"Failed to parse statement JSON from DSSE payload for commit {commit_sha}",
            context={"commit_sha": commit_sha},
        ) from exc

    # Step 4: Extract and validate the predicate
    predicate_dict = statement_dict.get("predicate")
    if not isinstance(predicate_dict, dict):
        raise VerificationError(
            f"Statement for commit {commit_sha} does not contain a valid predicate",
            context={"commit_sha": commit_sha},
        )

    predicate = parse_predicate(predicate_dict)

    # Step 5: Verify subject matches the commit
    subjects = statement_dict.get("subject", [])
    sha_found = False
    for subj in subjects:
        digest = subj.get("digest", {})
        if digest.get("sha1") == commit_sha:
            sha_found = True
            break

    if not sha_found:
        raise VerificationError(
            f"Statement subject does not match commit {commit_sha}",
            context={"commit_sha": commit_sha},
        )

    # Step 6: Optionally verify Rekor inclusion
    rekor_verified = False
    if not skip_rekor:
        # In Phase 3 with stub signing, we skip real Rekor lookups
        # Phase 4 will implement full Rekor search by commit SHA
        _log.info("verify_chain_rekor_check_deferred", commit_sha=commit_sha)
    else:
        _log.info("verify_chain_rekor_skipped", commit_sha=commit_sha)

    _log.info("verify_chain_success", commit_sha=commit_sha)

    return VerifyResult(
        commit_sha=commit_sha,
        predicate=predicate,
        signer_identity=signer.identity,
        rekor_verified=rekor_verified,
    )
