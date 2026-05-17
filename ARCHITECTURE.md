# Architecture

Single-page architecture reference for Pedigree. For the full predicate
schema, see [docs/predicate-spec.md](docs/predicate-spec.md).

---

## Data flow

```
                          commit
  Developer / AI Agent ──────────> Git Repository
         |                              |
         v                              v
  Bob (Provenance Officer)        pedigree-mcp server
         |                       ┌──────┴──────┐
         v                       v             v
  sign-on-commit Skill      Sigstore        Rekor
         |                  (Fulcio CA)   (transparency log)
         v                       |             |
  Predicate computed             v             v
         |                  DSSE Envelope   Log entry
         |                       |             |
         v                       v             v
  attest_commit tool ───> Attestation ref stored in
                          refs/attestations/commits
                                 |
                                 v
                          Passport Page (Next.js)
                          renders chain of custody
                          + QR code at /passport/[sha]
                                 |
                                 v
                          GitHub Action (CI)
                          verify_chain blocks merge
                          when policy.satisfied = false
```

## Components

### pedigree-types

Shared TypeScript package. Defines the `dev.pedigree/ai-authorship/v1`
predicate as a Zod schema and exports inferred TypeScript types. This is
the single source of truth for the TS side of the predicate shape. A CI
script (`pnpm verify-schemas`) checks that this schema stays in sync with
the Pydantic models in `pedigree-mcp`.

### pedigree-mcp

Python FastMCP server exposing three tools over stdio transport. Any
MCP-compatible agent -- Bob, Cursor, Windsurf, Codex -- can call these
tools to produce, verify, or render attestations. The server has no
network-facing surface; it runs as a child process of the calling agent.
Signing is abstracted behind a `Signer` protocol so the backend can be
swapped between Sigstore (primary) and a project-scoped ed25519 keypair
(fallback) without changing tool signatures.

### pedigree-action

GitHub Actions composite action. Invokes `verify_chain` via Bob Shell on
every pull request. If any commit in the PR lacks a valid attestation, or
if `policy.satisfied` is `false`, the action fails the workflow run and
posts a summary comment identifying the offending commits.

### pedigree-web

Next.js 14 App Router site. Two pages:

- **Landing (`/`)**: Scroll-driven architecture visualization, stat slabs,
  and CTA. GSAP + ScrollTrigger for the hero timeline; Magic UI for
  animated beams and number tickers.
- **Passport (`/passport/[sha]`)**: Renders a single commit's chain of
  custody. PassportCard with BorderBeam, vertical ChainOfCustody timeline,
  collapsible PredicateInspector, QR code, and Rekor log link.

### .bob/ (Modes and Skills)

- **provenance-officer mode**: Custom Bob mode that computes hashes,
  checks AGENTS.md risk classes, requests human approval when required,
  and invokes the sign-on-commit Skill. Refuses to push unsigned commits.
- **sign-on-commit Skill**: Core attestation workflow. Content-hashed
  (SHA-256) so that the hash appears in `execution.skillHashes` -- making
  the workflow version itself auditable.
- **verify-chain Skill**: Verification workflow called by Bob Shell in CI.
- **render-passport Skill**: Builds the JSON payload the web layer
  consumes for the Passport page.

### demo-repo

A sample Fastify TODO API that has Pedigree wired into its CI via
`.github/workflows/pedigree.yml`. Exists to demonstrate Pedigree running
on a "real" project during the live demo.

## Attestation lifecycle

1. **Predicate computation.** The Provenance Officer mode (or any calling
   agent) collects: model identity, tool version, Skill content hashes,
   AGENTS.md hash, prompt hash, plan hash, Bob session ID, Bobcoin
   consumption, files touched, lines added/deleted, risk class, and human
   approval status. These fields form the predicate body.

2. **Statement construction.** The predicate is wrapped in an in-toto
   Statement v1 envelope with the commit SHA as the subject.

3. **DSSE signing.** The Statement is signed into a DSSE (Dead Simple
   Signing Envelope). In the Sigstore path, a short-lived Fulcio
   certificate binds the signer's OIDC identity to the signature. In the
   ed25519 fallback path, a project-scoped keypair signs directly.

4. **Rekor submission.** The signed envelope is submitted to Rekor, which
   returns an inclusion proof and a log index. The Rekor entry URL is
   stored alongside the attestation.

5. **Git ref storage.** The complete attestation (DSSE envelope + Rekor
   metadata) is written to `refs/attestations/commits/<sha>` in the git
   repository.

6. **Verification.** `verify_chain` reads the attestation ref, verifies
   the DSSE signature, validates the predicate against the schema, and
   confirms Rekor inclusion. It returns a structured result indicating
   pass/fail and any policy violations.

## Security model

### Trust boundaries

```
+-------------------------------------------------------+
|  Trusted: the signing identity                        |
|  (OIDC identity that signed the DSSE envelope)        |
+-------------------------------------------------------+
        |
        v
+-------------------------------------------------------+
|  Self-reported: predicate fields                      |
|  (agent, execution, authorship, scope)                |
|  Fabrication by a malicious agent is possible.        |
|  Mitigation: OIDC identity + Rekor inclusion proof    |
|  allow auditors to trace who signed what and when.    |
+-------------------------------------------------------+
        |
        v
+-------------------------------------------------------+
|  Immutable: Rekor transparency log                    |
|  Attestations cannot be modified after submission.    |
|  Log entries provide independent timestamps and       |
|  inclusion proofs.                                    |
+-------------------------------------------------------+
```

### Key risks and mitigations

- **Predicate fabrication.** The predicate is self-reported. A compromised
  agent could lie about model identity or approval status. Mitigation:
  the OIDC signing identity is independently verifiable, and Rekor
  provides an immutable record.
- **AGENTS.md downgrade.** An attacker could modify AGENTS.md to
  reclassify high-risk paths as low-risk. Mitigation: `agentsMdHash` in
  the predicate records the hash at commit time, making policy changes
  visible in the attestation chain.
- **Skill tampering.** Modifying a Skill changes its behavior. Mitigation:
  `skillHashes` records the content hash of each Skill, so auditors can
  detect when a Skill was modified between commits.
- **Replay attacks.** An attacker could reuse a valid attestation for a
  different commit. Mitigation: the in-toto Statement binds the
  attestation to a specific commit SHA in the subject field.

## Predicate schema (summary)

The `dev.pedigree/ai-authorship/v1` predicate contains five sections:

| Section      | Purpose                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------- |
| `authorship` | Who wrote the code: human, AI-assisted, or AI-autonomous. Includes human approver OIDC identity.    |
| `agent`      | Which AI tool and model produced the code.                                                          |
| `execution`  | Agent execution context: mode, Skill hashes, AGENTS.md hash, prompt hash, session ID, Bobcoin cost. |
| `scope`      | What changed: files touched, lines added/deleted, risk class.                                       |
| `policy`     | Whether the commit satisfied the repository's provenance policy. CI enforces `satisfied = true`.    |

Full schema with validation rules and examples:
[docs/predicate-spec.md](docs/predicate-spec.md).
