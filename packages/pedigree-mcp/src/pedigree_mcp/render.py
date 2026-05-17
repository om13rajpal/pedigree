"""Passport rendering tool -- produces JSON payloads for the web frontend.

Calls verify_chain to get the validated predicate, then assembles a
JSON payload suitable for the Next.js Passport page.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pedigree_mcp.constants import REKOR_PUBLIC_URL
from pedigree_mcp.logger import get_logger
from pedigree_mcp.verify import verify_chain

_log = get_logger(__name__)


@dataclass(frozen=True)
class PassportPayload:
    """Structured payload for rendering a Passport page."""

    commit_sha: str
    predicate: dict[str, object]
    signer_identity: str
    rekor_verified: bool
    rekor_entry_url: str
    summary: str


def render_passport(
    commit_sha: str,
    *,
    skip_rekor: bool = False,
    envelope_bytes: bytes | None = None,
) -> PassportPayload:
    """Build a Passport page payload for a commit.

    Verifies the attestation chain and assembles all data the Next.js
    Passport page needs to render the commit's provenance credential.

    Args:
        commit_sha: The git commit SHA-1 to render.
        skip_rekor: If True, skip Rekor verification.
        envelope_bytes: If provided, use these bytes instead of reading
            from git refs. Useful for testing.

    Returns:
        A PassportPayload with predicate, verification status, and summary.

    Raises:
        VerificationError: If the attestation chain is broken.
        SchemaValidationError: If the predicate is invalid.
        GitError: If reading the attestation ref fails.
    """
    _log.info("render_passport_start", commit_sha=commit_sha)

    result = verify_chain(
        commit_sha,
        skip_rekor=skip_rekor,
        envelope_bytes=envelope_bytes,
    )

    predicate_dict = result.predicate.model_dump(by_alias=True)
    summary = _build_summary(commit_sha, predicate_dict)

    rekor_entry_url = ""
    if result.rekor_verified:
        rekor_entry_url = f"{REKOR_PUBLIC_URL}/api/v1/log/entries"

    _log.info("render_passport_complete", commit_sha=commit_sha)

    return PassportPayload(
        commit_sha=commit_sha,
        predicate=predicate_dict,
        signer_identity=result.signer_identity,
        rekor_verified=result.rekor_verified,
        rekor_entry_url=rekor_entry_url,
        summary=summary,
    )


def _build_summary(commit_sha: str, predicate: dict[str, Any]) -> str:
    """Build a human-readable summary from a predicate dict.

    In Phase 3 this produces a template-based summary. Phase 5 will
    replace this with a watsonx.ai Granite NL summary.

    Args:
        commit_sha: The commit SHA for context.
        predicate: The predicate dict (serialized with aliases).

    Returns:
        A one-paragraph human-readable summary of the attestation.
    """
    authorship = predicate.get("authorship", {})
    kind = authorship.get("kind", "unknown")
    scope = predicate.get("scope", {})
    files = scope.get("filesTouched", [])
    risk_class = scope.get("riskClass", "unknown")
    policy = predicate.get("policy", {})
    satisfied = policy.get("satisfied", False)

    file_count = len(files)
    file_list = ", ".join(files[:3])
    if file_count > 3:
        file_list += f" and {file_count - 3} more"

    status = "satisfied" if satisfied else "NOT satisfied"

    if kind == "human":
        agent_desc = "a human author"
    elif kind == "ai-assisted":
        agent = predicate.get("agent", {})
        tool = agent.get("tool", "unknown tool")
        model = agent.get("model", "unknown model")
        agent_desc = f"{tool} ({model}) with human collaboration"
    elif kind == "ai-autonomous":
        agent = predicate.get("agent", {})
        tool = agent.get("tool", "unknown tool")
        model = agent.get("model", "unknown model")
        agent_desc = f"{tool} ({model}) autonomously"
    else:
        agent_desc = "an unknown author"

    return (
        f"Commit {commit_sha[:12]} was authored by {agent_desc}. "
        f"It touched {file_count} file(s) ({file_list}) "
        f"with risk class '{risk_class}'. "
        f"Policy status: {status}."
    )
