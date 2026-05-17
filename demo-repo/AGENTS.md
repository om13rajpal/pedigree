# AGENTS.md -- Pedigree Demo TODO API

## Provenance Policy

- Every commit modifying `src/**` MUST carry an in-toto attestation of type `dev.pedigree/ai-authorship/v1` signed via Sigstore.
- Commits modifying `src/auth/**`, `src/payments/**`, or `migrations/**` MUST have `predicate.authorship.humanApprover.approved == true`.
- CI (.github/workflows/pedigree.yml) enforces the above.

## Risk classes

- high: src/auth/**, src/payments/**, migrations/\*\*
- medium: src/api/**, src/services/**
- low: docs/**, tests/**, examples/\*\*

## How to commit as a human

`git commit -S -m "..."` (your normal GPG/SSH signing key)

## How to commit as Bob

Activate the `provenance-officer` mode. The `sign-on-commit` Skill handles the rest.

## How another AI agent commits

Call the `pedigree-mcp` MCP server, tool `attest_commit`. Stdio transport, locally launched. See ../packages/pedigree-mcp/README.md.
