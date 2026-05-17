"""Pydantic v2 models mirroring the Zod predicate schema in pedigree-types.

This file defines the Python-side canonical shape of a Pedigree predicate.
The TypeScript mirror lives in packages/pedigree-types/src/predicate.ts.
Both definitions must stay in sync, verified by `pnpm verify-schemas`.

Design decision: we use a Literal discriminator on `authorship.kind` so that
human-only commits omit agent/execution fields, while AI-assisted and
AI-autonomous commits carry full provenance context.
"""

from __future__ import annotations

import re
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator

from pedigree_mcp.constants import (
    AUTHORSHIP_KINDS,
)

# ---------------------------------------------------------------------------
# Shared regex patterns
# ---------------------------------------------------------------------------

SHA256_PREFIXED_PATTERN = re.compile(r"^sha256:[0-9a-f]+$")
LOWERCASE_HEX_PATTERN = re.compile(r"^[0-9a-f]+$")

# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------


class HumanApprover(BaseModel):
    """OIDC-authenticated human approver identity.

    Present when a human reviewed and approved the AI-authored commit.
    Established via OIDC during Sigstore signing.
    """

    oidc_issuer: str = Field(alias="oidcIssuer", min_length=1)
    subject: str = Field(min_length=1)
    approved: bool
    timestamp: str = Field(min_length=1)

    @field_validator("oidc_issuer")
    @classmethod
    def _validate_oidc_issuer_is_url(cls, v: str) -> str:
        """Validate that oidcIssuer is a well-formed URL."""
        if not v.startswith(("http://", "https://")):
            msg = "oidcIssuer must be a URL starting with http:// or https://"
            raise ValueError(msg)
        return v

    @field_validator("timestamp")
    @classmethod
    def _validate_timestamp_format(cls, v: str) -> str:
        """Validate that timestamp looks like an ISO-8601 datetime."""
        # Accept any string with a date-like prefix and T separator
        if "T" not in v:
            msg = "timestamp must be an ISO-8601 datetime string"
            raise ValueError(msg)
        return v

    model_config = {"populate_by_name": True}


class Agent(BaseModel):
    """AI agent metadata describing which tool produced the code.

    Required for ai-assisted and ai-autonomous commits; absent for human-only.
    """

    tool: str = Field(min_length=1)
    tool_version: str = Field(alias="toolVersion", min_length=1)
    model: str = Field(min_length=1)
    model_provider: str = Field(alias="modelProvider", min_length=1)

    model_config = {"populate_by_name": True}


class SkillHash(BaseModel):
    """Content-addressed reference to a Bob Skill file.

    The hash changes when the Skill changes, making workflow versions auditable.
    """

    name: str = Field(min_length=1)
    sha256: str = Field(min_length=1)

    @field_validator("sha256")
    @classmethod
    def _validate_hex(cls, v: str) -> str:
        """Validate that the skill hash is lowercase hex without prefix."""
        if not LOWERCASE_HEX_PATTERN.match(v):
            msg = "Skill hash must be lowercase hex"
            raise ValueError(msg)
        return v


class Execution(BaseModel):
    """Execution context capturing the agent's configuration at commit time.

    Required for ai-assisted and ai-autonomous commits; absent for human-only.
    """

    mode_slug: str = Field(alias="modeSlug", min_length=1)
    skill_hashes: list[SkillHash] = Field(alias="skillHashes", min_length=1)
    agents_md_hash: str = Field(alias="agentsMdHash")
    prompt_hash: str = Field(alias="promptHash")
    plan_hash: str = Field(alias="planHash")
    bob_session_id: str = Field(alias="bobSessionId")
    bobcoins_consumed: float = Field(alias="bobcoinsConsumed", ge=0)

    @field_validator("agents_md_hash", "prompt_hash", "plan_hash")
    @classmethod
    def _validate_sha256_prefixed(cls, v: str) -> str:
        """Validate that hash fields are lowercase hex prefixed with sha256:."""
        if not SHA256_PREFIXED_PATTERN.match(v):
            msg = 'Hash must be lowercase hex prefixed with "sha256:"'
            raise ValueError(msg)
        return v

    model_config = {"populate_by_name": True}


class Scope(BaseModel):
    """Scope of changes introduced by the commit.

    Always required regardless of authorship kind.
    """

    files_touched: list[str] = Field(alias="filesTouched", min_length=1)
    lines_added: int = Field(alias="linesAdded", ge=0)
    lines_deleted: int = Field(alias="linesDeleted", ge=0)
    risk_class: Literal["low", "medium", "high"] = Field(alias="riskClass")

    @field_validator("files_touched")
    @classmethod
    def _validate_non_empty_paths(cls, v: list[str]) -> list[str]:
        """Ensure every file path in the list is non-empty."""
        for path in v:
            if not path:
                msg = "File paths must be non-empty strings"
                raise ValueError(msg)
        return v

    model_config = {"populate_by_name": True}


class Policy(BaseModel):
    """Policy evaluation result from the AGENTS.md provenance policy.

    Records whether the commit satisfied the repository's provenance requirements.
    A satisfied=false value MUST cause CI to fail.
    """

    agents_md_policy: str = Field(alias="agentsMdPolicy", min_length=1)
    requires_human_approval: bool = Field(alias="requiresHumanApproval")
    satisfied: bool

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Authorship discriminated union
# ---------------------------------------------------------------------------


class HumanAuthorship(BaseModel):
    """Authorship block for human-only commits.

    Agent and execution context are not applicable.
    """

    kind: Literal["human"]
    human_share: float = Field(alias="humanShare", ge=0, le=1)
    human_approver: HumanApprover | None = Field(default=None, alias="humanApprover")

    model_config = {"populate_by_name": True}


class AiAssistedAuthorship(BaseModel):
    """Authorship block for AI-assisted commits (human + AI collaboration).

    humanShare must be in [0.0, 1.0].
    """

    kind: Literal["ai-assisted"]
    human_share: float = Field(alias="humanShare", ge=0, le=1)
    human_approver: HumanApprover | None = Field(default=None, alias="humanApprover")

    model_config = {"populate_by_name": True}


class AiAutonomousAuthorship(BaseModel):
    """Authorship block for fully autonomous AI commits.

    humanShare is None because no human contributed.
    """

    kind: Literal["ai-autonomous"]
    human_share: None = Field(alias="humanShare")
    human_approver: HumanApprover | None = Field(default=None, alias="humanApprover")

    model_config = {"populate_by_name": True}


# Discriminated union across the three authorship kinds.
Authorship = Annotated[
    HumanAuthorship | AiAssistedAuthorship | AiAutonomousAuthorship,
    Field(discriminator="kind"),
]

# ---------------------------------------------------------------------------
# Full predicate (kind-specific shapes)
# ---------------------------------------------------------------------------


class HumanPredicate(BaseModel):
    """Human-only predicate: authorship.kind == 'human'.

    Agent and execution are optional (may be absent).
    """

    schema_version: Literal["1.0.0"] = Field(alias="schemaVersion")
    authorship: HumanAuthorship
    agent: Agent | None = None
    execution: Execution | None = None
    scope: Scope
    policy: Policy

    model_config = {"populate_by_name": True}


class AiAssistedPredicate(BaseModel):
    """AI-assisted predicate: authorship.kind == 'ai-assisted'.

    Agent and execution are required.
    """

    schema_version: Literal["1.0.0"] = Field(alias="schemaVersion")
    authorship: AiAssistedAuthorship
    agent: Agent
    execution: Execution
    scope: Scope
    policy: Policy

    model_config = {"populate_by_name": True}


class AiAutonomousPredicate(BaseModel):
    """AI-autonomous predicate: authorship.kind == 'ai-autonomous'.

    Agent and execution are required.
    """

    schema_version: Literal["1.0.0"] = Field(alias="schemaVersion")
    authorship: AiAutonomousAuthorship
    agent: Agent
    execution: Execution
    scope: Scope
    policy: Policy

    model_config = {"populate_by_name": True}


def parse_predicate(
    data: dict[str, object],
) -> HumanPredicate | AiAssistedPredicate | AiAutonomousPredicate:
    """Parse a raw dict into the correct predicate variant based on authorship.kind.

    Uses the authorship.kind discriminator to choose the correct model, mirroring
    the Zod discriminatedUnion behavior in the TypeScript schema.

    Args:
        data: Raw predicate dict, typically from JSON deserialization.

    Returns:
        A validated predicate model instance.

    Raises:
        SchemaValidationError: If the data fails validation.
    """
    from pedigree_mcp.errors import SchemaValidationError

    authorship = data.get("authorship")
    if not isinstance(authorship, dict):
        raise SchemaValidationError(
            "Predicate must contain an 'authorship' object",
            context={"field": "authorship"},
        )

    kind = authorship.get("kind")
    if kind == "human":
        try:
            return HumanPredicate.model_validate(data)
        except Exception as exc:
            raise SchemaValidationError(
                f"Human predicate validation failed: {exc}",
                context={"kind": "human"},
            ) from exc
    elif kind == "ai-assisted":
        try:
            return AiAssistedPredicate.model_validate(data)
        except Exception as exc:
            raise SchemaValidationError(
                f"AI-assisted predicate validation failed: {exc}",
                context={"kind": "ai-assisted"},
            ) from exc
    elif kind == "ai-autonomous":
        try:
            return AiAutonomousPredicate.model_validate(data)
        except Exception as exc:
            raise SchemaValidationError(
                f"AI-autonomous predicate validation failed: {exc}",
                context={"kind": "ai-autonomous"},
            ) from exc
    else:
        raise SchemaValidationError(
            f"Unknown authorship kind: {kind!r}. Must be one of {AUTHORSHIP_KINDS}",
            context={"kind": str(kind)},
        )


# Type alias for the predicate union.
PedigreePredicate = HumanPredicate | AiAssistedPredicate | AiAutonomousPredicate
