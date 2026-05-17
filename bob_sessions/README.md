# Bob Sessions

This folder contains exported Bob IDE task session reports and Bobalytics screenshots, required for IBM Bob Hackathon judging.

## Required contents

### Task history exports (8+ files)

| File                       | Phase | Description                                |
| -------------------------- | ----- | ------------------------------------------ |
| `01-init-agents-md.md`     | 0     | Bob `/init` generating AGENTS.md           |
| `02-plan-architecture.md`  | 1     | Bob Plan mode drafting predicate spec      |
| `03-create-mode.md`        | 2     | Creating provenance-officer custom mode    |
| `04-create-skill.md`       | 2     | Creating the three Bob Skills              |
| `05-mcp-builder-server.md` | 3     | Bob MCP Builder scaffolding pedigree-mcp   |
| `06-implement-attest.md`   | 4     | Bob Code mode implementing sigstore signer |
| `07-implement-verify.md`   | 4     | Bob Code mode implementing ed25519 signer  |
| `08-build-action.md`       | 5     | Bob Code mode writing CI verify script     |
| `09-cross-agent-mcp.md`    | 7     | Cross-agent MCP consumption demo           |
| `10-sign-commit-pipeline.md` | 8   | Live signing pipeline (first attempt, self-corrected) |
| `11-sign-commit-pipeline-v2.md` | 8 | Live signing pipeline (clean run, all steps pass) |
| `12-high-risk-approval-gate.md` | 9 | HIGH risk commit with human approval gate demo |
| `13-verify-attestation-audit.md` | 10 | Verify attestation chain with EU AI Act audit explanation |
| `14-render-passport.md` | 11 | Render passport data, explain QR code auditor flow |

### Bobalytics screenshots (4 files)

| File                               | Timing               |
| ---------------------------------- | -------------------- |
| `screenshots/bobalytics-00.png`    | Baseline (~0% usage) |
| `screenshots/bobalytics-40.png`    | ~40% usage           |
| `screenshots/bobalytics-75.png`    | ~75% usage           |
| `screenshots/bobalytics-final.png` | Final consumption    |

## How to export

1. In Bob IDE, click **"..." (More Actions)** > **History**
2. Select the task from the history list
3. Click the task header to see the consumption summary
4. Take a screenshot of the summary
5. Click the **download icon** to export as markdown
6. Save into this folder with the correct filename
