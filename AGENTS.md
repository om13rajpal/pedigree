# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Provenance Policy

- Every commit modifying `src/**` MUST carry an in-toto attestation of type `dev.pedigree/ai-authorship/v1` signed via Sigstore
- Commits modifying `src/auth/**`, `src/payments/**`, or `migrations/**` MUST have `predicate.authorship.humanApprover.approved == true`
- CI (.github/workflows/pedigree.yml) enforces the above

## Risk Classes

- high: src/auth/**, src/payments/**, migrations/\*\*
- medium: src/api/**, src/services/**
- low: docs/**, tests/**, examples/\*\*

## Schema Synchronization (Critical)

- Predicate schema defined in TWO places: [`packages/pedigree-types/src/predicate.ts`](packages/pedigree-types/src/predicate.ts) (Zod) and [`packages/pedigree-mcp/src/pedigree_mcp/schema.py`](packages/pedigree-mcp/src/pedigree_mcp/schema.py) (Pydantic)
- These MUST stay in sync - run `pnpm verify-schemas` before committing schema changes
- Script validates both accept/reject same fixtures in [`packages/pedigree-types/tests/fixtures/`](packages/pedigree-types/tests/fixtures/)

## Python Package Management (Non-Standard)

- Use `uv` (not pip/poetry) for all Python operations in [`packages/pedigree-mcp/`](packages/pedigree-mcp/)
- Install: `uv sync --directory packages/pedigree-mcp`
- Run tests: `uv run pytest` (from [`packages/pedigree-mcp/`](packages/pedigree-mcp/) directory)
- Run MCP server: `uv run --directory packages/pedigree-mcp python -m pedigree_mcp`

## Monorepo Commands (Directory-Specific)

- Root commands affect ALL packages: `pnpm test`, `pnpm lint`, `pnpm build`
- Package-specific: `pnpm --filter pedigree-web dev` (not `cd packages/pedigree-web && pnpm dev`)
- Python tests MUST run from [`packages/pedigree-mcp/`](packages/pedigree-mcp/) directory (fixtures use relative paths)

## Testing Requirements

- Python: `pytest` with `asyncio_mode = "auto"` in [`pyproject.toml`](packages/pedigree-mcp/pyproject.toml)
- Integration tests marked with `@pytest.mark.integration` (require gitsign installed)
- TypeScript: `vitest` for unit tests, fixtures loaded via [`readFileSync`](packages/pedigree-types/tests/predicate.test.ts:23) helper
- Test fixtures duplicated in both [`packages/pedigree-types/tests/fixtures/`](packages/pedigree-types/tests/fixtures/) and [`packages/pedigree-mcp/tests/fixtures/`](packages/pedigree-mcp/tests/fixtures/) (intentional - each package validates independently)

## Constants Location (Single Source of Truth)

- Predicate type URI `dev.pedigree/ai-authorship/v1` defined ONLY in [`packages/pedigree-types/src/constants.ts`](packages/pedigree-types/src/constants.ts:4) (TS) and [`packages/pedigree-mcp/src/pedigree_mcp/constants.py`](packages/pedigree-mcp/src/pedigree_mcp/constants.py:6) (Python)
- Never hardcode these strings elsewhere

## Error Handling Pattern

- All errors inherit from `PedigreeError` base class (both TS and Python)
- Python: [`packages/pedigree-mcp/src/pedigree_mcp/errors.py`](packages/pedigree-mcp/src/pedigree_mcp/errors.py)
- TypeScript: [`packages/pedigree-types/src/errors.ts`](packages/pedigree-types/src/errors.ts)
- Use specific subclasses (`SchemaValidationError`, `SigningError`, etc.) not base class

## File Size Limit

- Hard limit: 400 lines per code file (enforced by linting)
- Does NOT apply to: generated files (`pnpm-lock.yaml`, `uv.lock`), documentation (`*.md`), config files

## How to Commit

- Human: `git commit -S -m "..."` (GPG/SSH signing)
- Bob: Activate `provenance-officer` mode (see [`.bob/modes/provenance-officer.yaml`](.bob/modes/provenance-officer.yaml))
- Other AI agents: Call `pedigree-mcp` MCP server, tool `attest_commit` (stdio transport)
