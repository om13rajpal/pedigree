---
name: sign-on-commit
description: >
  Signs an AI-authored git commit with an in-toto attestation of type
  dev.pedigree/ai-authorship/v1. Computes predicate fields from the current
  session context, fills the attest-template.json scaffold, calls pedigree-mcp's
  attest_commit tool, and validates that the signed attestation was stored in
  refs/attestations/commits and recorded in the Rekor transparency log.
trigger:
  automatic
  # Activated by the provenance-officer mode before every git commit that
  # modifies tracked source files.
---

# sign-on-commit

Core attestation workflow for Pedigree. This Skill is the bridge between Bob's
code-generation session and the cryptographic signing infrastructure.

## Prerequisites

- The `provenance-officer` mode is active.
- The `pedigree-mcp` server is running (stdio transport).
- Staged changes exist in the git index.
- AGENTS.md exists at the repository root.

## Pre-flight checks

Before starting the signing workflow, validate that all required tools and
resources are available. Exit early with a clear error message if any check
fails.

### Check 1 -- pedigree-mcp server reachable

Attempt to connect to the `pedigree-mcp` MCP server via stdio transport:

```bash
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | \
  uv run --directory packages/pedigree-mcp python -m pedigree_mcp
```

Expected: JSON response listing available tools (`attest_commit`, `verify_chain`, `render_passport`).

**If fails**: Report "pedigree-mcp server not reachable. Start it with: `uv run --directory packages/pedigree-mcp python -m pedigree_mcp`"

### Check 2 -- Git repository valid

Verify we're in a git repository with staged changes:

```bash
git rev-parse --git-dir && git diff --cached --quiet
```

Expected: First command succeeds (returns `.git`), second command exits non-zero (staged changes exist).

**If fails**: Report "No git repository found" or "No staged changes to attest"

### Check 3 -- AGENTS.md exists

```bash
test -f AGENTS.md
```

Expected: File exists at repository root.

**If fails**: Report "AGENTS.md not found at repository root. This file is required for policy evaluation."

### Check 4 -- Sigstore tools available (optional)

Check if `gitsign` is installed for Sigstore signing:

```bash
which gitsign
```

Expected: Path to gitsign binary.

**If fails**: Log a warning "gitsign not found, will use ed25519 fallback signing" but continue (not a hard failure).

### Check 5 -- Template file exists

```bash
test -f .bob/skills/sign-on-commit/attest-template.json
```

Expected: Template file exists.

**If fails**: Report "attest-template.json not found in Skill directory"

All checks must pass (except Check 4, which is optional) before proceeding to
Step 1 of the workflow.

## Workflow

### Step 1 -- Gather context

Collect the following from the current session:

| Field                        | Source                                                                      |
| ---------------------------- | --------------------------------------------------------------------------- |
| `agent.tool`                 | `"ibm-bob"` (constant)                                                      |
| `agent.toolVersion`          | Bob's reported version string                                               |
| `agent.model`                | The model active in this session (e.g. `"granite-3.3-8b-instruct"`)         |
| `agent.modelProvider`        | The provider for the active model (e.g. `"watsonx.ai"`)                     |
| `authorship.kind`            | `"ai-assisted"` if a human participated; `"ai-autonomous"` otherwise        |
| `authorship.humanShare`      | Estimated fraction `[0.0, 1.0]` of human contribution; `null` if autonomous |
| `execution.modeSlug`         | `"provenance-officer"`                                                      |
| `execution.bobSessionId`     | Current Bob session UUID                                                    |
| `execution.bobcoinsConsumed` | Bobcoins used so far in this session                                        |

### Step 2 -- Compute hashes

All hashes use SHA-256 and are lowercase hex.

1. **AGENTS.md hash**: Read `AGENTS.md` at repo root, compute SHA-256, prefix with `sha256:`.
2. **Prompt hash**: Hash the user prompt that started this task, prefix with `sha256:`.
3. **Plan hash**: Hash the plan/spec document (BUILD-PLAN.md or task-specific plan), prefix with `sha256:`.
4. **Skill hashes**: For each Skill invoked during this session, hash its `SKILL.md` file. Store as an array of `{ name: "<slug>", sha256: "<hex>" }`.

### Step 3 -- Determine scope

From the staged diff (`git diff --cached --stat`):

1. List all files touched.
2. Count lines added and deleted.
3. Classify risk by matching file paths against `AGENTS.md ## Risk classes`:
   - `high`: `src/auth/**`, `src/payments/**`, `migrations/**`
   - `medium`: `src/api/**`, `src/services/**`
   - `low`: `docs/**`, `tests/**`, `examples/**`
   - Use the highest matching risk class for the commit.

### Step 4 -- Evaluate policy

1. Read the `## Provenance Policy` section of AGENTS.md.
2. Set `policy.agentsMdPolicy` to `"v1"`.
3. Set `policy.requiresHumanApproval` to `true` if risk is `high`.
4. Set `policy.satisfied`:
   - `true` if all policy requirements are met (including human approval when required).
   - `false` otherwise. **Never set to true when unsatisfied.**

### Step 5 -- Fill the template

Load `attest-template.json` from this Skill's directory. Replace every
placeholder value with the computed values from Steps 1-4.

**Reference**: See `TEMPLATE-GUIDE.md` (co-located in this Skill's directory)
for detailed explanations of each field, including how to compute hashes,
determine risk classes, and evaluate policy compliance.

Validate the resulting JSON against the Pedigree predicate schema before
proceeding to Step 6.

### Step 6 -- Call attest_commit

Invoke the `pedigree-mcp` MCP server's `attest_commit` tool:

```
attest_commit(
  commit_sha: "<the commit SHA>",
  predicate: <the filled predicate JSON>
)
```

The tool will:

1. Wrap the predicate in an in-toto Statement v1 envelope.
2. Sign the Statement using DSSE (Sigstore preferred, ed25519 fallback).
3. Store the attestation at `refs/attestations/commits`.
4. Submit the signed entry to the public Rekor transparency log.
5. Return a confirmation with the Rekor log index and entry URL.

### Step 7 -- Validate storage

After `attest_commit` returns:

1. Confirm the attestation ref exists: `git notes --ref=refs/attestations/commits show <sha>`.
2. Confirm the Rekor entry URL is reachable (HTTP HEAD, expect 200).
3. If either check fails, report the failure clearly and do not proceed to push.

## Error handling

- If the pedigree-mcp server is not reachable, report the connection error and
  instruct the user to start the server.
- If schema validation fails on the assembled predicate, report which fields
  failed and stop.
- If Sigstore OIDC flow fails, fall back to ed25519 signing automatically and
  note the fallback in the session log.
- If Rekor submission fails, the attestation is still stored locally but the
  commit should be flagged as "locally signed only, not transparency-logged."

## Output

On success, print a structured summary:

```
Attestation complete
  Commit:     <sha>
  Rekor index: <index>
  Rekor URL:   <url>
  Risk class:  <low|medium|high>
  Policy met:  <true|false>
  Signer:      <sigstore|ed25519-fallback>
```
