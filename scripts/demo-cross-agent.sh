#!/usr/bin/env bash
# Demo script showing pedigree-mcp working with multiple AI agents
# Creates a temporary git repo with commits from Bob and Cursor

set -euo pipefail

# Get the repo root directory
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Pedigree Cross-Agent Demo ===${NC}\n"

# Create temporary directory
DEMO_DIR=$(mktemp -d)
trap "rm -rf $DEMO_DIR" EXIT

echo -e "${YELLOW}Step 1: Creating temporary git repository${NC}"
cd "$DEMO_DIR"
git init -q
git config user.name "Demo User"
git config user.email "demo@example.com"

# Create initial commit
echo "# Demo Project" > README.md
git add README.md
git commit -q -m "Initial commit"
INITIAL_SHA=$(git rev-parse HEAD)
echo -e "  ✓ Initial commit: ${INITIAL_SHA:0:12}\n"

# Create Bob's commit
echo -e "${YELLOW}Step 2: Creating commit 'by Bob' (ibm-bob agent)${NC}"
echo "function hello() { return 'Hello from Bob'; }" > src.js
git add src.js
git commit -q -m "Add hello function"
BOB_SHA=$(git rev-parse HEAD)
echo -e "  ✓ Bob's commit: ${BOB_SHA:0:12}"

# Create Bob's predicate
BOB_PREDICATE=$(cat <<EOF
{
  "schemaVersion": "1.0.0",
  "authorship": {
    "kind": "ai-autonomous",
    "humanShare": null
  },
  "agent": {
    "tool": "ibm-bob",
    "toolVersion": "1.0.0",
    "model": "granite-3.1-8b-instruct",
    "modelProvider": "ibm"
  },
  "execution": {
    "modeSlug": "code",
    "skillHashes": [],
    "agentsMdHash": "sha256:abc123",
    "promptHash": "sha256:def456",
    "planHash": null,
    "bobSessionId": "demo-session-bob",
    "bobcoinsConsumed": 0.5
  },
  "scope": {
    "filesTouched": ["src.js"],
    "linesAdded": 1,
    "linesDeleted": 0,
    "riskClass": "low"
  },
  "policy": {
    "agentsMdPolicy": "v1",
    "requiresHumanApproval": false,
    "satisfied": true
  }
}
EOF
)

echo "$BOB_PREDICATE" > /tmp/bob-predicate.json

# Attest Bob's commit
echo "  ✓ Attesting with PEDIGREE_SIGNER=ed25519..."
export PEDIGREE_SIGNER=ed25519
uv run --directory "$REPO_ROOT/packages/pedigree-mcp" python -m pedigree_mcp.cli attest "$BOB_SHA" \
  --predicate /tmp/bob-predicate.json \
  --skip-rekor > /tmp/bob-attest.json 2>&1
echo -e "  ✓ Bob's attestation created\n"

# Create Cursor's commit
echo -e "${YELLOW}Step 3: Creating commit 'by Cursor' (cursor agent)${NC}"
echo "function goodbye() { return 'Goodbye from Cursor'; }" >> src.js
git add src.js
git commit -q -m "Add goodbye function"
CURSOR_SHA=$(git rev-parse HEAD)
echo -e "  ✓ Cursor's commit: ${CURSOR_SHA:0:12}"

# Create Cursor's predicate
CURSOR_PREDICATE=$(cat <<EOF
{
  "schemaVersion": "1.0.0",
  "authorship": {
    "kind": "ai-autonomous",
    "humanShare": null
  },
  "agent": {
    "tool": "cursor",
    "toolVersion": "0.50.0",
    "model": "gpt-4o",
    "modelProvider": "openai"
  },
  "execution": {
    "modeSlug": "code",
    "skillHashes": [],
    "agentsMdHash": "sha256:xyz789",
    "promptHash": "sha256:uvw012",
    "planHash": null,
    "bobSessionId": null,
    "bobcoinsConsumed": null
  },
  "scope": {
    "filesTouched": ["src.js"],
    "linesAdded": 1,
    "linesDeleted": 0,
    "riskClass": "low"
  },
  "policy": {
    "agentsMdPolicy": "v1",
    "requiresHumanApproval": false,
    "satisfied": true
  }
}
EOF
)

echo "$CURSOR_PREDICATE" > /tmp/cursor-predicate.json

# Attest Cursor's commit
echo "  ✓ Attesting with PEDIGREE_SIGNER=ed25519..."
uv run --directory "$REPO_ROOT/packages/pedigree-mcp" python -m pedigree_mcp.cli attest "$CURSOR_SHA" \
  --predicate /tmp/cursor-predicate.json \
  --skip-rekor > /tmp/cursor-attest.json 2>&1
echo -e "  ✓ Cursor's attestation created\n"

# Verify both commits
echo -e "${YELLOW}Step 4: Verifying attestation chain${NC}"

echo -e "\n${GREEN}Verifying Bob's commit (ibm-bob):${NC}"
BOB_VERIFY=$(uv run --directory "$REPO_ROOT/packages/pedigree-mcp" python -m pedigree_mcp.cli verify "$BOB_SHA" --skip-rekor)
echo "$BOB_VERIFY" | python3 -m json.tool
BOB_VERIFIED=$(echo "$BOB_VERIFY" | python3 -c "import sys, json; print(json.load(sys.stdin)['verified'])")

echo -e "\n${GREEN}Verifying Cursor's commit (cursor):${NC}"
CURSOR_VERIFY=$(uv run --directory "$REPO_ROOT/packages/pedigree-mcp" python -m pedigree_mcp.cli verify "$CURSOR_SHA" --skip-rekor)
echo "$CURSOR_VERIFY" | python3 -m json.tool
CURSOR_VERIFIED=$(echo "$CURSOR_VERIFY" | python3 -c "import sys, json; print(json.load(sys.stdin)['verified'])")

# Print summary
echo -e "\n${BLUE}=== Summary ===${NC}"
echo -e "Repository: $DEMO_DIR"
echo -e "\nCommit Chain:"
echo -e "  1. Initial commit: ${INITIAL_SHA:0:12} (no attestation)"
echo -e "  2. Bob's commit:   ${BOB_SHA:0:12} (ibm-bob) - Verified: ${GREEN}${BOB_VERIFIED}${NC}"
echo -e "  3. Cursor's commit: ${CURSOR_SHA:0:12} (cursor) - Verified: ${GREEN}${CURSOR_VERIFIED}${NC}"

if [[ "$BOB_VERIFIED" == "True" && "$CURSOR_VERIFIED" == "True" ]]; then
  echo -e "\n${GREEN}✓ SUCCESS: Both agents' attestations verified successfully!${NC}"
  echo -e "\nThis demonstrates that pedigree-mcp can:"
  echo -e "  • Track commits from multiple AI agents"
  echo -e "  • Verify each agent's cryptographic signature"
  echo -e "  • Maintain a complete chain of custody"
  exit 0
else
  echo -e "\n${YELLOW}⚠ WARNING: Some verifications failed${NC}"
  exit 1
fi

# Made with Bob
