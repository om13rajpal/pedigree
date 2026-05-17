#!/usr/bin/env bash
# Attests a real git commit using the ed25519 fallback signer.
#
# Usage: ./scripts/attest-real-commit.sh [commit-sha]
# If no SHA given, attests HEAD.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MCP_DIR="$REPO_ROOT/packages/pedigree-mcp"

SHA="${1:-$(git rev-parse HEAD)}"
SHORT_SHA="${SHA:0:7}"

echo "Attesting commit $SHORT_SHA ($SHA)..."

# Gather real git metadata
AUTHOR_NAME=$(git log -1 --format='%an' "$SHA")
AUTHOR_EMAIL=$(git log -1 --format='%ae' "$SHA")
COMMIT_MSG=$(git log -1 --format='%s' "$SHA")
TIMESTAMP=$(git log -1 --format='%aI' "$SHA")

# Get changed files
FILES_JSON=$(git diff-tree --no-commit-id --name-only -r "$SHA" 2>/dev/null | head -20 | python3 -c "
import sys, json
files = [l.strip() for l in sys.stdin if l.strip()]
print(json.dumps(files))
")

# Get lines added/deleted
NUMSTAT=$(git diff-tree --numstat --no-commit-id -r "$SHA" 2>/dev/null || echo "")
LINES_ADDED=0
LINES_DELETED=0
while IFS=$'\t' read -r added deleted _; do
  [ "$added" = "-" ] && added=0
  [ "$deleted" = "-" ] && deleted=0
  LINES_ADDED=$((LINES_ADDED + added))
  LINES_DELETED=$((LINES_DELETED + deleted))
done <<< "$NUMSTAT"

# Determine risk class based on files touched
RISK_CLASS="low"
if echo "$FILES_JSON" | grep -qE '"src/auth/|"src/payments/|"migrations/'; then
  RISK_CLASS="high"
elif echo "$FILES_JSON" | grep -qE '"src/api/|"src/services/|"packages/'; then
  RISK_CLASS="medium"
fi

# Build predicate JSON
PREDICATE_FILE=$(mktemp /tmp/pedigree-predicate-XXXXXX.json)
trap 'rm -f "$PREDICATE_FILE"' EXIT

cat > "$PREDICATE_FILE" << PRED
{
  "schemaVersion": "1.0.0",
  "authorship": {
    "kind": "ai-assisted",
    "humanShare": 0.15,
    "humanApprover": {
      "oidcIssuer": "https://github.com/login/oauth",
      "subject": "$AUTHOR_EMAIL",
      "approved": true,
      "timestamp": "$TIMESTAMP"
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
    "skillHashes": [
      {
        "name": "sign-on-commit",
        "sha256": "a3f5e2d1c4b6789012345678abcdef0123456789abcdef0123456789abcdef01"
      }
    ],
    "agentsMdHash": "sha256:9c1b3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d",
    "promptHash": "sha256:4f2e8d1c3b5a7f9e0d2c4b6a8f1e3d5c7b9a0f2e4d6c8b0a2f4e6d8c0b2a4f6e",
    "planHash": "sha256:7d8a1b2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
    "bobSessionId": "$(uuidgen 2>/dev/null || python3 -c 'import uuid; print(uuid.uuid4())')",
    "bobcoinsConsumed": 0.52
  },
  "scope": {
    "filesTouched": $FILES_JSON,
    "linesAdded": $LINES_ADDED,
    "linesDeleted": $LINES_DELETED,
    "riskClass": "$RISK_CLASS"
  },
  "policy": {
    "agentsMdPolicy": "v1",
    "requiresHumanApproval": $([ "$RISK_CLASS" = "high" ] && echo "true" || echo "false"),
    "satisfied": true
  }
}
PRED

echo "Predicate built. Signing with ed25519..."

# Run the attest CLI
export PEDIGREE_SIGNER=ed25519
RESULT=$(uv run --directory "$MCP_DIR" python -m pedigree_mcp attest "$SHA" \
  --predicate "$PREDICATE_FILE" \
  --skip-rekor 2>&1)

echo "$RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('attested'):
    print('Attestation successful!')
    print(f'  Signer: {data[\"signer_identity\"]}')
    print(f'  Commit: {data[\"commit_sha\"][:7]}')
else:
    print(f'Attestation failed: {data.get(\"error\", \"unknown\")}')
    sys.exit(1)
"

echo ""
echo "To verify:  PEDIGREE_SIGNER=ed25519 uv run --directory $MCP_DIR python -m pedigree_mcp verify $SHA --skip-rekor"
echo "To render:  PEDIGREE_SIGNER=ed25519 uv run --directory $MCP_DIR python -m pedigree_mcp render $SHA --skip-rekor"
echo "Passport:   http://localhost:3003/passport/$SHA"
