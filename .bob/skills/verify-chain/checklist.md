# Verification Checklist

What "verified" means for a Pedigree attestation. Each check must pass for a
commit to be considered fully verified.

## 1. DSSE signature valid

The attestation is wrapped in a DSSE (Dead Simple Signing Envelope). The
signature in the envelope must verify against the expected signer:

- **Sigstore path**: The signing certificate was issued by Sigstore's Fulcio CA
  during an OIDC flow. Verify the certificate chain and confirm it was valid at
  the time recorded in the Rekor entry's integrated timestamp.
- **ed25519 fallback path**: The signature verifies against the project's
  ed25519 public key stored at `keys/pedigree-ed25519.pub`.
- The envelope's `payloadType` must be `application/vnd.in-toto+json`.

## 2. Rekor entry exists

A signed entry exists in Sigstore's public Rekor transparency log that matches
the attestation:

- The Rekor entry's body, when decoded, matches the DSSE envelope stored in
  `refs/attestations/commits` for this commit.
- The log index and entry UUID are consistent.
- The integrated timestamp from Rekor proves the attestation existed at a
  specific point in time (prevents backdating).

Note: If Rekor is temporarily unavailable, this check may be deferred but the
attestation should be flagged as "locally verified only."

## 3. Predicate schema valid

The `predicate` field inside the in-toto Statement passes validation against the
canonical `dev.pedigree/ai-authorship/v1` schema:

- `predicate.schemaVersion` equals `"1.0.0"`.
- `predicate.authorship.kind` is one of: `"human"`, `"ai-assisted"`, `"ai-autonomous"`.
- If `kind` is `"ai-assisted"`, `humanShare` is a number in `[0.0, 1.0]`.
- If `kind` is `"ai-autonomous"`, `humanShare` is `null`.
- If `kind` is `"ai-assisted"` or `"ai-autonomous"`, `agent` and `execution` are present.
- All `sha256:`-prefixed hashes are lowercase hex.
- `scope.riskClass` is one of: `"low"`, `"medium"`, `"high"`.
- `scope.filesTouched` contains at least one entry.
- `scope.linesAdded` and `scope.linesDeleted` are non-negative integers.
- `execution.skillHashes` contains at least one entry (for AI commits).
- `execution.bobSessionId` is a valid UUID.

## 4. Policy satisfied

The predicate's policy evaluation must indicate compliance:

- `predicate.policy.satisfied` must be `true`.
- If `predicate.policy.requiresHumanApproval` is `true`, then
  `predicate.authorship.humanApprover.approved` must also be `true`.
- A `false` value for `policy.satisfied` is an unconditional verification
  failure -- CI must block the merge.

## Composite result

A commit is `PASS` only when all four checks succeed. Any single failure makes
the commit `FAIL`. The verify-chain Skill exits non-zero if any commit in the
range is `FAIL`.
