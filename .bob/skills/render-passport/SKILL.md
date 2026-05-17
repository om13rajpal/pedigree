---
name: render-passport
description: >
  Produces a JSON payload for the Pedigree Passport web page. Verifies the
  attestation chain for a given commit, then returns the validated predicate,
  Rekor entry URL, chain-of-custody metadata, and a slot for a watsonx.ai
  natural-language summary. Called by the Next.js API route at
  /api/attestation/[sha].
trigger:
  manual
  # Invoked by the pedigree-web API layer when a user navigates to
  # /passport/[sha], or by other tools that need a rendered view of
  # a commit's provenance.
---

# render-passport

Web-facing attestation rendering Skill for Pedigree. Transforms raw
cryptographic attestation data into a structured JSON payload suitable for the
Next.js Passport page.

## Prerequisites

- The `pedigree-mcp` server is running (stdio transport).
- The target commit SHA exists in the local repository.
- The commit has a stored attestation in `refs/attestations/commits`.

## Inputs

| Parameter    | Description                                |
| ------------ | ------------------------------------------ |
| `commit_sha` | Full 40-character git commit SHA to render |

## Workflow

### Step 1 -- Verify the attestation

Before rendering, the attestation must be valid. Call `pedigree-mcp`'s
`verify_chain` tool on the single commit:

```
verify_chain(commit_sha: "<sha>")
```

If verification fails, return an error payload instead of the passport data:

```json
{
  "status": "error",
  "commitSha": "<sha>",
  "error": "Attestation verification failed: <reason>"
}
```

### Step 2 -- Fetch the full attestation

Call `pedigree-mcp`'s `render_passport` tool:

```
render_passport(commit_sha: "<sha>")
```

The tool returns:

- The complete, validated predicate as JSON.
- The Rekor entry URL (e.g. `https://rekor.sigstore.dev/api/v1/log/entries/<id>`).
- The Rekor log index number.
- The signing method used (`sigstore` or `ed25519-fallback`).
- The signer identity (OIDC subject for Sigstore, or key fingerprint for ed25519).

### Step 3 -- Build the chain of custody

Assemble the chain-of-custody timeline from the predicate fields:

1. **Code authored** -- Agent tool, model, and provider from `predicate.agent`.
2. **Session context** -- Mode slug, session ID, Bobcoins consumed from `predicate.execution`.
3. **Human review** -- Approver identity and timestamp from `predicate.authorship.humanApprover` (if present).
4. **Attestation signed** -- Signing method and signer identity.
5. **Transparency logged** -- Rekor entry URL and log index.
6. **Policy evaluated** -- Whether the AGENTS.md policy was satisfied, risk class.

Each entry in the chain has:

- `step`: A short label (e.g. "Code authored", "Human review").
- `timestamp`: ISO-8601 timestamp when available, null otherwise.
- `actor`: Who or what performed this step.
- `detail`: A human-readable description.
- `verified`: Boolean indicating if this step was cryptographically verified.

### Step 4 -- Prepare the NL summary slot

The response includes a `summary` field that can be populated by the watsonx.ai
Granite model. The Skill does not call watsonx.ai directly -- instead it
provides a structured prompt context that the web API route passes to the
`/api/summary/[sha]` endpoint:

```json
{
  "summaryPromptContext": {
    "commitSha": "<sha>",
    "authorshipKind": "<kind>",
    "agentTool": "<tool>",
    "agentModel": "<model>",
    "riskClass": "<risk>",
    "filesTouched": ["<files>"],
    "policySatisfied": true,
    "humanApproved": true
  },
  "summary": null
}
```

The `summary` field is null in the Skill's response. The web layer fills it
asynchronously from the watsonx.ai endpoint.

### Step 5 -- Assemble the response

Return the complete passport payload:

```json
{
  "status": "verified",
  "commitSha": "<full sha>",
  "commitShortSha": "<first 7 chars>",
  "predicate": { "...full validated predicate..." },
  "rekor": {
    "entryUrl": "<url>",
    "logIndex": "<number>"
  },
  "signing": {
    "method": "<sigstore|ed25519-fallback>",
    "signerIdentity": "<OIDC subject or key fingerprint>"
  },
  "chainOfCustody": [
    {
      "step": "Code authored",
      "timestamp": null,
      "actor": "granite-3.3-8b-instruct via ibm-bob",
      "detail": "AI-assisted code generation in provenance-officer mode",
      "verified": false
    }
  ],
  "summaryPromptContext": { "..." },
  "summary": null,
  "passportUrl": "/passport/<sha>",
  "qrData": "/passport/<sha>"
}
```

## Response format specification

The web layer (`packages/pedigree-web/app/api/attestation/[sha]/route.ts`)
expects a specific JSON structure. All fields are required unless marked optional.

### Success response (status: "verified")

```typescript
{
  "status": "verified",                    // Literal string "verified"
  "commitSha": string,                     // Full 40-char SHA (lowercase hex)
  "commitShortSha": string,                // First 7 chars of SHA
  "predicate": {                           // Complete validated predicate object
    "schemaVersion": "1.0.0",
    "authorship": {
      "kind": "human" | "ai-assisted" | "ai-autonomous",
      "humanShare": number | null,         // 0.0-1.0 for ai-assisted, null otherwise
      "humanApprover": {                   // Optional, present if human approved
        "oidcIssuer": string,
        "subject": string,
        "approved": boolean,
        "timestamp": string                // ISO-8601 format
      }
    },
    "agent": {                             // Optional, present for AI commits
      "tool": string,
      "toolVersion": string,
      "model": string,
      "modelProvider": string
    },
    "execution": {                         // Optional, present for AI commits
      "modeSlug": string,
      "skillHashes": Array<{
        "name": string,
        "sha256": string
      }>,
      "agentsMdHash": string,              // Format: "sha256:<hex>"
      "promptHash": string,                // Format: "sha256:<hex>"
      "planHash": string,                  // Format: "sha256:<hex>"
      "bobSessionId": string,              // UUID format
      "bobcoinsConsumed": number
    },
    "scope": {
      "filesTouched": string[],            // Relative paths
      "linesAdded": number,
      "linesDeleted": number,
      "riskClass": "low" | "medium" | "high"
    },
    "policy": {
      "agentsMdPolicy": "v1",
      "requiresHumanApproval": boolean,
      "satisfied": boolean
    }
  },
  "rekor": {
    "entryUrl": string,                    // Full URL to Rekor entry
    "logIndex": number                     // Rekor log index (integer)
  },
  "signing": {
    "method": "sigstore" | "ed25519-fallback",
    "signerIdentity": string               // OIDC subject or key fingerprint
  },
  "chainOfCustody": Array<{                // Ordered timeline of events
    "step": string,                        // Human-readable step name
    "timestamp": string | null,            // ISO-8601 or null if unavailable
    "actor": string,                       // Who/what performed this step
    "detail": string,                      // Human-readable description
    "verified": boolean                    // True if cryptographically verified
  }>,
  "summaryPromptContext": {                // Context for watsonx.ai summary
    "commitSha": string,
    "authorshipKind": string,
    "agentTool": string | null,
    "agentModel": string | null,
    "riskClass": string,
    "filesTouched": string[],
    "policySatisfied": boolean,
    "humanApproved": boolean
  },
  "summary": string | null,                // Natural language summary (null initially)
  "passportUrl": string,                   // Relative URL: "/passport/<sha>"
  "qrData": string                         // QR code data: "/passport/<sha>"
}
```

### Error response (status: "error")

```typescript
{
  "status": "error",
  "commitSha": string,                     // Full 40-char SHA
  "error": string,                         // Human-readable error message
  "errorCode"?: string                     // Optional machine-readable code
}
```

Possible `errorCode` values:

- `"VERIFICATION_FAILED"` - Attestation verification failed
- `"SIGNATURE_INVALID"` - DSSE signature invalid
- `"REKOR_MISMATCH"` - Rekor entry doesn't match local attestation
- `"SCHEMA_INVALID"` - Predicate schema validation failed
- `"POLICY_UNSATISFIED"` - Policy requirements not met

### Not found response (status: "not-found")

```typescript
{
  "status": "not-found",
  "commitSha": string,
  "error": "Commit not found in repository"
}
```

### Unsigned response (status: "unsigned")

```typescript
{
  "status": "unsigned",
  "commitSha": string,
  "error": "No attestation found for this commit",
  "suggestion": "Run sign-on-commit Skill to attest this commit"
}
```

### Service unavailable response (status: "service-unavailable")

```typescript
{
  "status": "service-unavailable",
  "commitSha": string,
  "error": "pedigree-mcp server is not reachable",
  "retryAfter"?: number                    // Optional: seconds to wait before retry
}
```

## Error handling

- If `verify_chain` fails, return an error payload with status `"error"`.
  Do not return partial passport data for unverified commits.
- If the commit SHA does not exist in the repository, return status `"not-found"`.
- If the commit exists but has no attestation, return status `"unsigned"` with
  a message explaining that no in-toto attestation was found.
- If the pedigree-mcp server is unreachable, return status `"service-unavailable"`.

## Consumers

- `packages/pedigree-web/app/api/attestation/[sha]/route.ts` -- the primary consumer.
- `packages/pedigree-web/app/passport/[sha]/page.tsx` -- renders the payload into
  the Passport UI via React Server Components.
