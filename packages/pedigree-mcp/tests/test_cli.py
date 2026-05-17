"""Tests for the CLI wrapper at pedigree_mcp.cli.

Covers the main entry point with both verify and attest subcommands,
ensuring correct exit codes and error handling.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path  # noqa: TCH003
from unittest.mock import patch

import pytest
from pedigree_mcp.cli import main

from tests.conftest import load_predicate


@pytest.fixture(autouse=True)
def _use_stub_signer(monkeypatch: pytest.MonkeyPatch) -> None:
    """Force StubSigner for all tests in this module."""
    monkeypatch.setenv("PEDIGREE_SIGNER", "stub")


class TestMainFunction:
    """Tests for the main CLI entry point."""

    def test_main_verify_command(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test main function with verify command."""
        sha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"

        monkeypatch.setattr(sys, "argv", ["pedigree_mcp.cli", "verify", sha, "--skip-rekor"])

        with patch("pedigree_mcp.cli.verify_chain") as mock_verify:
            from pedigree_mcp.schema import parse_predicate
            from pedigree_mcp.verify import VerifyResult

            predicate = parse_predicate(load_predicate("valid-ai-assisted.json"))
            mock_verify.return_value = VerifyResult(
                commit_sha=sha,
                predicate=predicate,
                signer_identity="stub-signer@pedigree.dev",
                rekor_verified=False,
            )

            with pytest.raises(SystemExit) as exc_info:
                main()

            assert exc_info.value.code == 0

    def test_main_attest_command(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test main function with attest command."""
        sha = "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"
        predicate_dict = load_predicate("valid-human.json")

        predicate_file = tmp_path / "predicate.json"
        predicate_file.write_text(json.dumps(predicate_dict))

        monkeypatch.setattr(
            sys,
            "argv",
            [
                "pedigree_mcp.cli",
                "attest",
                sha,
                "--predicate",
                str(predicate_file),
                "--skip-rekor",
                "--skip-git-write",
            ],
        )

        with patch("pedigree_mcp.cli.attest_commit") as mock_attest:
            from pedigree_mcp.attest import AttestResult

            mock_attest.return_value = AttestResult(
                commit_sha=sha,
                rekor_uuid="",
                rekor_url="",
                signer_identity="stub-signer@pedigree.dev",
            )

            with pytest.raises(SystemExit) as exc_info:
                main()

            assert exc_info.value.code == 0

    def test_main_unexpected_error(
        self, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture
    ) -> None:
        """Test main function handles unexpected errors."""
        sha = "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"

        monkeypatch.setattr(sys, "argv", ["pedigree_mcp.cli", "verify", sha, "--skip-rekor"])

        with patch("pedigree_mcp.cli.verify_chain") as mock_verify:
            mock_verify.side_effect = RuntimeError("Unexpected error")

            with pytest.raises(SystemExit) as exc_info:
                main()

            assert exc_info.value.code == 2
            captured = capsys.readouterr()
            assert "Unexpected error" in captured.err
