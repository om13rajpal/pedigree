"""In-toto Statement v1 wrapper for the Pedigree predicate.

Separates Statement construction from signing because the Statement shape
is a stable contract auditors read, while the signing mechanism (Sigstore
vs. ed25519 fallback) is swappable at runtime.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, Field, field_validator

from pedigree_mcp.constants import (
    COMMIT_SUBJECT_NAME,
    PREDICATE_TYPE_V1,
    STATEMENT_TYPE_V1,
)
from pedigree_mcp.errors import SchemaValidationError

if TYPE_CHECKING:
    from pedigree_mcp.schema import PedigreePredicate

# Matches a lowercase hex string (no prefix).
LOWERCASE_HEX_PATTERN = re.compile(r"^[0-9a-f]+$")


class CommitSubject(BaseModel):
    """A single subject entry in the in-toto Statement.

    For Pedigree, the subject is always a git commit identified by SHA-1.
    """

    name: Literal["git+commit"]
    digest: dict[str, str]

    @field_validator("digest")
    @classmethod
    def _validate_sha1_digest(cls, v: dict[str, str]) -> dict[str, str]:
        """Validate that digest contains a lowercase hex sha1 entry."""
        sha1 = v.get("sha1")
        if sha1 is None:
            msg = "digest must contain a 'sha1' key"
            raise ValueError(msg)
        if not LOWERCASE_HEX_PATTERN.match(sha1):
            msg = "SHA-1 must be lowercase hex without prefix"
            raise ValueError(msg)
        return v


class InTotoStatement(BaseModel):
    """Complete in-toto Statement v1 wrapping a Pedigree predicate.

    Validates the full Statement structure including type URIs, subjects,
    and the nested predicate payload.
    """

    type_: Literal["https://in-toto.io/Statement/v1"] = Field(alias="_type")
    subject: list[CommitSubject] = Field(min_length=1)
    predicate_type: Literal["dev.pedigree/ai-authorship/v1"] = Field(alias="predicateType")
    predicate: dict[str, object]

    model_config = {"populate_by_name": True}


def build_statement(
    commit_sha: str,
    predicate: PedigreePredicate,
) -> InTotoStatement:
    """Build a v1.0 in-toto Statement wrapping a Pedigree predicate.

    Statement construction is separated from signing because the Statement
    shape is a stable contract auditors read, while the signing mechanism
    (Sigstore vs. ed25519 fallback) is swappable at runtime.

    Args:
        commit_sha: The git commit SHA-1 being attested (lowercase hex).
        predicate: The validated Pedigree predicate payload.

    Returns:
        An InTotoStatement ready for DSSE wrapping.

    Raises:
        SchemaValidationError: If the commit SHA or predicate is invalid.
    """
    if not LOWERCASE_HEX_PATTERN.match(commit_sha):
        raise SchemaValidationError(
            f"Commit SHA must be lowercase hex, got: {commit_sha!r}",
            context={"field": "commit_sha"},
        )

    predicate_dict = predicate.model_dump(by_alias=True)

    raw = {
        "_type": STATEMENT_TYPE_V1,
        "subject": [
            {
                "name": COMMIT_SUBJECT_NAME,
                "digest": {"sha1": commit_sha},
            }
        ],
        "predicateType": PREDICATE_TYPE_V1,
        "predicate": predicate_dict,
    }

    try:
        return InTotoStatement.model_validate(raw)
    except Exception as exc:
        raise SchemaValidationError(
            f"Statement validation failed: {exc}",
            context={"commit_sha": commit_sha},
        ) from exc
