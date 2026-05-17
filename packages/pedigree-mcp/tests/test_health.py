"""Tests for the health_check tool.

Tests various system states: git available/unavailable, different signer
backends, and repository detection. Uses mocking to simulate different
environments without requiring actual installations.
"""

from __future__ import annotations

from pathlib import Path  # noqa: TCH003
from unittest.mock import MagicMock, patch

from pedigree_mcp.health import (
    HealthStatus,
    _check_ed25519_availability,
    _check_git_availability,
    _check_sigstore_availability,
    _get_repo_root,
    health_check,
)

# ---------------------------------------------------------------------------
# Helper function tests
# ---------------------------------------------------------------------------


class TestCheckGitAvailability:
    """Tests for _check_git_availability helper."""

    def test_returns_true_when_git_on_path(self) -> None:
        with patch("pedigree_mcp.health.shutil.which", return_value="/usr/bin/git"):
            assert _check_git_availability() is True

    def test_returns_false_when_git_not_on_path(self) -> None:
        with patch("pedigree_mcp.health.shutil.which", return_value=None):
            assert _check_git_availability() is False


class TestGetRepoRoot:
    """Tests for _get_repo_root helper."""

    def test_returns_none_when_git_unavailable(self) -> None:
        with patch("pedigree_mcp.health._check_git_availability", return_value=False):
            assert _get_repo_root() is None

    def test_returns_repo_root_when_in_git_repo(self) -> None:
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "/home/user/project\n"

        with (
            patch("pedigree_mcp.health._check_git_availability", return_value=True),
            patch("pedigree_mcp.health.subprocess.run", return_value=mock_result),
        ):
            result = _get_repo_root()
            assert result == "/home/user/project"

    def test_returns_none_when_not_in_git_repo(self) -> None:
        mock_result = MagicMock()
        mock_result.returncode = 128  # git error code for "not a git repository"
        mock_result.stdout = ""

        with (
            patch("pedigree_mcp.health._check_git_availability", return_value=True),
            patch("pedigree_mcp.health.subprocess.run", return_value=mock_result),
        ):
            result = _get_repo_root()
            assert result is None

    def test_returns_none_on_subprocess_timeout(self) -> None:
        with (
            patch("pedigree_mcp.health._check_git_availability", return_value=True),
            patch(
                "pedigree_mcp.health.subprocess.run",
                side_effect=Exception("timeout"),
            ),
        ):
            result = _get_repo_root()
            assert result is None


class TestCheckSigstoreAvailability:
    """Tests for _check_sigstore_availability helper."""

    def test_returns_false_when_gitsign_not_found(self) -> None:
        with patch("pedigree_mcp.health.shutil.which", return_value=None):
            available, message = _check_sigstore_availability()
            assert available is False
            assert "gitsign not found" in message

    def test_returns_false_when_gitsign_attest_not_found(self) -> None:
        def which_side_effect(cmd: str) -> str | None:
            return "/usr/bin/gitsign" if cmd == "gitsign" else None

        with patch("pedigree_mcp.health.shutil.which", side_effect=which_side_effect):
            available, message = _check_sigstore_availability()
            assert available is False
            assert "gitsign-attest not found" in message

    def test_returns_true_with_identity_when_both_found(self) -> None:
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "user@example.com\n"

        def which_side_effect(cmd: str) -> str:
            return f"/usr/bin/{cmd}"

        with (
            patch("pedigree_mcp.health.shutil.which", side_effect=which_side_effect),
            patch("pedigree_mcp.health.subprocess.run", return_value=mock_result),
        ):
            available, identity = _check_sigstore_availability()
            assert available is True
            assert identity == "sigstore:user@example.com"

    def test_returns_pending_auth_when_gitsign_show_fails(self) -> None:
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stdout = ""

        def which_side_effect(cmd: str) -> str:
            return f"/usr/bin/{cmd}"

        with (
            patch("pedigree_mcp.health.shutil.which", side_effect=which_side_effect),
            patch("pedigree_mcp.health.subprocess.run", return_value=mock_result),
        ):
            available, identity = _check_sigstore_availability()
            assert available is True
            assert identity == "sigstore:pending-oidc-auth"

    def test_handles_subprocess_exception(self) -> None:
        def which_side_effect(cmd: str) -> str:
            return f"/usr/bin/{cmd}"

        with (
            patch("pedigree_mcp.health.shutil.which", side_effect=which_side_effect),
            patch(
                "pedigree_mcp.health.subprocess.run",
                side_effect=OSError("connection error"),
            ),
        ):
            available, identity = _check_sigstore_availability()
            assert available is True
            assert "error-querying-identity" in identity
            assert "OSError" in identity


class TestCheckEd25519Availability:
    """Tests for _check_ed25519_availability helper."""

    def test_returns_false_when_keys_dir_missing(self, tmp_path: Path) -> None:
        _ = tmp_path / "nonexistent"
        with patch("pedigree_mcp.health.Path.home", return_value=tmp_path):
            available, message = _check_ed25519_availability()
            assert available is False
            assert "keys directory does not exist" in message

    def test_returns_false_when_no_private_keys(self, tmp_path: Path) -> None:
        keys_dir = tmp_path / ".pedigree" / "keys"
        keys_dir.mkdir(parents=True)

        with patch("pedigree_mcp.health.Path.home", return_value=tmp_path):
            available, message = _check_ed25519_availability()
            assert available is False
            assert "no private keys found" in message

    def test_returns_true_when_private_key_exists(self, tmp_path: Path) -> None:
        keys_dir = tmp_path / ".pedigree" / "keys"
        keys_dir.mkdir(parents=True)
        (keys_dir / "test-repo.priv").write_text("fake-key-data")

        with patch("pedigree_mcp.health.Path.home", return_value=tmp_path):
            available, identity = _check_ed25519_availability()
            assert available is True
            assert identity == "ed25519:test-repo"

    def test_returns_first_key_when_multiple_exist(self, tmp_path: Path) -> None:
        keys_dir = tmp_path / ".pedigree" / "keys"
        keys_dir.mkdir(parents=True)
        (keys_dir / "repo-a.priv").write_text("fake-key-a")
        (keys_dir / "repo-b.priv").write_text("fake-key-b")

        with patch("pedigree_mcp.health.Path.home", return_value=tmp_path):
            available, identity = _check_ed25519_availability()
            assert available is True
            # Should return one of the keys (order may vary)
            assert identity.startswith("ed25519:")
            assert identity in ["ed25519:repo-a", "ed25519:repo-b"]


# ---------------------------------------------------------------------------
# Main health_check function tests
# ---------------------------------------------------------------------------


class TestHealthCheck:
    """Tests for the main health_check function."""

    def test_reports_sigstore_when_available(self) -> None:
        with (
            patch(
                "pedigree_mcp.health._check_git_availability",
                return_value=True,
            ),
            patch(
                "pedigree_mcp.health._get_repo_root",
                return_value="/home/user/project",
            ),
            patch(
                "pedigree_mcp.health._check_sigstore_availability",
                return_value=(True, "sigstore:user@example.com"),
            ),
        ):
            status = health_check()
            assert status.signer_type == "sigstore"
            assert status.signer_identity == "sigstore:user@example.com"
            assert status.git_available is True
            assert status.repo_root == "/home/user/project"
            assert "health_check" in status.tools_registered

    def test_falls_back_to_ed25519_when_sigstore_unavailable(self, tmp_path: Path) -> None:
        keys_dir = tmp_path / ".pedigree" / "keys"
        keys_dir.mkdir(parents=True)
        (keys_dir / "test-repo.priv").write_text("fake-key")

        with (
            patch(
                "pedigree_mcp.health._check_git_availability",
                return_value=True,
            ),
            patch(
                "pedigree_mcp.health._get_repo_root",
                return_value="/home/user/project",
            ),
            patch(
                "pedigree_mcp.health._check_sigstore_availability",
                return_value=(False, "gitsign not found on PATH"),
            ),
            patch("pedigree_mcp.health.Path.home", return_value=tmp_path),
        ):
            status = health_check()
            assert status.signer_type == "ed25519"
            assert status.signer_identity == "ed25519:test-repo"

    def test_reports_no_signer_when_both_unavailable(self) -> None:
        with (
            patch(
                "pedigree_mcp.health._check_git_availability",
                return_value=True,
            ),
            patch(
                "pedigree_mcp.health._get_repo_root",
                return_value="/home/user/project",
            ),
            patch(
                "pedigree_mcp.health._check_sigstore_availability",
                return_value=(False, "gitsign not found on PATH"),
            ),
            patch(
                "pedigree_mcp.health._check_ed25519_availability",
                return_value=(False, "no private keys found"),
            ),
        ):
            status = health_check()
            assert status.signer_type == "none"
            assert "gitsign not found" in status.signer_identity
            assert "no private keys found" in status.signer_identity

    def test_reports_git_unavailable(self) -> None:
        with (
            patch(
                "pedigree_mcp.health._check_git_availability",
                return_value=False,
            ),
            patch(
                "pedigree_mcp.health._check_sigstore_availability",
                return_value=(True, "sigstore:user@example.com"),
            ),
        ):
            status = health_check()
            assert status.git_available is False
            assert status.repo_root is None

    def test_reports_not_in_git_repo(self) -> None:
        with (
            patch(
                "pedigree_mcp.health._check_git_availability",
                return_value=True,
            ),
            patch(
                "pedigree_mcp.health._get_repo_root",
                return_value=None,
            ),
            patch(
                "pedigree_mcp.health._check_sigstore_availability",
                return_value=(True, "sigstore:user@example.com"),
            ),
        ):
            status = health_check()
            assert status.git_available is True
            assert status.repo_root is None

    def test_includes_all_registered_tools(self) -> None:
        with (
            patch(
                "pedigree_mcp.health._check_git_availability",
                return_value=True,
            ),
            patch(
                "pedigree_mcp.health._get_repo_root",
                return_value="/home/user/project",
            ),
            patch(
                "pedigree_mcp.health._check_sigstore_availability",
                return_value=(True, "sigstore:user@example.com"),
            ),
        ):
            status = health_check()
            assert len(status.tools_registered) == 4
            assert "attest_commit" in status.tools_registered
            assert "verify_chain" in status.tools_registered
            assert "render_passport" in status.tools_registered
            assert "health_check" in status.tools_registered

    def test_returns_health_status_dataclass(self) -> None:
        with (
            patch(
                "pedigree_mcp.health._check_git_availability",
                return_value=True,
            ),
            patch(
                "pedigree_mcp.health._get_repo_root",
                return_value="/home/user/project",
            ),
            patch(
                "pedigree_mcp.health._check_sigstore_availability",
                return_value=(True, "sigstore:user@example.com"),
            ),
        ):
            status = health_check()
            assert isinstance(status, HealthStatus)
            assert hasattr(status, "signer_type")
            assert hasattr(status, "signer_identity")
            assert hasattr(status, "git_available")
            assert hasattr(status, "repo_root")
            assert hasattr(status, "tools_registered")


# Made with Bob
