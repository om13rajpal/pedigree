---
name: verify-chain
description: >
  Verifies the attestation chain for a range of commits. Iterates every commit
  in a PR or branch range, calls pedigree-mcp's verify_chain tool on each,
  prints a structured pass/fail report, and exits non-zero if any commit lacks
  a valid attestation or violates the AGENTS.md policy.
trigger:
  manual
  # Invoked by Bob Shell in CI via the pedigree GitHub Action, or manually
  # when a developer wants to audit the provenance chain before merging.
---

# verify-chain

CI-oriented attestation verification Skill for Pedigree. Designed to run in
Bob Shell as part of the `pedigree-action` GitHub Action, but can also be
invoked manually for local audits.

## Prerequisites

- The `pedigree-mcp` server is running (stdio transport).
- A git repository with commits to verify.
- The commit range is specified (e.g. `origin/main..HEAD` for a PR).

## Inputs

| Parameter      | Description                                                                               | Default  |
| -------------- | ----------------------------------------------------------------------------------------- | -------- |
| `commit_range` | Git revision range to verify (e.g. `origin/main..HEAD`)                                   | Required |
| `strict`       | If true, fail on any missing attestation. If false, warn only for human-authored commits. | `true`   |

## Workflow

### Step 1 -- Enumerate commits

```bash
git rev-list --no-merges <commit_range>
```

Collect the list of commit SHAs to verify. Exclude merge commits (they inherit
the attestation chain from their parents).

### Step 2 -- Verify each commit

For each commit SHA in the list, call the `pedigree-mcp` MCP server's
`verify_chain` tool:

```
verify_chain(commit_sha: "<sha>")
```

The tool performs the checks defined in `checklist.md` (co-located in this
Skill's directory):

1. **DSSE signature valid** -- The DSSE envelope signature verifies against
   the expected signer (Sigstore certificate or ed25519 public key).
2. **Rekor entry exists** -- A matching entry exists in the public Rekor
   transparency log at the expected log index.
3. **Predicate schema valid** -- The predicate inside the in-toto Statement
   passes validation against the `dev.pedigree/ai-authorship/v1` schema.
4. **Policy satisfied** -- `predicate.policy.satisfied === true`.

### Step 3 -- Collect results

For each commit, record:

- Commit SHA (short + full)
- Commit message (first line)
- Verification status: `PASS`, `FAIL`, or `SKIP` (human commit in non-strict mode)
- Failure reason (if any)
- Rekor entry URL (if available)
- Risk class from the predicate (if available)

### Step 4 -- Print report

Output a structured, machine-parseable report:

```
Pedigree Chain Verification Report
===================================
Range: origin/main..HEAD
Mode:  strict

  [PASS] a1b2c3d feat(mcp): add attest_commit tool
         Rekor: https://rekor.sigstore.dev/api/v1/log/entries/<id>
         Risk:  medium

  [PASS] e4f5g6h fix(web): correct Passport card stagger
         Rekor: https://rekor.sigstore.dev/api/v1/log/entries/<id>
         Risk:  low

  [FAIL] i7j8k9l chore(auth): update login handler
         Reason: predicate.policy.satisfied is false
         Risk:   high

Summary: 2 passed, 1 failed, 0 skipped out of 3 commits
Result:  FAIL
```

### Step 5 -- Exit code

- Exit `0` if all commits pass (or are legitimately skipped).
- Exit `1` if any commit fails verification.

The GitHub Action reads this exit code to block or allow the merge.

## Error handling

- If the pedigree-mcp server is unreachable, exit `1` with a clear error
  message identifying the connection problem.
- If a commit has no attestation at all (no entry in `refs/attestations/commits`),
  treat it as a `FAIL` in strict mode or `SKIP` with a warning in non-strict mode.
- If Rekor is temporarily unavailable, the DSSE signature can still be verified
  locally. Report the Rekor check as "skipped (Rekor unavailable)" but do not
  fail the commit solely for Rekor downtime.
- Network errors should be retried once (10-second timeout per attempt) before
  reporting failure.

## Error recovery steps

Each failure mode from `checklist.md` has specific recovery actions. When a
commit fails verification, the report should include the recovery steps for that
specific failure.

### Recovery: DSSE signature invalid

**Failure**: The DSSE envelope signature does not verify against the expected signer.

**Possible causes**:

- Attestation was tampered with after signing
- Wrong public key used for ed25519 verification
- Sigstore certificate expired or was revoked
- Envelope format corrupted

**Recovery steps**:

1. Verify the attestation file integrity: `git notes --ref=refs/attestations/commits show <sha>`
2. For Sigstore signatures: Check certificate validity period against Rekor integrated timestamp
3. For ed25519 signatures: Confirm `keys/pedigree-ed25519.pub` matches the key used during signing
4. If tampering suspected: Re-sign the commit with `sign-on-commit` Skill
5. If certificate revoked: Contact the original signer to re-attest with a valid certificate

**Exit action**: Block merge, require manual investigation

### Recovery: Rekor entry missing or mismatched

**Failure**: No Rekor entry exists, or the entry body doesn't match the local attestation.

**Possible causes**:

- Rekor submission failed during signing but local storage succeeded
- Network partition during `attest_commit` call
- Rekor log index was recorded incorrectly
- Attestation was modified after Rekor submission

**Recovery steps**:

1. Check if Rekor is reachable: `curl -I https://rekor.sigstore.dev/api/v1/log`
2. Search Rekor by commit SHA: Query `/api/v1/index/retrieve` with the commit SHA
3. If entry exists but mismatched: Compare local attestation with Rekor entry body
4. If entry missing: Re-submit to Rekor using `pedigree-mcp`'s rekor submission tool
5. If Rekor is down: Defer this check, verify DSSE signature locally, flag as "pending Rekor"

**Exit action**:

- If Rekor down: Warn but allow merge (temporary grace period)
- If entry missing: Block merge, require re-submission
- If mismatched: Block merge, require manual investigation

### Recovery: Predicate schema invalid

**Failure**: The predicate JSON does not conform to `dev.pedigree/ai-authorship/v1` schema.

**Possible causes**:

- Schema version mismatch (predicate uses older/newer schema)
- Required fields missing or have wrong types
- Enum values outside allowed set (e.g. invalid `authorship.kind`)
- Hash format incorrect (not `sha256:` prefixed or not lowercase hex)

**Recovery steps**:

1. Identify the specific validation error from the schema validator output
2. Check `predicate.schemaVersion` - if not `"1.0.0"`, may need schema migration
3. For missing fields: Re-run `sign-on-commit` Skill to generate complete predicate
4. For type errors: Inspect `attest-template.json` - may have incorrect placeholder substitution
5. For hash format errors: Verify hash computation in Step 2 of `sign-on-commit` workflow
6. Run `pnpm verify-schemas` to ensure TypeScript and Python schemas are in sync

**Exit action**: Block merge, require re-attestation with correct schema

### Recovery: Policy not satisfied

**Failure**: `predicate.policy.satisfied` is `false`, or human approval required but missing.

**Possible causes**:

- High-risk files modified without human approval
- `authorship.humanApprover.approved` is `false` when `policy.requiresHumanApproval` is `true`
- Policy evaluation logic error during attestation
- AGENTS.md policy changed after commit was attested

**Recovery steps**:

1. Check `predicate.scope.riskClass` - if `"high"`, human approval is mandatory
2. Verify `predicate.authorship.humanApprover.approved` is `true` for high-risk commits
3. Review `predicate.scope.filesTouched` against AGENTS.md risk class patterns
4. If policy was satisfied at signing time but AGENTS.md changed: Document the policy version mismatch
5. If human approval missing: Obtain approval and re-attest with `sign-on-commit` Skill
6. If policy evaluation was incorrect: Fix the policy logic in `sign-on-commit` Step 4 and re-attest

**Exit action**: Block merge unconditionally, require policy compliance

### Recovery: MCP server unreachable

**Failure**: Cannot connect to `pedigree-mcp` server to perform verification.

**Possible causes**:

- Server not running
- Stdio transport misconfigured
- Python environment issues (uv not installed, dependencies missing)
- Port conflict (if using HTTP transport)

**Recovery steps**:

1. Check if server process is running: `ps aux | grep pedigree_mcp`
2. Test server manually: `echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | uv run --directory packages/pedigree-mcp python -m pedigree_mcp`
3. Verify uv installation: `which uv`
4. Sync Python dependencies: `uv sync --directory packages/pedigree-mcp`
5. Check for port conflicts if using HTTP transport
6. Review server logs for startup errors

**Exit action**: Exit `1` immediately, cannot proceed without MCP server

### Recovery: Network timeout

**Failure**: Network request to Rekor or other external service timed out.

**Possible causes**:

- Rekor service temporarily unavailable
- Network connectivity issues
- Firewall blocking outbound HTTPS
- DNS resolution failure

**Recovery steps**:

1. Retry the request once with 10-second timeout
2. Check network connectivity: `curl -I https://rekor.sigstore.dev`
3. Verify DNS resolution: `nslookup rekor.sigstore.dev`
4. Check firewall rules for outbound HTTPS (port 443)
5. If Rekor is down: Check status at https://status.sigstore.dev
6. If persistent: Defer Rekor check, verify DSSE signature locally

**Exit action**:

- After retry succeeds: Continue verification
- After retry fails: Warn, allow merge with "Rekor check deferred" flag
