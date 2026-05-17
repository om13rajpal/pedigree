# Attestation Template Field Guide

This document explains each placeholder value in `attest-template.json`. Use this
guide when filling the template in Step 5 of the `sign-on-commit` workflow.

## Root Fields

### `schemaVersion`

**Type**: String (constant)  
**Value**: `"1.0.0"`  
**Description**: Version of the predicate schema format. Currently always `"1.0.0"`.

## `authorship` Object

### `authorship.kind`

**Type**: Enum string  
**Allowed values**: `"human"`, `"ai-assisted"`, `"ai-autonomous"`  
**Description**: Type of authorship for this commit.

- `"human"`: No AI involvement, purely human-authored code
- `"ai-assisted"`: Collaborative work between human and AI
- `"ai-autonomous"`: Fully autonomous AI generation with no human code contribution

**How to determine**:

- If Bob generated code but a human reviewed/modified it: `"ai-assisted"`
- If Bob generated code autonomously in provenance-officer mode: `"ai-autonomous"`
- If a human wrote the code manually: `"human"`

### `authorship.humanShare`

**Type**: Number (0.0-1.0) or null  
**Description**: Estimated fraction of human contribution to the code.

- For `"ai-assisted"`: A number between 0.0 and 1.0 (e.g., 0.3 = 30% human, 70% AI)
- For `"human"` or `"ai-autonomous"`: `null`

**How to estimate**:

- Count lines: `(human_lines) / (human_lines + ai_lines)`
- Consider complexity: Weight complex logic higher than boilerplate
- When uncertain: Use 0.5 as a conservative estimate

### `authorship.humanApprover` Object

**Optional**: Present only when a human explicitly approved the commit.

#### `humanApprover.oidcIssuer`

**Type**: String (URL)  
**Example**: `"https://github.com/login/oauth"`, `"https://accounts.google.com"`  
**Description**: OIDC provider URL that issued the approver's identity token.

#### `humanApprover.subject`

**Type**: String  
**Example**: `"alice@example.com"`, `"github.com/alice"`  
**Description**: Approver's email or OIDC subject identifier.

#### `humanApprover.approved`

**Type**: Boolean  
**Description**: Whether the approver explicitly approved this commit.

- **Must be `true`** for high-risk commits (auth/payments/migrations) per AGENTS.md policy
- Set to `false` if approval was requested but not granted

#### `humanApprover.timestamp`

**Type**: String (ISO-8601)  
**Example**: `"2026-05-15T22:30:00Z"`  
**Description**: When the approval was granted, in UTC.

## `agent` Object

**Optional**: Present only for AI-assisted or AI-autonomous commits.

### `agent.tool`

**Type**: String  
**Example**: `"ibm-bob"`, `"github-copilot"`, `"cursor"`  
**Description**: Name of the AI agent tool that generated the code.

### `agent.toolVersion`

**Type**: String (semver)  
**Example**: `"1.2.3"`  
**Description**: Semantic version of the agent tool.

**How to get**: Bob reports its version in the session context.

### `agent.model`

**Type**: String  
**Example**: `"granite-3.3-8b-instruct"`, `"gpt-4"`, `"gemini-2.5-pro"`  
**Description**: Identifier for the AI model used.

**How to get**: From Bob's session context or model selection.

### `agent.modelProvider`

**Type**: String  
**Example**: `"watsonx.ai"`, `"openai"`, `"anthropic"`  
**Description**: Provider hosting the model.

## `execution` Object

**Optional**: Present only for AI-assisted or AI-autonomous commits.

### `execution.modeSlug`

**Type**: String  
**Example**: `"provenance-officer"`, `"code"`, `"advanced"`  
**Description**: Bob mode that was active during code generation.

**How to get**: From the active mode's YAML file slug.

### `execution.skillHashes`

**Type**: Array of objects  
**Description**: Array of Skills invoked during this session, with their content hashes.

Each object contains:

- `name`: Skill identifier (slug from SKILL.md frontmatter)
- `sha256`: SHA-256 hash of the Skill's SKILL.md file (lowercase hex, no prefix)

**How to compute**:

```bash
sha256sum .bob/skills/sign-on-commit/SKILL.md | awk '{print $1}'
```

**Purpose**: Proves which version of each Skill was used, enabling reproducibility audits.

### `execution.agentsMdHash`

**Type**: String (prefixed hash)  
**Format**: `"sha256:<lowercase hex>"`  
**Example**: `"sha256:a1b2c3d4..."`  
**Description**: SHA-256 hash of AGENTS.md at repo root.

**How to compute**:

```bash
echo "sha256:$(sha256sum AGENTS.md | awk '{print $1}')"
```

**Purpose**: Proves which policy version was active when the commit was attested.

### `execution.promptHash`

**Type**: String (prefixed hash)  
**Format**: `"sha256:<lowercase hex>"`  
**Description**: SHA-256 hash of the user's initial prompt that started this task.

**How to compute**: Hash the exact text of the user's request.

### `execution.planHash`

**Type**: String (prefixed hash)  
**Format**: `"sha256:<lowercase hex>"`  
**Description**: SHA-256 hash of the plan/spec document (BUILD-PLAN.md or task-specific plan).

**How to compute**: Hash the plan document content.

### `execution.bobSessionId`

**Type**: String (UUID)  
**Example**: `"550e8400-e29b-41d4-a716-446655440000"`  
**Description**: UUID identifying the current Bob session.

**How to get**: From Bob's session context.

### `execution.bobcoinsConsumed`

**Type**: Number (non-negative integer)  
**Example**: `42`  
**Description**: Number of Bobcoins consumed in this session.

**How to get**: From Bob's session usage tracking.

**Purpose**: Tracks computational cost/usage for billing or resource management.

## `scope` Object

### `scope.filesTouched`

**Type**: Array of strings  
**Example**: `["src/auth/login.ts", "tests/auth.test.ts"]`  
**Description**: Array of file paths modified in this commit, relative to repo root.

**How to get**:

```bash
git diff --cached --name-only
```

### `scope.linesAdded`

**Type**: Number (non-negative integer)  
**Example**: `42`  
**Description**: Total lines added across all files.

**How to get**:

```bash
git diff --cached --numstat | awk '{sum+=$1} END {print sum}'
```

### `scope.linesDeleted`

**Type**: Number (non-negative integer)  
**Example**: `15`  
**Description**: Total lines deleted across all files.

**How to get**:

```bash
git diff --cached --numstat | awk '{sum+=$2} END {print sum}'
```

### `scope.riskClass`

**Type**: Enum string  
**Allowed values**: `"low"`, `"medium"`, `"high"`  
**Description**: Risk classification based on AGENTS.md patterns.

**Classification rules** (from AGENTS.md):

- `"high"`: `src/auth/**`, `src/payments/**`, `migrations/**`
- `"medium"`: `src/api/**`, `src/services/**`
- `"low"`: `docs/**`, `tests/**`, `examples/**`

**How to determine**: Match file paths against patterns, use the highest matching risk class.

## `policy` Object

### `policy.agentsMdPolicy`

**Type**: String (constant)  
**Value**: `"v1"`  
**Description**: Version of the AGENTS.md policy format. Currently always `"v1"`.

### `policy.requiresHumanApproval`

**Type**: Boolean  
**Description**: Whether this commit requires human approval per AGENTS.md policy.

**Rules**:

- `true` if `scope.riskClass` is `"high"`
- `false` otherwise

### `policy.satisfied`

**Type**: Boolean  
**Description**: Whether all policy requirements are satisfied.

**Rules**:

- If `requiresHumanApproval` is `true`, then `authorship.humanApprover.approved` must also be `true`
- If any policy requirement is unmet, this **MUST** be `false`
- **Never set to `true` when requirements are unsatisfied** - CI will block the merge

**Critical**: This is the final gate. A `false` value unconditionally fails verification.

## Validation Checklist

Before calling `attest_commit`, verify:

- [ ] All hash values are lowercase hex (no uppercase)
- [ ] All hash values with `sha256:` prefix include the prefix
- [ ] `authorship.kind` matches the actual authorship model
- [ ] `humanShare` is null for non-ai-assisted commits
- [ ] `agent` and `execution` objects are present for AI commits
- [ ] `scope.riskClass` correctly reflects the highest-risk file touched
- [ ] `policy.satisfied` is `false` if any requirement is unmet
- [ ] All timestamps are in ISO-8601 UTC format
- [ ] `bobSessionId` is a valid UUID
- [ ] All file paths in `filesTouched` are relative to repo root
