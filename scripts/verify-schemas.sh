#!/usr/bin/env bash
# Verifies that the TypeScript (Zod) and Python (Pydantic) predicate schemas
# accept and reject the same JSON fixtures, ensuring cross-language parity.
#
# Runs each fixture through both schema validators and asserts their pass/fail
# results match. Exits non-zero on any mismatch.
#
# Compatible with bash 3+ (macOS default) by avoiding associative arrays.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURES_DIR="$REPO_ROOT/packages/pedigree-types/tests/fixtures"
MCP_DIR="$REPO_ROOT/packages/pedigree-mcp"
TYPES_DIR="$REPO_ROOT/packages/pedigree-types"

echo "[verify-schemas] Checking schema parity between Zod (TS) and Pydantic (Python)"

# ---------------------------------------------------------------------------
# Expected results per fixture (parallel arrays for bash 3 compatibility).
# "valid" fixtures should pass; "invalid" fixtures with schema errors should
# fail; "invalid-policy-unsatisfied" is schema-valid (policy.satisfied=false
# is allowed by the schema).
# ---------------------------------------------------------------------------
EXPECTED_NAMES=(
  "valid-ai-assisted.json"
  "valid-ai-autonomous.json"
  "valid-human.json"
  "invalid-missing-kind.json"
  "invalid-bad-risk-class.json"
  "invalid-policy-unsatisfied.json"
)
EXPECTED_VALUES=(
  "pass"
  "pass"
  "pass"
  "fail"
  "fail"
  "pass"
)

# Helper: look up expected result by fixture name.
get_expected() {
  local name="$1"
  local i
  for i in "${!EXPECTED_NAMES[@]}"; do
    if [[ "${EXPECTED_NAMES[$i]}" == "$name" ]]; then
      echo "${EXPECTED_VALUES[$i]}"
      return
    fi
  done
  echo "unknown"
}

MISMATCHES=0

# Parallel arrays to store results.
ALL_NAMES=()
PY_RESULTS=()
TS_RESULTS=()

# ---------------------------------------------------------------------------
# Step 1: Run fixtures through the Pydantic schema
# ---------------------------------------------------------------------------
echo "[verify-schemas] Testing Python (Pydantic) schema..."

PYTHON_SCRIPT=$(cat <<'PYEOF'
import json
import sys
from pathlib import Path

sys.path.insert(0, "src")

from pedigree_mcp.schema import parse_predicate
from pedigree_mcp.errors import SchemaValidationError

fixture_path = sys.argv[1]
data = json.loads(Path(fixture_path).read_text())
predicate = data.get("predicate", data)

try:
    parse_predicate(predicate)
    print("pass")
except (SchemaValidationError, Exception):
    print("fail")
PYEOF
)

idx=0
for fixture in "$FIXTURES_DIR"/*.json; do
    name="$(basename "$fixture")"
    result=$(cd "$MCP_DIR" && uv run python -c "$PYTHON_SCRIPT" "$fixture" 2>/dev/null || echo "error")
    ALL_NAMES+=("$name")
    PY_RESULTS+=("$result")
    echo "  Python: $name -> $result"
    idx=$((idx + 1))
done

# ---------------------------------------------------------------------------
# Step 2: Run fixtures through the Zod schema
# ---------------------------------------------------------------------------
echo "[verify-schemas] Testing TypeScript (Zod) schema..."

ts_idx=0
for fixture in "$FIXTURES_DIR"/*.json; do
    name="$(basename "$fixture")"
    # Use npx tsx to run inline TypeScript against the built dist
    result=$(cd "$TYPES_DIR" && npx tsx -e "
const { readFileSync } = require('node:fs');
const { predicateSchema } = require('./dist/predicate.js');
const data = JSON.parse(readFileSync('$fixture', 'utf-8'));
const predicate = data.predicate ?? data;
const result = predicateSchema.safeParse(predicate);
console.log(result.success ? 'pass' : 'fail');
" 2>/dev/null || echo "error")
    TS_RESULTS+=("$result")
    echo "  TS:     $name -> $result"
    ts_idx=$((ts_idx + 1))
done

# ---------------------------------------------------------------------------
# Step 3: Compare results
# ---------------------------------------------------------------------------
echo ""
echo "[verify-schemas] Comparing results..."

for i in "${!ALL_NAMES[@]}"; do
    name="${ALL_NAMES[$i]}"
    expected=$(get_expected "$name")
    py_result="${PY_RESULTS[$i]:-missing}"
    ts_result="${TS_RESULTS[$i]:-missing}"

    if [[ "$expected" == "unknown" ]]; then
        # Fixture not in expected list; just compare Python vs TS
        if [[ "$py_result" != "$ts_result" ]]; then
            echo "  MISMATCH: $name -- Python=$py_result, TS=$ts_result (no expected value)"
            MISMATCHES=$((MISMATCHES + 1))
        else
            echo "  OK: $name -> $py_result (both agree, no expected value set)"
        fi
        continue
    fi

    if [[ "$py_result" != "$ts_result" ]]; then
        echo "  MISMATCH: $name -- Python=$py_result, TS=$ts_result (expected=$expected)"
        MISMATCHES=$((MISMATCHES + 1))
    elif [[ "$py_result" != "$expected" ]]; then
        echo "  UNEXPECTED: $name -- both=$py_result but expected=$expected"
        MISMATCHES=$((MISMATCHES + 1))
    else
        echo "  OK: $name -> $py_result (matches expected=$expected)"
    fi
done

echo ""
if [[ $MISMATCHES -gt 0 ]]; then
    echo "[verify-schemas] FAILED: $MISMATCHES mismatch(es) found."
    exit 1
else
    echo "[verify-schemas] PASSED: All fixtures produce matching results."
    exit 0
fi
