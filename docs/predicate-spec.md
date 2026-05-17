# Predicate Specification: `dev.pedigree/ai-authorship/v1`

**Status:** Draft
**Version:** 1.0.0
**Authors:** AGI Ready (agiready.io)
**Date:** 2026-05-16

---

## Abstract

This document specifies the `dev.pedigree/ai-authorship/v1` predicate type, an extension of the in-toto Attestation Framework designed to record the provenance of AI-authored source code. Every commit produced by an AI agent -- or by a human collaborating with one -- carries an attestation containing this predicate. The attestation binds the commit's SHA to a structured record of who wrote the code, which model generated it, what instructions governed the agent, and whether a human approved the result. Attestations are signed via Sigstore and logged in the Rekor public transparency log, providing a tamper-evident audit trail that third parties can independently verify.

The predicate is intended for use with the in-toto Statement v1 envelope (`https://in-toto.io/Statement/v1`) and the DSSE (Dead Simple Signing Envelope) signature wrapper. It is designed to support compliance with the EU AI Act Article 50 transparency obligations, which require deployers to disclose AI-generated content in certain contexts.

## Conformance

The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in
this document are to be interpreted as described in RFC 2119. An
implementation that satisfies all MUST and MUST NOT requirements is
conformant. An implementation that additionally satisfies all SHOULD
requirements is fully conformant.

## Terminology

- **Predicate**: The inner payload of an in-toto Statement, carrying domain-specific metadata about the subject artifact.
- **Statement**: The in-toto v1 envelope that binds a subject (the commit) to a predicate (the authorship record) and a predicate type URI.
- **Subject**: The artifact being attested. In Pedigree, this is always a git commit identified by its SHA-1 digest.
- **DSSE**: Dead Simple Signing Envelope -- the signature wrapper that signs the Statement's payload bytes.
- **Attestation**: The complete signed artifact: a DSSE envelope containing a Statement containing a Predicate.
- **Agent**: An AI tool (such as IBM Bob, Cursor, Cursor, or GitHub Copilot) that generates or modifies source code.
- **Human Approver**: A person who reviews and approves AI-generated code before it is committed, authenticated via OIDC.
- **Risk Class**: A categorization of the changed files according to the repository's AGENTS.md policy, determining whether human approval is required.
- **Skill**: A Bob-specific workflow recipe, content-addressed by SHA-256, that governs how the agent operates.

## Predicate Type URI

```
dev.pedigree/ai-authorship/v1
```

This URI is used as the `predicateType` field in the in-toto Statement. It uniquely identifies the schema defined in this document.

## Statement Structure

A complete attestation wraps the predicate in an in-toto Statement v1:

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [
    {
      "name": "git+commit",
      "digest": { "sha1": "<40-char-lowercase-hex>" }
    }
  ],
  "predicateType": "dev.pedigree/ai-authorship/v1",
  "predicate": { ... }
}
```

The `subject` array contains exactly one entry with `name` set to the literal string `"git+commit"` and a `digest` map containing the commit's SHA-1 hash as lowercase hexadecimal.

## Predicate Schema

### Top-Level Fields

| Field           | Type   | Required    | Description                                                                                       |
| --------------- | ------ | ----------- | ------------------------------------------------------------------------------------------------- |
| `schemaVersion` | string | Yes         | Must be `"1.0.0"`. Allows future schema evolution.                                                |
| `authorship`    | object | Yes         | Describes who wrote the code. See Authorship.                                                     |
| `agent`         | object | Conditional | AI tool metadata. Required when `authorship.kind` is `"ai-assisted"` or `"ai-autonomous"`.        |
| `execution`     | object | Conditional | Agent execution context. Required when `authorship.kind` is `"ai-assisted"` or `"ai-autonomous"`. |
| `scope`         | object | Yes         | Metadata about the files and lines changed.                                                       |
| `policy`        | object | Yes         | Policy evaluation result.                                                                         |

### Authorship

The `authorship` object uses a discriminated union on the `kind` field:

| Field           | Type              | Description                                                                                                                          |
| --------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `kind`          | enum              | One of `"human"`, `"ai-assisted"`, `"ai-autonomous"`.                                                                                |
| `humanShare`    | number or null    | Fraction of code attributable to the human. In `[0.0, 1.0]` for `"human"` and `"ai-assisted"`. Must be `null` for `"ai-autonomous"`. |
| `humanApprover` | object (optional) | OIDC identity of the human who approved the commit.                                                                                  |

**Authorship Kind Semantics:**

- `"human"`: The commit was written entirely by a human. The `agent` and `execution` fields may be omitted. `humanShare` reflects the human's contribution (typically `1.0`).
- `"ai-assisted"`: The commit was produced through human-AI collaboration. Both `agent` and `execution` are required. `humanShare` is a number between `0.0` and `1.0` inclusive.
- `"ai-autonomous"`: The commit was produced entirely by an AI agent without human co-authorship. Both `agent` and `execution` are required. `humanShare` must be `null`.

### Human Approver

| Field        | Type              | Description                                                                                 |
| ------------ | ----------------- | ------------------------------------------------------------------------------------------- |
| `oidcIssuer` | string (URL)      | The OIDC provider that authenticated the approver (e.g., `https://github.com/login/oauth`). |
| `subject`    | string            | The OIDC subject claim, typically an email address.                                         |
| `approved`   | boolean           | Whether the human explicitly approved the commit.                                           |
| `timestamp`  | string (ISO 8601) | When the approval was recorded.                                                             |

### Agent

| Field           | Type   | Description                                                                   |
| --------------- | ------ | ----------------------------------------------------------------------------- |
| `tool`          | string | The name of the AI agent tool (e.g., `"ibm-bob"`, `"cursor"`).                |
| `toolVersion`   | string | The version of the agent tool.                                                |
| `model`         | string | The model identifier used for generation (e.g., `"granite-3.3-8b-instruct"`). |
| `modelProvider` | string | The provider hosting the model (e.g., `"watsonx.ai"`, `"openai"`).            |

### Execution

| Field              | Type          | Description                                                                                                      |
| ------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `modeSlug`         | string        | The Bob mode slug active during code generation.                                                                 |
| `skillHashes`      | array         | Content-addressed references to each Skill invoked. Each entry has `name` (string) and `sha256` (lowercase hex). |
| `agentsMdHash`     | string        | `sha256:`-prefixed hash of the AGENTS.md file at commit time.                                                    |
| `promptHash`       | string        | `sha256:`-prefixed hash of the prompt that initiated the task.                                                   |
| `planHash`         | string        | `sha256:`-prefixed hash of the plan document.                                                                    |
| `bobSessionId`     | string (UUID) | Unique identifier for the Bob session.                                                                           |
| `bobcoinsConsumed` | number        | Number of Bobcoins consumed during the session (non-negative).                                                   |

### Scope

| Field          | Type             | Description                                                                                           |
| -------------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| `filesTouched` | array of strings | Relative paths of files modified in the commit. Must contain at least one entry.                      |
| `linesAdded`   | integer          | Total lines added (non-negative).                                                                     |
| `linesDeleted` | integer          | Total lines deleted (non-negative).                                                                   |
| `riskClass`    | enum             | One of `"low"`, `"medium"`, `"high"`. Derived from the repository's AGENTS.md risk class definitions. |

### Policy

| Field                   | Type    | Description                                                                              |
| ----------------------- | ------- | ---------------------------------------------------------------------------------------- |
| `agentsMdPolicy`        | string  | The policy version from the AGENTS.md Provenance section.                                |
| `requiresHumanApproval` | boolean | Whether the commit's risk class requires human approval.                                 |
| `satisfied`             | boolean | Whether the policy was satisfied. A value of `false` MUST cause CI to reject the commit. |

## Validation Rules

Implementations MUST enforce the following rules when validating a predicate:

1. **Schema version**: `schemaVersion` must equal `"1.0.0"`.
2. **Authorship kind**: `authorship.kind` must be one of `"human"`, `"ai-assisted"`, or `"ai-autonomous"`.
3. **Human share**: When `kind` is `"ai-assisted"` or `"human"`, `humanShare` must be a number in `[0.0, 1.0]`. When `kind` is `"ai-autonomous"`, `humanShare` must be `null`.
4. **Agent and execution presence**: When `kind` is `"ai-assisted"` or `"ai-autonomous"`, the `agent` and `execution` objects are required. When `kind` is `"human"`, they may be omitted.
5. **SHA format**: All `sha256:`-prefixed hash fields must contain lowercase hexadecimal characters after the prefix. The commit subject's `sha1` digest must be lowercase hexadecimal without a prefix.
6. **Risk class**: `scope.riskClass` must be one of `"low"`, `"medium"`, or `"high"`.
7. **Non-empty scope**: `scope.filesTouched` must contain at least one entry.
8. **Non-negative counts**: `scope.linesAdded` and `scope.linesDeleted` must be non-negative integers. `execution.bobcoinsConsumed` must be non-negative.
9. **Policy satisfaction**: While `policy.satisfied = false` is schema-valid, CI systems MUST treat it as a merge-blocking condition.
10. **Timestamp format**: `humanApprover.timestamp` must be a valid ISO 8601 datetime string.
11. **OIDC issuer**: `humanApprover.oidcIssuer` must be a valid URL.

## Examples

### AI-Assisted Commit

```json
{
  "schemaVersion": "1.0.0",
  "authorship": {
    "kind": "ai-assisted",
    "humanShare": 0.15,
    "humanApprover": {
      "oidcIssuer": "https://github.com/login/oauth",
      "subject": "omrajpal.exe@gmail.com",
      "approved": true,
      "timestamp": "2026-05-16T14:32:11Z"
    }
  },
  "agent": {
    "tool": "ibm-bob",
    "toolVersion": "1.4.2",
    "model": "granite-3.3-8b-instruct",
    "modelProvider": "watsonx.ai"
  },
  "execution": {
    "modeSlug": "provenance-officer",
    "skillHashes": [{ "name": "sign-on-commit", "sha256": "a3f5e2d1..." }],
    "agentsMdHash": "sha256:9c1b3e5d...",
    "promptHash": "sha256:4f2e6d8c...",
    "planHash": "sha256:7d8a0c2e...",
    "bobSessionId": "639be8ed-e654-4a1b-9c3d-5e7f9a1b3c5d",
    "bobcoinsConsumed": 0.52
  },
  "scope": {
    "filesTouched": ["src/auth/login.ts"],
    "linesAdded": 47,
    "linesDeleted": 12,
    "riskClass": "medium"
  },
  "policy": {
    "agentsMdPolicy": "v1",
    "requiresHumanApproval": true,
    "satisfied": true
  }
}
```

### Human-Only Commit

```json
{
  "schemaVersion": "1.0.0",
  "authorship": {
    "kind": "human",
    "humanShare": 1.0
  },
  "scope": {
    "filesTouched": ["docs/README.md"],
    "linesAdded": 10,
    "linesDeleted": 2,
    "riskClass": "low"
  },
  "policy": {
    "agentsMdPolicy": "v1",
    "requiresHumanApproval": false,
    "satisfied": true
  }
}
```

### AI-Autonomous Commit

```json
{
  "schemaVersion": "1.0.0",
  "authorship": {
    "kind": "ai-autonomous",
    "humanShare": null
  },
  "agent": {
    "tool": "cursor",
    "toolVersion": "1.2.0",
    "model": "gpt-4o",
    "modelProvider": "openai"
  },
  "execution": {
    "modeSlug": "default",
    "skillHashes": [],
    "agentsMdHash": "sha256:9c1b3e5d...",
    "promptHash": "sha256:b7c4a1f8...",
    "planHash": "sha256:e2d9f0a3...",
    "bobSessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "bobcoinsConsumed": 0.0
  },
  "scope": {
    "filesTouched": ["tests/test_utils.py"],
    "linesAdded": 23,
    "linesDeleted": 0,
    "riskClass": "low"
  },
  "policy": {
    "agentsMdPolicy": "v1",
    "requiresHumanApproval": false,
    "satisfied": true
  }
}
```

## Security Considerations

### Tamper Evidence

Attestations are signed using Sigstore's keyless signing flow, which binds the signer's OIDC identity to the signature via a short-lived certificate from the Fulcio CA. The signed attestation is then logged in Rekor, Sigstore's immutable transparency log. Any modification to the attestation after signing will invalidate the signature, and the Rekor log entry provides an independent timestamp and inclusion proof.

### Trust Model

The predicate is self-reported by the agent or its orchestrator. A malicious agent could fabricate the `agent`, `execution`, or `authorship` fields. The trust boundary is the signing identity: verifiers trust that the OIDC identity that signed the attestation is authorized to produce attestations for the repository. The `humanApprover` field adds a second trust signal when present, but its `approved: true` value is still self-reported by the signing process.

### Skill Hash Integrity

The `execution.skillHashes` array records the SHA-256 content hash of each Skill file at the time the commit was produced. This creates an auditable link between the agent's behavior (defined by the Skill) and the resulting code. If a Skill is modified between two commits, the hash difference makes this visible in the attestation chain.

### Risk Class Escalation

The `scope.riskClass` field is derived from path-based rules in the repository's AGENTS.md. An attacker who modifies AGENTS.md to downgrade risk classes could bypass human approval requirements. To mitigate this, the `execution.agentsMdHash` records the hash of AGENTS.md at commit time, allowing auditors to detect policy changes.

### Policy Satisfaction

The `policy.satisfied` field is the final arbiter for CI enforcement. Even if all other fields are valid, a `false` value here indicates that the commit did not meet the repository's provenance requirements. CI systems MUST reject commits where `policy.satisfied` is `false`. This field exists as a denormalized convenience -- the ground truth is the combination of `riskClass`, `requiresHumanApproval`, and the `humanApprover.approved` value.

### Privacy

The `humanApprover.subject` field typically contains an email address. Repository owners should ensure that contributors consent to having their approval identity recorded in a public transparency log. The OIDC issuer URL reveals the identity provider but not additional account metadata.

## Related Work

- **SLSA (Supply-chain Levels for Software Artifacts)**: SLSA defines
  provenance predicates for build systems. Pedigree operates at the
  commit level, upstream of build. The two are complementary: a Pedigree
  attestation records who wrote the code, while a SLSA provenance
  attestation records how it was built.
- **C2PA (Coalition for Content Provenance and Authenticity)**: C2PA
  provides provenance metadata for media files (images, video, audio).
  Pedigree applies the same philosophy to source code, using the in-toto
  framework instead of the C2PA manifest format.
- **Sigstore gitsign**: gitsign signs git commits using Sigstore's
  keyless flow. Pedigree builds on top of gitsign by attaching structured
  predicates (not just signatures) to commits, carrying AI-specific
  metadata that gitsign alone does not capture.
- **in-toto Attestation Framework**: Pedigree predicates conform to the
  in-toto Statement v1 specification and use DSSE envelopes. The
  `dev.pedigree/ai-authorship/v1` predicate type is a domain-specific
  extension of this framework.

## Versioning

The `schemaVersion` field allows forward-compatible evolution. Version `1.0.0` is the initial release. Future versions will follow semantic versioning:

- **Patch** (1.0.x): Clarifications to this specification that do not change the schema.
- **Minor** (1.x.0): Additive fields that existing consumers can safely ignore.
- **Major** (x.0.0): Breaking changes that require consumer updates.

Consumers MUST reject predicates with an unrecognized major version.
