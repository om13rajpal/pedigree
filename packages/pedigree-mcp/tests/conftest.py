"""Shared pytest fixtures for pedigree-mcp tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture()
def fixtures_dir() -> Path:
    """Return the path to the test fixtures directory."""
    return FIXTURES_DIR


def load_fixture(name: str) -> dict:
    """Load a JSON fixture by filename.

    Args:
        name: The fixture filename (e.g. 'valid-ai-assisted.json').

    Returns:
        The parsed JSON content as a dict.
    """
    path = FIXTURES_DIR / name
    return json.loads(path.read_text(encoding="utf-8"))


def load_predicate(name: str) -> dict:
    """Load just the predicate portion from a statement fixture.

    Args:
        name: The fixture filename (e.g. 'valid-ai-assisted.json').

    Returns:
        The predicate dict extracted from the statement fixture.
    """
    statement = load_fixture(name)
    return statement["predicate"]


def load_statement(name: str) -> dict:
    """Load a full statement fixture.

    Args:
        name: The fixture filename (e.g. 'valid-ai-assisted.json').

    Returns:
        The full statement dict.
    """
    return load_fixture(name)


@pytest.fixture()
def valid_ai_assisted_predicate() -> dict:
    """Return a valid ai-assisted predicate dict."""
    return load_predicate("valid-ai-assisted.json")


@pytest.fixture()
def valid_ai_autonomous_predicate() -> dict:
    """Return a valid ai-autonomous predicate dict."""
    return load_predicate("valid-ai-autonomous.json")


@pytest.fixture()
def valid_human_predicate() -> dict:
    """Return a valid human predicate dict."""
    return load_predicate("valid-human.json")


@pytest.fixture()
def valid_ai_assisted_statement() -> dict:
    """Return a valid ai-assisted full statement dict."""
    return load_statement("valid-ai-assisted.json")


@pytest.fixture()
def sample_commit_sha() -> str:
    """Return a sample lowercase hex commit SHA for testing."""
    return "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
