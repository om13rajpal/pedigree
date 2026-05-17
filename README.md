<h1 align="center">
  <code>PEDIGREE</code>
</h1>

<p align="center">
  <strong>Cryptographic provenance for AI-written code.</strong><br>
  C2PA for source code -- so your codebase can survive <a href="https://artificialintelligenceact.eu/article/50/">August 2, 2026</a>.
</p>

<p align="center">
  <a href="https://ibm-lilac.vercel.app/demo"><strong>Live Demo</strong></a>
  &nbsp;&bull;&nbsp;
  <a href="docs/predicate-spec.md"><strong>Predicate Spec</strong></a>
  &nbsp;&bull;&nbsp;
  <a href="ARCHITECTURE.md"><strong>Architecture</strong></a>
</p>

<p align="center">
  Built in 48 hours for the <strong>IBM Bob Hackathon</strong> by <strong>Om Rajpal</strong>.
</p>

---

## The problem

On August 2, 2026, the **EU AI Act Article 50** starts fining organizations that cannot prove which parts of their software were written by AI. GitHub's own data shows that **42% of committed code** today is AI-assisted. Most of that code carries zero provenance metadata -- no record of which model generated it, who approved it, or what instructions the agent followed.

## The solution

**Pedigree** is the first cryptographic provenance layer for AI-written code. Every commit an AI agent produces gets signed with an [in-toto](https://in-toto.io/) attestation carrying the model, mode, Skill hashes, prompt hash, and human approver identity. The signed attestation is wrapped in a [DSSE envelope](https://github.com/secure-systems-lab/dsse), creating a tamper-evident audit trail that anyone can independently verify.

The result is a **Code Passport** -- a single page that renders any commit's chain of custody as a scannable QR-coded credential. An auditor, regulator, or procurement officer can verify it in under ten seconds.

---

## How it works

```
Developer / AI Agent
        |
        v
  Bob (Provenance Officer mode)
        |
        v
  sign-on-commit Skill computes predicate
        |
        v
  pedigree-mcp signs via ed25519 / Sigstore
        |
        v
  DSSE envelope stored in git attestation refs
        |
        v
  Passport page renders chain of custody + QR
        |
        v
  GitHub Action enforces attestation policy in CI
```

1. A developer (or Bob's **Provenance Officer** custom mode) commits code.
2. Bob's **sign-on-commit** Skill computes the predicate: model identity, Skill content hashes, AGENTS.md hash, prompt hash, risk class, and approval status.
3. The **pedigree-mcp** server validates the predicate, builds an in-toto Statement, signs it into a DSSE envelope with ed25519 (or Sigstore keyless signing in production), and stores it in `refs/attestations/commits/<sha>`.
4. The **Passport page** renders the commit's full chain of custody -- origin, agent signature, human approval, signer witness, and verification status -- with a QR code linking back to itself.
5. A **GitHub Action** runs in CI and blocks merges when attestations are missing, invalid, or policy-unsatisfied.

---

## Try it

### Online (no install)

Visit the **[Live Demo](https://ibm-lilac.vercel.app/demo)** to browse real signed commits and their Code Passports.

### Locally (full pipeline)

```bash
git clone https://github.com/om13rajpal/pedigree.git
cd pedigree
pnpm install
uv sync --directory packages/pedigree-mcp

# 1. Attest a real commit with ed25519 signing
PEDIGREE_SIGNER=ed25519 bash scripts/attest-real-commit.sh

# 2. Start the web app
pnpm --filter pedigree-web dev

# 3. Open the passport for your attested commit
#    The SHA is printed by the attest script
open http://localhost:3000/passport/<your-sha>
```

### Install the MCP server (for Bob, Cursor, Windsurf, etc.)

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "pedigree": {
      "command": "uvx",
      "args": [
        "--from",
        "git+https://github.com/om13rajpal/pedigree.git#subdirectory=packages/pedigree-mcp",
        "pedigree-mcp"
      ]
    }
  }
}
```

Your MCP client will install and launch the server automatically. Once connected, you get three tools: `attest_commit`, `verify_chain`, and `render_passport`.

### Verify from CLI

```bash
# Verify an attestation
PEDIGREE_SIGNER=ed25519 uv run --directory packages/pedigree-mcp \
  python -m pedigree_mcp verify <sha> --skip-rekor

# Health check
PEDIGREE_SIGNER=ed25519 uv run --directory packages/pedigree-mcp \
  python -m pedigree_mcp health
```

---

## Why Bob is essential

Pedigree could not have been built with a generic coding assistant. It requires deep integration with the agent's execution context -- the exact data that Bob exposes and other tools do not.

| Bob Feature      | Pedigree Use                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| **Custom Modes** | `provenance-officer` mode enforces signing before every push                                            |
| **Skills**       | `sign-on-commit` is content-hashed (SHA-256) into every attestation, making workflow versions auditable |
| **MCP Builder**  | Generated the `pedigree-mcp` FastMCP server scaffold                                                    |
| **Bob Shell**    | Runs `verify-chain` in CI via the GitHub Action composite step                                          |
| **AGENTS.md**    | The policy spine -- risk classes, approval rules, and provenance requirements live here                 |
| **Bobalytics**   | Per-commit compute cost (`bobcoinsConsumed`) is recorded in the predicate                               |

---

## Repository structure

```
pedigree/
  packages/
    pedigree-types/     Shared TS schema (Zod) for the predicate
    pedigree-mcp/       Python FastMCP server -- attest, verify, render
    pedigree-action/    GitHub Action enforcing attestation policy in CI
    pedigree-web/       Next.js 14 Passport site + landing + demo gallery
  demo-repo/            Sample Fastify TODO API wired to pedigree-action
  .bob/
    modes/              provenance-officer custom mode
    skills/             sign-on-commit, verify-chain, render-passport
  bob_sessions/         Exported Bob task histories + Bobalytics screenshots
  docs/
    predicate-spec.md   RFC-style specification of the predicate schema
    demo-script.md      5-minute video shot list
  scripts/              Attest, verify, secret hygiene, session export
```

---

## Packages

| Package                                        | Language   | Description                                                              |
| ---------------------------------------------- | ---------- | ------------------------------------------------------------------------ |
| [`pedigree-types`](packages/pedigree-types/)   | TypeScript | Zod schema for `dev.pedigree/ai-authorship/v1`, inferred TS types        |
| [`pedigree-mcp`](packages/pedigree-mcp/)       | Python     | FastMCP server: `attest_commit`, `verify_chain`, `render_passport` tools |
| [`pedigree-action`](packages/pedigree-action/) | Shell      | GitHub Actions composite action enforcing attestation policy             |
| [`pedigree-web`](packages/pedigree-web/)       | TypeScript | Next.js 14 site: landing, passport page, demo gallery, API routes        |

---

## The predicate schema

The [`dev.pedigree/ai-authorship/v1`](docs/predicate-spec.md) predicate type extends the in-toto Attestation Framework with:

- **Authorship** -- kind (human / ai-assisted / ai-autonomous), human share, approver identity
- **Agent** -- tool name, version, model, provider
- **Execution** -- mode slug, Skill content hashes, AGENTS.md hash, prompt hash, plan hash, session ID, compute cost
- **Scope** -- files touched, lines added/deleted, risk class
- **Policy** -- AGENTS.md policy version, human approval requirement, satisfaction status

The schema is defined once in Zod ([`packages/pedigree-types`](packages/pedigree-types/src/predicate.ts)) and once in Pydantic ([`packages/pedigree-mcp`](packages/pedigree-mcp/src/pedigree_mcp/schema.py)), kept in sync by `scripts/verify-schemas.sh`.

---

## Architecture

```
             Bob IDE                    Other AI Agents
               |                              |
     provenance-officer mode          MCP client (stdio)
               |                              |
               v                              v
        +------+------+              +--------+--------+
        | sign-on-commit Skill |     | attest_commit() |
        +------+------+              +--------+--------+
               |                              |
               +--------->  pedigree-mcp  <---+
                            |           |
                     DSSE sign      validate predicate
                     (ed25519)      (Pydantic v2)
                            |
                   git attestation refs
                            |
              +---------+---+---+---------+
              |         |       |         |
         verify_chain   |   render_passport
              |         |       |
         GitHub Action  |  Passport page
              |         |       |
           CI gate    Rekor   QR code
```

Full architecture details in [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Testing

```bash
# All TypeScript tests (68 tests)
pnpm test

# All Python tests (124 tests)
uv run --directory packages/pedigree-mcp pytest

# Schema parity check (Zod vs Pydantic)
bash scripts/verify-schemas.sh

# Secret hygiene scan
bash scripts/verify-secret-hygiene.sh
```

**192 tests total, 0 failures.**

---

## Roadmap

- **v1.1 predicate** -- `parentCommitAttestation` field for attestation chaining across rebases
- **Multi-repo dashboard** -- Aggregate Passport data across an organization
- **Sigstore policy controller** -- Kubernetes admission webhook for container builds
- **VS Code extension** -- Passport rendering in the editor gutter
- **SLSA Build L3 bridge** -- Map Pedigree attestations to SLSA provenance predicates
- **Formal spec submission** -- Propose to the in-toto community as a recognized predicate type

---

## Built with

| Component                                                                                                            | Role                                           |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [IBM Bob](https://www.ibm.com/products/bob)                                                                          | AI coding agent: Modes, Skills, MCP, Shell     |
| [watsonx.ai Granite 3.3 8B](https://www.ibm.com/watsonx)                                                             | Natural-language attestation summaries         |
| [Sigstore](https://www.sigstore.dev/) / ed25519                                                                      | Cryptographic signing and transparency logging |
| [in-toto](https://in-toto.io/) + [DSSE](https://github.com/secure-systems-lab/dsse)                                  | Attestation framework and envelope format      |
| [Next.js 14](https://nextjs.org/)                                                                                    | App Router, server components, strict TS       |
| [FastMCP](https://github.com/jlowin/fastmcp)                                                                         | Python MCP server framework                    |
| [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) + [Magic UI](https://magicui.design/) | UI components                                  |
| [Framer Motion](https://www.framer.com/motion/) + [GSAP](https://gsap.com/)                                          | Spring physics, scroll-driven animation        |
| [Zod](https://zod.dev/) + [Pydantic v2](https://docs.pydantic.dev/)                                                  | Schema validation (TS + Python, in sync)       |

---

## License

MIT. Copyright (c) 2026 Om Rajpal.
