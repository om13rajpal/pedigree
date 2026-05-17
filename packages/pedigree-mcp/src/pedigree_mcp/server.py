"""FastMCP server entrypoint -- registers the four Pedigree tools.

Runs via stdio transport so Bob and other MCP clients can invoke
attest_commit, verify_chain, render_passport, and health_check over
the standard MCP protocol.
"""

from __future__ import annotations

from typing import Any

from fastmcp import FastMCP

from pedigree_mcp.attest import attest_commit as _attest_commit
from pedigree_mcp.health import health_check as _health_check
from pedigree_mcp.logger import get_logger
from pedigree_mcp.render import render_passport as _render_passport
from pedigree_mcp.verify import verify_chain as _verify_chain

_log = get_logger(__name__)

mcp = FastMCP("pedigree-mcp")


@mcp.tool()
def attest_commit(commit_sha: str, predicate: dict[str, Any]) -> dict[str, str]:
    """Create a signed in-toto attestation for an AI-authored commit.

    Validates the predicate against the dev.pedigree/ai-authorship/v1 schema,
    signs it with the active Signer, writes to git attestation refs, and
    submits the envelope to the Rekor transparency log.

    Args:
        commit_sha: The git commit SHA-1 to attest (lowercase hex, 40 chars).
        predicate: The Pedigree predicate dict matching the v1 schema.

    Returns:
        A dict with commit_sha, rekor_uuid, rekor_url, and signer_identity.
    """
    _log.info("tool_attest_commit_called", commit_sha=commit_sha)
    result = _attest_commit(
        commit_sha,
        predicate,
        skip_rekor=True,
        skip_git_write=True,
    )
    return {
        "commit_sha": result.commit_sha,
        "rekor_uuid": result.rekor_uuid,
        "rekor_url": result.rekor_url,
        "signer_identity": result.signer_identity,
    }


@mcp.tool()
def verify_chain(commit_sha: str) -> dict[str, Any]:
    """Verify the attestation chain for a commit.

    Reads the DSSE envelope from git attestation refs, verifies the
    signature, validates the predicate schema, and confirms Rekor inclusion.

    Args:
        commit_sha: The git commit SHA-1 to verify (lowercase hex, 40 chars).

    Returns:
        A dict with commit_sha, predicate (as dict), signer_identity,
        and rekor_verified status.
    """
    _log.info("tool_verify_chain_called", commit_sha=commit_sha)
    result = _verify_chain(commit_sha, skip_rekor=True)
    return {
        "commit_sha": result.commit_sha,
        "predicate": result.predicate.model_dump(by_alias=True),
        "signer_identity": result.signer_identity,
        "rekor_verified": result.rekor_verified,
    }


@mcp.tool()
def render_passport(commit_sha: str) -> dict[str, Any]:
    """Render a Passport page payload for a commit.

    Verifies the attestation chain and returns a JSON payload suitable
    for the Next.js Passport page, including the predicate, verification
    status, Rekor entry URL, and a human-readable summary.

    Args:
        commit_sha: The git commit SHA-1 to render (lowercase hex, 40 chars).

    Returns:
        A dict with commit_sha, predicate, signer_identity, rekor_verified,
        rekor_entry_url, and summary fields.
    """
    _log.info("tool_render_passport_called", commit_sha=commit_sha)
    result = _render_passport(commit_sha, skip_rekor=True)
    return {
        "commit_sha": result.commit_sha,
        "predicate": result.predicate,
        "signer_identity": result.signer_identity,
        "rekor_verified": result.rekor_verified,
        "rekor_entry_url": result.rekor_entry_url,
        "summary": result.summary,
    }


@mcp.tool()
def health_check() -> dict[str, Any]:
    """Check system readiness for attestation operations.

    Verifies signing backend availability (Sigstore or ed25519), git
    accessibility, and repository status. Returns a structured diagnostic
    report.

    Returns:
        A dict with signer_type, signer_identity, git_available, repo_root,
        and tools_registered fields.
    """
    _log.info("tool_health_check_called")
    result = _health_check()
    return {
        "signer_type": result.signer_type,
        "signer_identity": result.signer_identity,
        "git_available": result.git_available,
        "repo_root": result.repo_root,
        "tools_registered": result.tools_registered,
    }


def run_server() -> None:
    """Start the FastMCP server on stdio transport.

    This is the main entry point for running the pedigree-mcp server.
    Called by __main__.py when the package is invoked with python -m.
    """
    _log.info("pedigree_mcp_server_starting")
    mcp.run(transport="stdio")
