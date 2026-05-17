"""Entry point for pedigree-mcp.

Works as both `python -m pedigree_mcp` and the `pedigree-mcp` console script.
Routes to the CLI if subcommands are given, otherwise starts the MCP server.
"""

import sys


def main() -> None:
    """Dispatch to CLI or MCP server based on arguments."""
    cli_commands = {"verify", "attest", "render", "health", "--help", "-h"}
    if len(sys.argv) > 1 and sys.argv[1] in cli_commands:
        from pedigree_mcp.cli import main as cli_main

        cli_main()
    else:
        from pedigree_mcp.server import run_server

        run_server()


if __name__ == "__main__":
    main()
