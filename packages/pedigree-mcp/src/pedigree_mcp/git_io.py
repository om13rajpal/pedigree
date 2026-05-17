"""Git subprocess wrapper -- all git side-effects live here.

Every git interaction is isolated in this module so it can be
dependency-injected and mocked in tests. No other module in
pedigree-mcp should call subprocess for git operations.
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass

from pedigree_mcp.constants import ATTESTATION_REF_PREFIX, DEFAULT_TIMEOUT_S
from pedigree_mcp.errors import GitError


@dataclass(frozen=True)
class CommitMetadata:
    """Metadata extracted from a git commit."""

    sha: str
    author_name: str
    author_email: str
    committer_name: str
    committer_email: str
    subject: str
    timestamp: str


@dataclass(frozen=True)
class DiffStats:
    """Lines added and deleted in a commit."""

    lines_added: int
    lines_deleted: int


def _run_git(args: list[str], *, timeout: int = DEFAULT_TIMEOUT_S) -> str:
    """Run a git command and return stdout.

    Args:
        args: Arguments to pass to git (without the 'git' prefix).
        timeout: Subprocess timeout in seconds.

    Returns:
        Stripped stdout from the git command.

    Raises:
        GitError: If the git command exits with a non-zero status.
    """
    cmd = ["git", *args]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise GitError(
            f"Git command timed out after {timeout}s: {' '.join(cmd)}",
            context={"command": " ".join(cmd), "timeout": str(timeout)},
        ) from exc

    if result.returncode != 0:
        raise GitError(
            f"Git command failed (exit {result.returncode}): {result.stderr.strip()}",
            context={
                "command": " ".join(cmd),
                "exit_code": str(result.returncode),
                "stderr": result.stderr.strip(),
            },
        )

    return result.stdout.strip()


def get_commit_metadata(sha: str) -> CommitMetadata:
    """Retrieve structured metadata for a git commit.

    Args:
        sha: The commit SHA to inspect.

    Returns:
        A CommitMetadata dataclass with the commit's details.

    Raises:
        GitError: If the commit does not exist or git fails.
    """
    # Format: author_name|author_email|committer_name|committer_email|subject|timestamp
    fmt = "%an|%ae|%cn|%ce|%s|%aI"
    output = _run_git(["log", "-1", f"--format={fmt}", sha])
    parts = output.split("|", 5)
    if len(parts) < 6:
        raise GitError(
            f"Unexpected git log output for commit {sha}",
            context={"sha": sha, "output": output},
        )

    return CommitMetadata(
        sha=sha,
        author_name=parts[0],
        author_email=parts[1],
        committer_name=parts[2],
        committer_email=parts[3],
        subject=parts[4],
        timestamp=parts[5],
    )


def get_changed_files(sha: str) -> list[str]:
    """List files changed in a commit.

    Args:
        sha: The commit SHA to inspect.

    Returns:
        A list of relative file paths changed in the commit.

    Raises:
        GitError: If the commit does not exist or git fails.
    """
    output = _run_git(["diff-tree", "--no-commit-id", "--name-only", "-r", sha])
    if not output:
        return []
    return output.splitlines()


def get_lines_added_deleted(sha: str) -> DiffStats:
    """Count lines added and deleted in a commit.

    Args:
        sha: The commit SHA to inspect.

    Returns:
        A DiffStats with total lines added and deleted.

    Raises:
        GitError: If the commit does not exist or git fails.
    """
    output = _run_git(["diff-tree", "--numstat", "--no-commit-id", "-r", sha])
    added = 0
    deleted = 0
    for line in output.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2:
            # Binary files show '-' for added/deleted
            if parts[0] != "-":
                added += int(parts[0])
            if parts[1] != "-":
                deleted += int(parts[1])
    return DiffStats(lines_added=added, lines_deleted=deleted)


def write_attestation_ref(sha: str, dsse_bytes: bytes) -> None:
    """Write a DSSE envelope to the git attestation ref for a commit.

    Stores the attestation as a git blob and creates a ref under
    refs/attestations/commits/<sha> pointing to it.

    Args:
        sha: The commit SHA being attested.
        dsse_bytes: The DSSE envelope bytes to store.

    Raises:
        GitError: If writing the blob or ref fails.
    """
    cmd = ["git", "hash-object", "-w", "--stdin"]
    try:
        result = subprocess.run(
            cmd,
            input=dsse_bytes,
            capture_output=True,
            timeout=DEFAULT_TIMEOUT_S,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise GitError(
            f"Git hash-object timed out writing attestation for {sha}",
            context={"sha": sha},
        ) from exc

    if result.returncode != 0:
        raise GitError(
            f"Failed to write attestation blob: {result.stderr.decode().strip()}",
            context={"sha": sha},
        )

    blob_sha = result.stdout.decode().strip()
    ref = f"{ATTESTATION_REF_PREFIX}/{sha}"
    _run_git(["update-ref", ref, blob_sha])


def read_attestation_ref(sha: str) -> bytes:
    """Read the DSSE envelope from the git attestation ref for a commit.

    Args:
        sha: The commit SHA whose attestation to read.

    Returns:
        The DSSE envelope bytes stored in the attestation ref.

    Raises:
        GitError: If the attestation ref does not exist or git fails.
    """
    ref = f"{ATTESTATION_REF_PREFIX}/{sha}"
    blob_sha = _run_git(["rev-parse", ref])
    output = _run_git(["cat-file", "blob", blob_sha])
    return output.encode("utf-8")
