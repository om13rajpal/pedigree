"""CLI wrapper for pedigree-mcp -- enables shell-level access to verify and attest.

The GitHub Action and Bob Shell call this instead of the MCP stdio transport.
Outputs JSON to stdout and uses exit codes to signal results:
  0 = success
  1 = verification failure (attestation missing or broken)
  2 = unexpected error (bad arguments, internal fault)
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import NoReturn

from pedigree_mcp.attest import attest_commit
from pedigree_mcp.errors import PedigreeError
from pedigree_mcp.render import render_passport
from pedigree_mcp.verify import verify_chain


def _write_json(data: dict[str, object], *, file: object = sys.stdout) -> None:
    """Write a dict as compact JSON to the given file handle.

    Args:
        data: The dictionary to serialize.
        file: The writable file object (defaults to stdout).
    """
    json.dump(data, file, indent=2, default=str)  # type: ignore[arg-type]
    print(file=file)  # trailing newline


def _handle_verify(args: argparse.Namespace) -> int:
    """Run verify_chain for a single commit and print the result.

    Args:
        args: Parsed CLI arguments containing commit_sha and skip_rekor flag.

    Returns:
        Exit code: 0 on success, 1 on verification failure.
    """
    try:
        result = verify_chain(
            args.commit_sha,
            skip_rekor=args.skip_rekor,
        )
    except PedigreeError as exc:
        _write_json(
            {
                "commit_sha": args.commit_sha,
                "verified": False,
                "error": str(exc),
                "error_type": type(exc).__name__,
            }
        )
        return 1

    predicate_dict = result.predicate.model_dump(by_alias=True)
    _write_json(
        {
            "commit_sha": result.commit_sha,
            "verified": True,
            "signer_identity": result.signer_identity,
            "rekor_verified": result.rekor_verified,
            "predicate": predicate_dict,
        }
    )
    return 0


def _handle_attest(args: argparse.Namespace) -> int:
    """Run attest_commit for a single commit using a predicate from a JSON file.

    Args:
        args: Parsed CLI arguments containing commit_sha, predicate_file,
              skip_rekor, and skip_git_write flags.

    Returns:
        Exit code: 0 on success, 1 on attestation failure.
    """
    try:
        with open(args.predicate_file, encoding="utf-8") as fh:
            predicate_dict = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        _write_json(
            {
                "commit_sha": args.commit_sha,
                "attested": False,
                "error": f"Failed to read predicate file: {exc}",
                "error_type": type(exc).__name__,
            }
        )
        return 1

    if not isinstance(predicate_dict, dict):
        _write_json(
            {
                "commit_sha": args.commit_sha,
                "attested": False,
                "error": "Predicate file must contain a JSON object",
                "error_type": "ValueError",
            }
        )
        return 1

    try:
        result = attest_commit(
            args.commit_sha,
            predicate_dict,
            skip_rekor=args.skip_rekor,
            skip_git_write=args.skip_git_write,
        )
    except PedigreeError as exc:
        _write_json(
            {
                "commit_sha": args.commit_sha,
                "attested": False,
                "error": str(exc),
                "error_type": type(exc).__name__,
            }
        )
        return 1

    _write_json(
        {
            "commit_sha": result.commit_sha,
            "attested": True,
            "rekor_uuid": result.rekor_uuid,
            "rekor_url": result.rekor_url,
            "signer_identity": result.signer_identity,
        }
    )
    return 0


def _handle_render(args: argparse.Namespace) -> int:
    """Run render_passport for a single commit and print the result.

    Args:
        args: Parsed CLI arguments containing commit_sha and skip_rekor flag.

    Returns:
        Exit code: 0 on success, 1 on rendering failure.
    """
    try:
        result = render_passport(
            args.commit_sha,
            skip_rekor=args.skip_rekor,
        )
    except PedigreeError as exc:
        _write_json(
            {
                "commit_sha": args.commit_sha,
                "rendered": False,
                "error": str(exc),
                "error_type": type(exc).__name__,
            }
        )
        return 1

    _write_json(
        {
            "commit_sha": result.commit_sha,
            "rendered": True,
            "predicate": result.predicate,
            "signer_identity": result.signer_identity,
            "rekor_verified": result.rekor_verified,
            "rekor_entry_url": result.rekor_entry_url,
            "summary": result.summary,
        }
    )
    return 0


def _build_parser() -> argparse.ArgumentParser:
    """Build the CLI argument parser with verify, attest, and render subcommands.

    Returns:
        A configured ArgumentParser instance.
    """
    parser = argparse.ArgumentParser(
        prog="pedigree_mcp.cli",
        description="CLI for Pedigree attestation verification and creation",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # -- verify subcommand --
    verify_parser = subparsers.add_parser(
        "verify",
        help="Verify the attestation chain for a commit",
    )
    verify_parser.add_argument(
        "commit_sha",
        help="The git commit SHA to verify (lowercase hex, 40 chars)",
    )
    verify_parser.add_argument(
        "--skip-rekor",
        action="store_true",
        default=False,
        help="Skip Rekor transparency log verification",
    )

    # -- attest subcommand --
    attest_parser = subparsers.add_parser(
        "attest",
        help="Create a signed attestation for a commit",
    )
    attest_parser.add_argument(
        "commit_sha",
        help="The git commit SHA to attest (lowercase hex, 40 chars)",
    )
    attest_parser.add_argument(
        "--predicate",
        dest="predicate_file",
        required=True,
        help="Path to a JSON file containing the predicate",
    )
    attest_parser.add_argument(
        "--skip-rekor",
        action="store_true",
        default=False,
        help="Skip Rekor transparency log submission",
    )
    attest_parser.add_argument(
        "--skip-git-write",
        action="store_true",
        default=False,
        help="Skip writing attestation to git refs",
    )

    # -- render subcommand --
    render_parser = subparsers.add_parser(
        "render",
        help="Render a Passport page payload for a commit",
    )
    render_parser.add_argument(
        "commit_sha",
        help="The git commit SHA to render (lowercase hex, 40 chars)",
    )
    render_parser.add_argument(
        "--skip-rekor",
        action="store_true",
        default=False,
        help="Skip Rekor transparency log verification",
    )

    return parser


def main() -> NoReturn:
    """Parse arguments and dispatch to the appropriate handler.

    Exits with code 0 on success, 1 on verification/attestation/render failure,
    and 2 on argument errors or unexpected faults.
    """
    parser = _build_parser()
    args = parser.parse_args()

    try:
        if args.command == "verify":
            code = _handle_verify(args)
        elif args.command == "attest":
            code = _handle_attest(args)
        elif args.command == "render":
            code = _handle_render(args)
        else:
            parser.print_help(sys.stderr)
            sys.exit(2)
    except Exception as exc:
        # Catch-all for truly unexpected errors -- never silent
        _write_json(
            {"error": f"Unexpected error: {exc}", "error_type": type(exc).__name__},
            file=sys.stderr,
        )
        sys.exit(2)

    sys.exit(code)


if __name__ == "__main__":
    main()
