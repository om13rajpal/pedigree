# Pedigree Verify Action

A composite GitHub Action that verifies cryptographic provenance attestations for every commit in a pull request. Blocks merges when attestations are missing, malformed, or carry unsatisfied policies.

## What it checks

For each commit in the PR's range, the action:

1. Reads the in-toto DSSE envelope from `refs/attestations/commits/<sha>`.
2. Verifies the cryptographic signature (Sigstore OIDC or ed25519 fallback).
3. Validates the predicate against the `dev.pedigree/ai-authorship/v1` schema.
4. Confirms the statement's subject matches the commit SHA.
5. Checks that `policy.satisfied` is true.

If any commit fails verification, the action exits non-zero and (optionally) posts a summary comment on the PR.

## Usage

Add to your workflow file (`.github/workflows/pedigree.yml`):

```yaml
name: Pedigree Verification
on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: agiready/pedigree-action@main
        with:
          fail-on-unsigned: 'true'
          comment-on-pr: 'true'
```

**Important:** `fetch-depth: 0` is required so the action can access all commits in the PR range and their attestation refs.

## Inputs

| Input              | Required | Default                         | Description                                             |
| ------------------ | -------- | ------------------------------- | ------------------------------------------------------- |
| `predicate-type`   | No       | `dev.pedigree/ai-authorship/v1` | The in-toto predicate type to require                   |
| `fail-on-unsigned` | No       | `true`                          | Fail the action if any commit lacks a valid attestation |
| `comment-on-pr`    | No       | `true`                          | Post a markdown summary comment on the PR               |
| `mcp-path`         | No       | `packages/pedigree-mcp`         | Path to pedigree-mcp package relative to repo root      |

## Outputs

| Output        | Description                                                    |
| ------------- | -------------------------------------------------------------- |
| `passed`      | `true` if all commits verified successfully, `false` otherwise |
| `report-json` | JSON report with per-commit verification status                |

## PR comment

When `comment-on-pr` is enabled, the action posts (or updates) a comment like:

```
### ✅ Pedigree Verification: Passed

**Summary:** 3 total | 3 passed | 0 failed

All 3 commit(s) carry valid attestations.

| Commit | Status | Agent | Risk | Approved |
|--------|--------|-------|------|----------|
| `abc1234abcd` | Verified | ibm-bob | medium | Yes |
| `def5678efab` | Verified | ibm-bob | low | No |
| `912cafe3210` | Verified | cursor | high | Yes |

---
Verified by Pedigree -- cryptographic provenance for AI-written code.
```

Subsequent pushes to the same PR update the existing comment rather than creating duplicates.

## How it works

The action uses `pedigree-mcp`'s CLI interface (`python -m pedigree_mcp.cli verify <sha>`) to verify each commit. The CLI returns structured JSON output, which the shell driver collects into a report.

### Dependencies

- **Python 3.11+** (set up by the action)
- **uv** (installed automatically if absent)
- **jq** (pre-installed on GitHub-hosted runners)
- **gitsign** (optional; the ed25519 fallback signer works without it)

## Local Testing

You can test the verification scripts locally without running the full GitHub Action. This is useful for debugging, development, or verifying commits before pushing.

### Prerequisites

```bash
# Install Python dependencies
uv sync --directory packages/pedigree-mcp

# Ensure jq is installed (for JSON processing)
# macOS: brew install jq
# Ubuntu/Debian: apt-get install jq
```

### Test a single commit

Use the pedigree-mcp CLI directly:

```bash
uv run --directory packages/pedigree-mcp \
  python -m pedigree_mcp.cli verify <commit-sha>
```

This outputs JSON with the verification result and predicate details.

### Test a commit range

Run the same verification script the Action uses:

```bash
./packages/pedigree-action/scripts/verify.sh <base-sha> <head-sha>
```

Example:

```bash
# Verify the last 3 commits
./packages/pedigree-action/scripts/verify.sh HEAD~3 HEAD
```

### Save report to file

Use the `--json-output` flag to write the report to a file instead of GITHUB_OUTPUT:

```bash
./packages/pedigree-action/scripts/verify.sh \
  --json-output report.json \
  <base-sha> <head-sha>
```

This creates a `report.json` file with the full verification report:

```json
{
  "commits": [
    {
      "sha": "abc123...",
      "short": "abc123abcdef",
      "status": "verified",
      "agent": "ibm-bob",
      "risk": "medium",
      "approved": "true",
      "policy_satisfied": "true"
    }
  ],
  "total": 1,
  "verified": 1,
  "failed": 0,
  "passed": true
}
```

### Test with environment variables

Override default behavior using environment variables:

```bash
# Don't fail on unsigned commits (useful for testing)
FAIL_ON_UNSIGNED=false ./packages/pedigree-action/scripts/verify.sh HEAD~3 HEAD

# Use a different predicate type
PREDICATE_TYPE=custom/type/v1 ./packages/pedigree-action/scripts/verify.sh HEAD~3 HEAD

# Point to a different pedigree-mcp location
MCP_PATH=/path/to/pedigree-mcp ./packages/pedigree-action/scripts/verify.sh HEAD~3 HEAD
```

### Test initial commit

The script handles repositories with no parent commit gracefully:

```bash
# In a new repo with only one commit
./packages/pedigree-action/scripts/verify.sh "" HEAD
```

### Simulate PR comment locally

After generating a report, you can preview the PR comment format:

```bash
# Generate report
./packages/pedigree-action/scripts/verify.sh \
  --json-output report.json \
  HEAD~3 HEAD

# Preview comment (requires gh CLI and GH_TOKEN)
export REPORT_JSON="$(cat report.json)"
export PR_NUMBER=123
export REPO=owner/repo
./packages/pedigree-action/scripts/post-comment.sh
```

## Predicate specification

See [`docs/predicate-spec.md`](../../docs/predicate-spec.md) for the full `dev.pedigree/ai-authorship/v1` predicate specification.

## License

MIT
