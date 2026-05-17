"""Tests for the Pydantic predicate schema and discriminated union."""

from __future__ import annotations

import pytest
from pedigree_mcp.errors import SchemaValidationError
from pedigree_mcp.schema import (
    Agent,
    AiAssistedAuthorship,
    AiAssistedPredicate,
    AiAutonomousAuthorship,
    AiAutonomousPredicate,
    Execution,
    HumanApprover,
    HumanAuthorship,
    HumanPredicate,
    Policy,
    Scope,
    SkillHash,
    parse_predicate,
)
from pydantic import ValidationError

from tests.conftest import load_predicate

# ---------------------------------------------------------------------------
# Discriminated union on authorship.kind
# ---------------------------------------------------------------------------


class TestAuthorshipDiscriminatedUnion:
    """Tests for the authorship kind discriminator."""

    def test_accepts_human_authorship(self) -> None:
        result = HumanAuthorship.model_validate({"kind": "human", "humanShare": 1.0})
        assert result.kind == "human"
        assert result.human_share == 1.0

    def test_accepts_ai_assisted_authorship_with_approver(self) -> None:
        result = AiAssistedAuthorship.model_validate(
            {
                "kind": "ai-assisted",
                "humanShare": 0.3,
                "humanApprover": {
                    "oidcIssuer": "https://github.com/login/oauth",
                    "subject": "dev@example.com",
                    "approved": True,
                    "timestamp": "2026-05-16T10:00:00Z",
                },
            }
        )
        assert result.kind == "ai-assisted"
        assert result.human_approver is not None
        assert result.human_approver.approved is True

    def test_accepts_ai_autonomous_with_null_human_share(self) -> None:
        result = AiAutonomousAuthorship.model_validate(
            {"kind": "ai-autonomous", "humanShare": None}
        )
        assert result.kind == "ai-autonomous"
        assert result.human_share is None

    def test_rejects_ai_autonomous_with_numeric_human_share(self) -> None:
        with pytest.raises(ValidationError):
            AiAutonomousAuthorship.model_validate({"kind": "ai-autonomous", "humanShare": 0.5})

    def test_rejects_ai_assisted_with_null_human_share(self) -> None:
        with pytest.raises(ValidationError):
            AiAssistedAuthorship.model_validate({"kind": "ai-assisted", "humanShare": None})


# ---------------------------------------------------------------------------
# humanShare boundary tests
# ---------------------------------------------------------------------------


class TestHumanShareBoundaries:
    """Tests for humanShare value boundaries."""

    def test_accepts_human_share_zero(self) -> None:
        result = AiAssistedAuthorship.model_validate({"kind": "ai-assisted", "humanShare": 0})
        assert result.human_share == 0

    def test_accepts_human_share_one(self) -> None:
        result = AiAssistedAuthorship.model_validate({"kind": "ai-assisted", "humanShare": 1})
        assert result.human_share == 1

    def test_rejects_human_share_above_one(self) -> None:
        with pytest.raises(ValidationError):
            AiAssistedAuthorship.model_validate({"kind": "ai-assisted", "humanShare": 1.01})

    def test_rejects_human_share_below_zero(self) -> None:
        with pytest.raises(ValidationError):
            AiAssistedAuthorship.model_validate({"kind": "ai-assisted", "humanShare": -0.1})


# ---------------------------------------------------------------------------
# SHA format validation
# ---------------------------------------------------------------------------


class TestShaFormatValidation:
    """Tests for hash format validators."""

    def test_rejects_sha256_without_prefix(self) -> None:
        with pytest.raises(ValidationError):
            Execution.model_validate(
                {
                    "modeSlug": "provenance-officer",
                    "skillHashes": [{"name": "test", "sha256": "abcdef"}],
                    "agentsMdHash": "abcdef1234",
                    "promptHash": "sha256:abcdef1234",
                    "planHash": "sha256:abcdef1234",
                    "bobSessionId": "639be8ed-e654-4a1b-9c3d-5e7f9a1b3c5d",
                    "bobcoinsConsumed": 0,
                }
            )

    def test_accepts_correctly_formatted_sha256(self) -> None:
        result = Execution.model_validate(
            {
                "modeSlug": "provenance-officer",
                "skillHashes": [{"name": "test", "sha256": "abcdef1234"}],
                "agentsMdHash": "sha256:abcdef1234",
                "promptHash": "sha256:abcdef1234",
                "planHash": "sha256:abcdef1234",
                "bobSessionId": "639be8ed-e654-4a1b-9c3d-5e7f9a1b3c5d",
                "bobcoinsConsumed": 0.5,
            }
        )
        assert result.mode_slug == "provenance-officer"

    def test_rejects_uppercase_hex_in_skill_hash(self) -> None:
        with pytest.raises(ValidationError):
            SkillHash.model_validate({"name": "test", "sha256": "ABCDEF"})


# ---------------------------------------------------------------------------
# Scope and policy sub-schemas
# ---------------------------------------------------------------------------


class TestScopeSchema:
    """Tests for the Scope model."""

    def test_accepts_valid_scope(self) -> None:
        result = Scope.model_validate(
            {
                "filesTouched": ["src/index.ts"],
                "linesAdded": 10,
                "linesDeleted": 0,
                "riskClass": "low",
            }
        )
        assert result.risk_class == "low"

    def test_rejects_invalid_risk_class(self) -> None:
        with pytest.raises(ValidationError):
            Scope.model_validate(
                {
                    "filesTouched": ["src/index.ts"],
                    "linesAdded": 10,
                    "linesDeleted": 0,
                    "riskClass": "critical",
                }
            )

    def test_rejects_empty_files_touched(self) -> None:
        with pytest.raises(ValidationError):
            Scope.model_validate(
                {
                    "filesTouched": [],
                    "linesAdded": 0,
                    "linesDeleted": 0,
                    "riskClass": "low",
                }
            )

    def test_rejects_negative_lines_added(self) -> None:
        with pytest.raises(ValidationError):
            Scope.model_validate(
                {
                    "filesTouched": ["src/index.ts"],
                    "linesAdded": -1,
                    "linesDeleted": 0,
                    "riskClass": "low",
                }
            )


class TestPolicySchema:
    """Tests for the Policy model."""

    def test_accepts_satisfied_policy(self) -> None:
        result = Policy.model_validate(
            {
                "agentsMdPolicy": "v1",
                "requiresHumanApproval": False,
                "satisfied": True,
            }
        )
        assert result.satisfied is True

    def test_accepts_unsatisfied_policy(self) -> None:
        result = Policy.model_validate(
            {
                "agentsMdPolicy": "v1",
                "requiresHumanApproval": True,
                "satisfied": False,
            }
        )
        assert result.satisfied is False


# ---------------------------------------------------------------------------
# Agent sub-schema
# ---------------------------------------------------------------------------


class TestAgentSchema:
    """Tests for the Agent model."""

    def test_accepts_valid_agent(self) -> None:
        result = Agent.model_validate(
            {
                "tool": "ibm-bob",
                "toolVersion": "1.4.2",
                "model": "granite-3.3-8b-instruct",
                "modelProvider": "watsonx.ai",
            }
        )
        assert result.tool == "ibm-bob"

    def test_rejects_empty_tool_name(self) -> None:
        with pytest.raises(ValidationError):
            Agent.model_validate(
                {
                    "tool": "",
                    "toolVersion": "1.0.0",
                    "model": "some-model",
                    "modelProvider": "some-provider",
                }
            )


# ---------------------------------------------------------------------------
# Human approver sub-schema
# ---------------------------------------------------------------------------


class TestHumanApproverSchema:
    """Tests for the HumanApprover model."""

    def test_accepts_valid_approver(self) -> None:
        result = HumanApprover.model_validate(
            {
                "oidcIssuer": "https://github.com/login/oauth",
                "subject": "dev@example.com",
                "approved": True,
                "timestamp": "2026-05-16T14:32:11Z",
            }
        )
        assert result.approved is True

    def test_rejects_non_url_oidc_issuer(self) -> None:
        with pytest.raises(ValidationError):
            HumanApprover.model_validate(
                {
                    "oidcIssuer": "not-a-url",
                    "subject": "dev@example.com",
                    "approved": True,
                    "timestamp": "2026-05-16T14:32:11Z",
                }
            )

    def test_rejects_non_datetime_timestamp(self) -> None:
        with pytest.raises(ValidationError):
            HumanApprover.model_validate(
                {
                    "oidcIssuer": "https://github.com/login/oauth",
                    "subject": "dev@example.com",
                    "approved": True,
                    "timestamp": "last tuesday",
                }
            )


# ---------------------------------------------------------------------------
# Predicate-level integration: fixtures
# ---------------------------------------------------------------------------


class TestPredicateFromFixtures:
    """Tests that all JSON fixtures parse correctly through Pydantic."""

    def test_valid_ai_assisted_fixture(self) -> None:
        predicate = load_predicate("valid-ai-assisted.json")
        result = parse_predicate(predicate)
        assert isinstance(result, AiAssistedPredicate)
        assert result.authorship.kind == "ai-assisted"

    def test_valid_human_fixture(self) -> None:
        predicate = load_predicate("valid-human.json")
        result = parse_predicate(predicate)
        assert isinstance(result, HumanPredicate)
        assert result.authorship.kind == "human"

    def test_valid_ai_autonomous_fixture(self) -> None:
        predicate = load_predicate("valid-ai-autonomous.json")
        result = parse_predicate(predicate)
        assert isinstance(result, AiAutonomousPredicate)
        assert result.authorship.kind == "ai-autonomous"
        assert result.authorship.human_share is None

    def test_invalid_missing_kind_fixture(self) -> None:
        predicate = load_predicate("invalid-missing-kind.json")
        with pytest.raises(SchemaValidationError):
            parse_predicate(predicate)

    def test_invalid_bad_risk_class_fixture(self) -> None:
        predicate = load_predicate("invalid-bad-risk-class.json")
        with pytest.raises(SchemaValidationError):
            parse_predicate(predicate)

    def test_invalid_policy_unsatisfied_fixture_is_schema_valid(self) -> None:
        """A predicate with policy.satisfied=false is schema-valid."""
        predicate = load_predicate("invalid-policy-unsatisfied.json")
        result = parse_predicate(predicate)
        assert result.policy.satisfied is False


# ---------------------------------------------------------------------------
# Predicate-level integration: kind-specific validation
# ---------------------------------------------------------------------------


class TestPredicateKindSpecific:
    """Tests for kind-specific required fields."""

    def test_human_predicate_without_agent_and_execution(self) -> None:
        result = parse_predicate(
            {
                "schemaVersion": "1.0.0",
                "authorship": {"kind": "human", "humanShare": 1.0},
                "scope": {
                    "filesTouched": ["README.md"],
                    "linesAdded": 5,
                    "linesDeleted": 0,
                    "riskClass": "low",
                },
                "policy": {
                    "agentsMdPolicy": "v1",
                    "requiresHumanApproval": False,
                    "satisfied": True,
                },
            }
        )
        assert isinstance(result, HumanPredicate)
        assert result.agent is None
        assert result.execution is None

    def test_ai_assisted_predicate_requires_agent(self) -> None:
        with pytest.raises(SchemaValidationError):
            parse_predicate(
                {
                    "schemaVersion": "1.0.0",
                    "authorship": {"kind": "ai-assisted", "humanShare": 0.5},
                    "scope": {
                        "filesTouched": ["src/index.ts"],
                        "linesAdded": 10,
                        "linesDeleted": 2,
                        "riskClass": "low",
                    },
                    "policy": {
                        "agentsMdPolicy": "v1",
                        "requiresHumanApproval": False,
                        "satisfied": True,
                    },
                }
            )

    def test_unknown_kind_raises_error(self) -> None:
        with pytest.raises(SchemaValidationError, match="Unknown authorship kind"):
            parse_predicate(
                {
                    "schemaVersion": "1.0.0",
                    "authorship": {"kind": "cyborg", "humanShare": 0.5},
                    "scope": {
                        "filesTouched": ["src/index.ts"],
                        "linesAdded": 10,
                        "linesDeleted": 0,
                        "riskClass": "low",
                    },
                    "policy": {
                        "agentsMdPolicy": "v1",
                        "requiresHumanApproval": False,
                        "satisfied": True,
                    },
                }
            )

    def test_missing_authorship_raises_error(self) -> None:
        with pytest.raises(SchemaValidationError, match="authorship"):
            parse_predicate(
                {
                    "schemaVersion": "1.0.0",
                    "scope": {
                        "filesTouched": ["src/index.ts"],
                        "linesAdded": 10,
                        "linesDeleted": 0,
                        "riskClass": "low",
                    },
                    "policy": {
                        "agentsMdPolicy": "v1",
                        "requiresHumanApproval": False,
                        "satisfied": True,
                    },
                }
            )
