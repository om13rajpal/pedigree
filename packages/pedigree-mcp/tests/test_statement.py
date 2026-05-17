"""Tests for the in-toto Statement builder and models."""

from __future__ import annotations

import pytest
from pedigree_mcp.errors import SchemaValidationError
from pedigree_mcp.schema import parse_predicate
from pedigree_mcp.statement import build_statement

from tests.conftest import load_predicate


class TestBuildStatement:
    """Tests for the build_statement function."""

    def test_builds_valid_statement(self) -> None:
        predicate = parse_predicate(load_predicate("valid-ai-assisted.json"))
        statement = build_statement("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2", predicate)
        assert statement.type_ == "https://in-toto.io/Statement/v1"
        assert statement.predicate_type == "dev.pedigree/ai-authorship/v1"
        assert len(statement.subject) == 1
        assert statement.subject[0].digest["sha1"] == "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"

    def test_rejects_uppercase_commit_sha(self) -> None:
        predicate = parse_predicate(load_predicate("valid-ai-assisted.json"))
        with pytest.raises(SchemaValidationError, match="lowercase hex"):
            build_statement("A1B2C3D4", predicate)

    def test_rejects_non_hex_commit_sha(self) -> None:
        predicate = parse_predicate(load_predicate("valid-ai-assisted.json"))
        with pytest.raises(SchemaValidationError, match="lowercase hex"):
            build_statement("not-a-hex-sha", predicate)

    def test_builds_statement_for_human_predicate(self) -> None:
        predicate = parse_predicate(load_predicate("valid-human.json"))
        statement = build_statement("b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3", predicate)
        assert statement.subject[0].name == "git+commit"

    def test_builds_statement_for_autonomous_predicate(self) -> None:
        predicate = parse_predicate(load_predicate("valid-ai-autonomous.json"))
        statement = build_statement("c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4", predicate)
        assert statement.predicate_type == "dev.pedigree/ai-authorship/v1"
