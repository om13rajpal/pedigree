#!/usr/bin/env bash
# Demo script showing the render_passport CLI command
# Renders a Passport page payload for a given commit SHA

set -euo pipefail

# Get the repo root directory
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if commit SHA is provided
if [ $# -eq 0 ]; then
  echo -e "${RED}Error: No commit SHA provided${NC}"
  echo "Usage: $0 <commit-sha>"
  echo ""
  echo "Example:"
  echo "  $0 abc123def456..."
  echo ""
  echo "To create a demo commit with attestation, run:"
  echo "  bash scripts/demo-cross-agent.sh"
  exit 1
fi

COMMIT_SHA="$1"

echo -e "${BLUE}=== Pedigree Passport Renderer Demo ===${NC}\n"
echo -e "Commit SHA: ${YELLOW}${COMMIT_SHA}${NC}\n"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo -e "${RED}Error: Not in a git repository${NC}"
  exit 1
fi

# Verify the commit exists
if ! git cat-file -e "$COMMIT_SHA" 2>/dev/null; then
  echo -e "${RED}Error: Commit $COMMIT_SHA does not exist${NC}"
  exit 1
fi

echo -e "${YELLOW}Step 1: Rendering Passport payload${NC}"
echo "  ✓ Calling render_passport via CLI..."

# Set environment to use ed25519 signer (no Sigstore needed)
export PEDIGREE_SIGNER=ed25519

# Call the render command
RENDER_OUTPUT=$(uv run --directory "$REPO_ROOT/packages/pedigree-mcp" python -m pedigree_mcp.cli render "$COMMIT_SHA" --skip-rekor 2>&1)
RENDER_EXIT_CODE=$?

if [ $RENDER_EXIT_CODE -ne 0 ]; then
  echo -e "\n${RED}Error: Failed to render passport${NC}"
  echo "$RENDER_OUTPUT"
  exit 1
fi

echo -e "  ✓ Passport rendered successfully\n"

# Pretty-print the JSON output
echo -e "${YELLOW}Step 2: Passport Payload (JSON)${NC}"
echo "$RENDER_OUTPUT" | python3 -m json.tool

# Extract key fields for summary
echo -e "\n${YELLOW}Step 3: What the Passport Page Would Display${NC}"

COMMIT_SHA_SHORT=$(echo "$RENDER_OUTPUT" | python3 -c "import sys, json; print(json.load(sys.stdin)['commit_sha'][:12])")
SIGNER=$(echo "$RENDER_OUTPUT" | python3 -c "import sys, json; print(json.load(sys.stdin)['signer_identity'])")
REKOR_VERIFIED=$(echo "$RENDER_OUTPUT" | python3 -c "import sys, json; print(json.load(sys.stdin)['rekor_verified'])")
SUMMARY=$(echo "$RENDER_OUTPUT" | python3 -c "import sys, json; print(json.load(sys.stdin)['summary'])")

# Extract predicate details
AGENT_TOOL=$(echo "$RENDER_OUTPUT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['predicate'].get('agent', {}).get('tool', 'unknown'))")
AGENT_MODEL=$(echo "$RENDER_OUTPUT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['predicate'].get('agent', {}).get('model', 'unknown'))")
AUTHORSHIP_KIND=$(echo "$RENDER_OUTPUT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['predicate']['authorship']['kind'])")
FILES_TOUCHED=$(echo "$RENDER_OUTPUT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(', '.join(d['predicate']['scope']['filesTouched']))")
RISK_CLASS=$(echo "$RENDER_OUTPUT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['predicate']['scope']['riskClass'])")
POLICY_SATISFIED=$(echo "$RENDER_OUTPUT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['predicate']['policy']['satisfied'])")

echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    COMMIT PASSPORT                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo -e ""
echo -e "  ${BLUE}Commit:${NC}           $COMMIT_SHA_SHORT"
echo -e "  ${BLUE}Signer:${NC}           $SIGNER"
echo -e "  ${BLUE}Rekor Verified:${NC}   $REKOR_VERIFIED"
echo -e ""
echo -e "  ${BLUE}Agent Tool:${NC}       $AGENT_TOOL"
echo -e "  ${BLUE}Agent Model:${NC}      $AGENT_MODEL"
echo -e "  ${BLUE}Authorship:${NC}       $AUTHORSHIP_KIND"
echo -e ""
echo -e "  ${BLUE}Files Touched:${NC}    $FILES_TOUCHED"
echo -e "  ${BLUE}Risk Class:${NC}       $RISK_CLASS"
echo -e "  ${BLUE}Policy Status:${NC}    $POLICY_SATISFIED"
echo -e ""
echo -e "  ${BLUE}Summary:${NC}"
echo -e "  $SUMMARY"
echo -e ""

# Show what the web UI would display
echo -e "${YELLOW}Step 4: Web UI Preview${NC}"
echo -e ""
echo -e "The Next.js Passport page at ${BLUE}/passport/${COMMIT_SHA}${NC} would show:"
echo -e ""
echo -e "  • ${GREEN}✓${NC} Cryptographic verification badge"
echo -e "  • ${GREEN}✓${NC} Agent identity card (tool, model, provider)"
echo -e "  • ${GREEN}✓${NC} Authorship breakdown (human vs AI contribution)"
echo -e "  • ${GREEN}✓${NC} File change summary with risk classification"
echo -e "  • ${GREEN}✓${NC} Policy compliance status"
echo -e "  • ${GREEN}✓${NC} Link to Rekor transparency log entry"
echo -e "  • ${GREEN}✓${NC} QR code for mobile verification"
echo -e "  • ${GREEN}✓${NC} Natural language summary (template-based or AI-generated)"
echo -e ""

echo -e "${GREEN}✓ Demo complete!${NC}"
echo -e "\nTo view this in the web UI, run:"
echo -e "  ${BLUE}pnpm --filter pedigree-web dev${NC}"
echo -e "  Then visit: ${BLUE}http://localhost:3000/passport/${COMMIT_SHA}${NC}"

# Made with Bob
