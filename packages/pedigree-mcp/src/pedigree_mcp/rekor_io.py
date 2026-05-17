"""HTTP client for the Rekor transparency log.

All network interactions with Rekor are isolated in this module.
Uses httpx for async-capable HTTP and tenacity for retry logic.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from pedigree_mcp.constants import DEFAULT_TIMEOUT_S, REKOR_PUBLIC_URL
from pedigree_mcp.errors import RekorError
from pedigree_mcp.logger import get_logger

_log = get_logger(__name__)

# Maximum retry attempts for transient Rekor failures.
MAX_RETRIES = 3


@dataclass(frozen=True)
class RekorEntry:
    """A successfully submitted or fetched Rekor log entry."""

    uuid: str
    log_index: int
    log_url: str


@retry(
    stop=stop_after_attempt(MAX_RETRIES),
    wait=wait_exponential(multiplier=0.5, min=0.5, max=5),
    reraise=True,
)
def submit_entry(dsse_envelope: bytes, *, base_url: str = REKOR_PUBLIC_URL) -> RekorEntry:
    """Submit a DSSE envelope to the Rekor transparency log.

    Args:
        dsse_envelope: The DSSE envelope bytes to log.
        base_url: The Rekor instance URL. Defaults to public Sigstore Rekor.

    Returns:
        A RekorEntry with the log UUID, index, and URL.

    Raises:
        RekorError: If the submission fails after retries.
    """
    url = f"{base_url}/api/v1/log/entries"
    payload = {
        "kind": "intoto",
        "apiVersion": "0.0.2",
        "spec": {
            "content": {
                "envelope": dsse_envelope.decode("utf-8"),
            },
        },
    }

    try:
        with httpx.Client(timeout=DEFAULT_TIMEOUT_S) as client:
            response = client.post(url, json=payload)
    except httpx.TimeoutException as exc:
        raise RekorError(
            f"Rekor submission timed out after {DEFAULT_TIMEOUT_S}s",
            context={"url": url},
        ) from exc
    except httpx.HTTPError as exc:
        raise RekorError(
            f"Rekor submission failed: {exc}",
            context={"url": url},
        ) from exc

    if response.status_code not in (200, 201):
        raise RekorError(
            f"Rekor returned status {response.status_code}: {response.text[:200]}",
            context={"url": url, "status": str(response.status_code)},
        )

    data = response.json()
    # Rekor returns a dict with UUID as key
    uuid = next(iter(data.keys()))
    entry = data[uuid]
    log_index = entry.get("logIndex", -1)

    _log.info("rekor_entry_submitted", uuid=uuid, log_index=log_index)

    return RekorEntry(
        uuid=uuid,
        log_index=log_index,
        log_url=f"{base_url}/api/v1/log/entries/{uuid}",
    )


@retry(
    stop=stop_after_attempt(MAX_RETRIES),
    wait=wait_exponential(multiplier=0.5, min=0.5, max=5),
    reraise=True,
)
def fetch_entry(uuid: str, *, base_url: str = REKOR_PUBLIC_URL) -> dict[str, object]:
    """Fetch a Rekor log entry by UUID.

    Args:
        uuid: The Rekor entry UUID.
        base_url: The Rekor instance URL. Defaults to public Sigstore Rekor.

    Returns:
        The raw Rekor entry as a dict.

    Raises:
        RekorError: If the fetch fails after retries.
    """
    url = f"{base_url}/api/v1/log/entries/{uuid}"

    try:
        with httpx.Client(timeout=DEFAULT_TIMEOUT_S) as client:
            response = client.get(url)
    except httpx.TimeoutException as exc:
        raise RekorError(
            f"Rekor fetch timed out after {DEFAULT_TIMEOUT_S}s",
            context={"url": url, "uuid": uuid},
        ) from exc
    except httpx.HTTPError as exc:
        raise RekorError(
            f"Rekor fetch failed: {exc}",
            context={"url": url, "uuid": uuid},
        ) from exc

    if response.status_code != 200:
        raise RekorError(
            f"Rekor returned status {response.status_code} for entry {uuid}",
            context={"url": url, "uuid": uuid, "status": str(response.status_code)},
        )

    return response.json()


def verify_inclusion(uuid: str, *, base_url: str = REKOR_PUBLIC_URL) -> bool:
    """Verify that a Rekor entry exists and is included in the log.

    A lightweight check that the entry is fetchable. Full Merkle inclusion
    proof verification is deferred to Phase 4 with sigstore-python.

    Args:
        uuid: The Rekor entry UUID to verify.
        base_url: The Rekor instance URL. Defaults to public Sigstore Rekor.

    Returns:
        True if the entry exists in the log.

    Raises:
        RekorError: If the entry cannot be fetched.
    """
    entry = fetch_entry(uuid, base_url=base_url)
    # Entry exists and was returned -- inclusion confirmed at fetch level
    _log.info("rekor_inclusion_verified", uuid=uuid)
    return bool(entry)
