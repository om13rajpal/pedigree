# Pedigree Demo -- TODO API

A minimal Fastify TODO API used to demonstrate [Pedigree](https://github.com/agiready/pedigree) attestation scenarios for the IBM Bob Hackathon.

This repo is **not** a production application. It exists solely to show how Pedigree's cryptographic provenance layer behaves across three pull-request scenarios.

## The API

| Method | Path         | Description                          |
| ------ | ------------ | ------------------------------------ |
| GET    | `/todos`     | List all todos                       |
| POST   | `/todos`     | Create a todo (`{ "title": "..." }`) |
| DELETE | `/todos/:id` | Delete a todo by ID                  |

```bash
npm install
npm run dev   # starts on :3001
npm test      # vitest
```

## Three demo scenarios

### 1. Clean PR (`demo/clean-pr`)

A refactored todos route committed by Bob in `provenance-officer` mode. The commit carries a full `dev.pedigree/ai-authorship/v1` attestation signed via Sigstore and logged to Rekor. The `pedigree-action` CI check **passes** and posts a green Passport summary on the PR.

### 2. Unsigned PR (`demo/unsigned-pr`)

The same code change, but committed without invoking the `sign-on-commit` Skill. No attestation is attached. The `pedigree-action` CI check **fails** and posts a red comment explaining which commits lack provenance.

### 3. Cross-agent PR (`demo/cross-agent-pr`)

Two commits from two different agents:

- Commit A: Bob refactors the route handler (attested via Bob's `provenance-officer` mode).
- Commit B: Cursor adds test coverage (attested via `pedigree-mcp` MCP server called over stdio).

Both commits carry valid attestations with distinct `agent.tool` fields (`ibm-bob` and `cursor`). The CI check **passes**, and the Passport page renders both agents' chains of custody side by side.

## Provenance policy

See [AGENTS.md](./AGENTS.md) for the provenance policy enforced by CI. The policy declares risk classes (`high`, `medium`, `low`) and requires human approval for high-risk paths.

## How CI works

The `.github/workflows/pedigree.yml` workflow runs `agiready/pedigree-action@main` on every pull request. The action:

1. Fetches all commits in the PR range.
2. Checks each commit for a valid in-toto attestation in `refs/attestations/commits`.
3. Verifies DSSE signatures against the Rekor transparency log.
4. Posts a summary comment on the PR with pass/fail status per commit.

## Note

These three scenarios are demonstrated in the hackathon submission video. The branches referenced above are created during the live demo recording and may not exist in the repository at all times.
