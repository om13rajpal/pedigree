# pedigree-mcp

FastMCP server for cryptographic provenance attestation of AI-authored commits.

## Install

### One-liner for any MCP client (Bob, Cursor, Windsurf, etc.)

Add to your `.mcp.json` or MCP settings:

```json
{
  "mcpServers": {
    "pedigree": {
      "command": "uvx",
      "args": [
        "--from",
        "git+https://github.com/om13rajpal/pedigree.git#subdirectory=packages/pedigree-mcp",
        "pedigree-mcp"
      ]
    }
  }
}
```

That's it. The MCP client will install and run the server automatically.

### Manual install

```bash
# From GitHub
pip install "pedigree-mcp @ git+https://github.com/om13rajpal/pedigree.git#subdirectory=packages/pedigree-mcp"

# Or clone and install locally
git clone https://github.com/om13rajpal/pedigree.git
cd pedigree
uv sync --directory packages/pedigree-mcp
```

## MCP tools

`pedigree-mcp` exposes four tools over stdio transport:

| Tool              | Description                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `attest_commit`   | Creates a signed in-toto attestation for a commit. Validates the predicate, signs via ed25519 or Sigstore, stores in git attestation refs. |
| `verify_chain`    | Verifies the attestation chain. Reads the DSSE envelope, verifies the signature, validates the predicate schema.                           |
| `render_passport` | Builds a JSON payload for the Passport web page with predicate, verification status, and human-readable summary.                           |
| `health_check`    | Reports signer availability, git status, and registered tools.                                                                             |

## CLI

The same binary also provides a CLI for shell scripts and CI:

```bash
# Attest a commit
pedigree-mcp attest <sha> --predicate predicate.json --skip-rekor

# Verify a commit
pedigree-mcp verify <sha> --skip-rekor

# Render passport data
pedigree-mcp render <sha> --skip-rekor
```

## Signing backends

Set `PEDIGREE_SIGNER` to choose the signing backend:

| Value      | Description                                                                   |
| ---------- | ----------------------------------------------------------------------------- |
| `ed25519`  | Project-scoped ed25519 keypair (default). Keys stored in `~/.pedigree/keys/`. |
| `sigstore` | Keyless signing via gitsign + Fulcio + Rekor. Requires `gitsign` on PATH.     |
| `stub`     | Deterministic test signatures. For unit tests only.                           |

## Testing

```bash
uv run --directory packages/pedigree-mcp pytest           # 124 tests
uv run --directory packages/pedigree-mcp pytest --cov      # with coverage
```

## Architecture

```
pedigree_mcp/
  __main__.py      Entry point (MCP server or CLI dispatch)
  server.py        FastMCP tool registration
  cli.py           CLI subcommands (verify, attest, render)
  schema.py        Pydantic v2 models (mirrors Zod schema)
  attest.py        attest_commit workflow
  verify.py        verify_chain workflow
  render.py        render_passport workflow
  health.py        health_check diagnostics
  signing/
    interface.py   Signer protocol
    ed25519_signer.py   ed25519 keypair signer
    sigstore_signer.py  gitsign wrapper
    dsse.py        DSSE envelope build/parse
    __init__.py    get_signer() factory
  git_io.py        Git subprocess wrapper
  rekor_io.py      Rekor HTTP client
  statement.py     in-toto Statement builder
  errors.py        Error hierarchy
  constants.py     Shared constants
  logger.py        structlog JSON to stderr
```
