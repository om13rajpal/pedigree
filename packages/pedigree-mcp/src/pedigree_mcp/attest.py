"""Attestation tool -- creates signed in-toto attestations for commits.

Orchestrates the full attest workflow: validate predicate, build statement,
sign via the active Signer, write to git refs, and submit to Rekor.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

from pedigree_mcp import git_io
from pedigree_mcp.errors import PolicyViolationError
from pedigree_mcp.logger import get_logger
from pedigree_mcp.rekor_io import RekorEntry, submit_entry
from pedigree_mcp.schema import parse_predicate
from pedigree_mcp.signing import get_signer
from pedigree_mcp.statement import build_statement

_log = get_logger(__name__)


@dataclass(frozen=True)
class AttestResult:
    """Result of a successful attestation."""

    commit_sha: str
    rekor_uuid: str
    rekor_url: str
    signer_identity: str


def attest_commit(
    commit_sha: str,
    predicate_dict: dict[str, object],
    *,
    skip_rekor: bool = False,
    skip_git_write: bool = False,
) -> AttestResult:
    """Create a signed in-toto attestation for a commit.

    Validates the predicate, builds an in-toto Statement, signs it with
    the active Signer, optionally writes to git attestation refs, and
    optionally submits to the Rekor transparency log.

    Args:
        commit_sha: The git commit SHA-1 to attest (lowercase hex).
        predicate_dict: The raw predicate dict to validate and embed.
        skip_rekor: If True, skip Rekor submission (for offline/testing).
        skip_git_write: If True, skip writing to git refs (for testing).

    Returns:
        An AttestResult with the commit SHA, Rekor UUID, URL, and signer identity.

    Raises:
        SchemaValidationError: If the predicate fails validation.
        PolicyViolationError: If the predicate's policy is not satisfied.
        SigningError: If signing the statement fails.
        RekorError: If Rekor submission fails.
        GitError: If writing the attestation ref fails.
    """
    _log.info("attest_commit_start", commit_sha=commit_sha)

    # Step 1: Validate the predicate
    predicate = parse_predicate(predicate_dict)

    # Step 2: Check policy satisfaction
    if not predicate.policy.satisfied:
        raise PolicyViolationError(
            f"Policy not satisfied for commit {commit_sha} -- CI must reject this commit",
            context={"commit_sha": commit_sha, "risk_class": predicate.scope.risk_class},
        )

    # Step 3: Build the in-toto Statement
    statement = build_statement(commit_sha, predicate)

    # Step 4: Sign the Statement
    signer = get_signer()
    statement_json = json.dumps(
        statement.model_dump(by_alias=True),
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    dsse_bytes = signer.sign(statement_json)

    _log.info(
        "attest_commit_signed",
        commit_sha=commit_sha,
        signer=signer.identity,
    )

    # Step 5: Write to git attestation ref
    if not skip_git_write:
        git_io.write_attestation_ref(commit_sha, dsse_bytes)
        _log.info("attest_commit_ref_written", commit_sha=commit_sha)

    # Step 6: Submit to Rekor
    rekor_uuid = ""
    rekor_url = ""
    if not skip_rekor:
        entry: RekorEntry = submit_entry(dsse_bytes)
        rekor_uuid = entry.uuid
        rekor_url = entry.log_url
        _log.info(
            "attest_commit_rekor_submitted",
            commit_sha=commit_sha,
            rekor_uuid=rekor_uuid,
        )
    else:
        _log.info("attest_commit_rekor_skipped", commit_sha=commit_sha)

    return AttestResult(
        commit_sha=commit_sha,
        rekor_uuid=rekor_uuid,
        rekor_url=rekor_url,
        signer_identity=signer.identity,
    )
