#!/usr/bin/env bash
# Core verification driver for the Pedigree GitHub Action.
#
# Iterates over every commit in a PR's range, calls pedigree-mcp's CLI
# verify command for each, collects results into a JSON report, and sets
# GitHub Actions outputs. Exits non-zero if any commit fails verification
# and FAIL_ON_UNSIGNED is "true".

set -euo pipefail

# ── Colours for CI output ────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_ok()   { echo -e "${GREEN}[pedigree]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[pedigree]${NC} $*"; }
log_err()  { echo -e "${RED}[pedigree]${NC} $*"; }
log_info() { echo -e "${CYAN}[pedigree]${NC} $*"; }

# ── Resolve configuration ────────────────────────────────────────────
FAIL_ON_UNSIGNED="${FAIL_ON_UNSIGNED:-true}"
PREDICATE_TYPE="${PREDICATE_TYPE:-dev.pedigree/ai-authorship/v1}"
MCP_PATH="${MCP_PATH:-packages/pedigree-mcp}"
JSON_OUTPUT_FILE=""

# ── Parse arguments ──────────────────────────────────────────────────
# Support --json-output flag for local testing
while [[ $# -gt 0 ]]; do
    case "$1" in
        --json-output)
            JSON_OUTPUT_FILE="$2"
            shift 2
            ;;
        --json-output=*)
            JSON_OUTPUT_FILE="${1#*=}"
            shift
            ;;
        *)
            break
            ;;
    esac
done

# ── Determine commit range ───────────────────────────────────────────
# Accept explicit arguments, fall back to GitHub event context.
if [[ $# -ge 2 ]]; then
    BASE_SHA="$1"
    HEAD_SHA="$2"
elif [[ -n "${GITHUB_EVENT_PATH:-}" ]] && [[ -f "${GITHUB_EVENT_PATH}" ]]; then
    BASE_SHA="$(jq -r '.pull_request.base.sha // empty' "${GITHUB_EVENT_PATH}" 2>/dev/null || true)"
    HEAD_SHA="$(jq -r '.pull_request.head.sha // empty' "${GITHUB_EVENT_PATH}" 2>/dev/null || true)"

    if [[ -z "${BASE_SHA}" ]] || [[ -z "${HEAD_SHA}" ]]; then
        log_err "Could not determine commit range from GITHUB_EVENT_PATH"
        log_err "Provide base and head SHAs as arguments: verify.sh <base> <head>"
        exit 2
    fi
else
    log_err "No commit range provided"
    log_err "Usage: verify.sh <base-sha> <head-sha>"
    log_err "Or set GITHUB_EVENT_PATH for automatic PR range detection"
    exit 2
fi

log_info "Verifying commits: ${BASE_SHA:0:12}..${HEAD_SHA:0:12}"
log_info "Predicate type:    ${PREDICATE_TYPE}"
log_info "Fail on unsigned:  ${FAIL_ON_UNSIGNED}"

# ── Enumerate commits in range ───────────────────────────────────────
# Handle initial commit (no parent) gracefully
if ! git rev-parse "${BASE_SHA}" >/dev/null 2>&1; then
    log_warn "Base SHA ${BASE_SHA:0:12} not found (possibly initial commit)"
    # For initial commit, verify just the HEAD
    COMMITS="${HEAD_SHA}"
else
    COMMITS="$(git rev-list "${BASE_SHA}..${HEAD_SHA}" 2>/dev/null || true)"
fi

if [[ -z "${COMMITS}" ]]; then
    log_warn "No commits found in range ${BASE_SHA:0:12}..${HEAD_SHA:0:12}"
    # Write empty report
    REPORT='{"commits":[],"total":0,"verified":0,"failed":0,"passed":true}'
    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
        echo "passed=true" >> "${GITHUB_OUTPUT}"
        echo "report_json=${REPORT}" >> "${GITHUB_OUTPUT}"
    fi
    if [[ -n "${JSON_OUTPUT_FILE}" ]]; then
        echo "${REPORT}" | jq '.' > "${JSON_OUTPUT_FILE}"
        log_info "Report written to ${JSON_OUTPUT_FILE}"
    fi
    log_ok "No commits to verify -- passing"
    exit 0
fi

COMMIT_COUNT="$(echo "${COMMITS}" | wc -l | tr -d ' ')"
log_info "Found ${COMMIT_COUNT} commit(s) to verify"

# ── Verify each commit ───────────────────────────────────────────────
RESULTS="[]"
VERIFIED_COUNT=0
FAILED_COUNT=0
HAS_FAILURE=false

while IFS= read -r sha; do
    [[ -z "${sha}" ]] && continue

    SHORT_SHA="${sha:0:12}"
    log_info "Verifying ${SHORT_SHA}..."

    # Call the pedigree-mcp CLI for verification
    CLI_OUTPUT=""
    CLI_EXIT=0
    CLI_OUTPUT="$(uv run --directory "${MCP_PATH}" \
        python -m pedigree_mcp.cli verify "${sha}" 2>/dev/null)" || CLI_EXIT=$?

    if [[ "${CLI_EXIT}" -eq 0 ]]; then
        # Successful verification -- extract fields from JSON output
        STATUS="verified"
        AGENT="$(echo "${CLI_OUTPUT}" | jq -r '.predicate.agent.tool // "-"' 2>/dev/null || echo "-")"
        RISK="$(echo "${CLI_OUTPUT}" | jq -r '.predicate.scope.riskClass // "-"' 2>/dev/null || echo "-")"
        APPROVED="$(echo "${CLI_OUTPUT}" | jq -r '.predicate.authorship.humanApprover.approved // false' 2>/dev/null || echo "false")"
        POLICY_OK="$(echo "${CLI_OUTPUT}" | jq -r '.predicate.policy.satisfied // false' 2>/dev/null || echo "false")"
        VERIFIED_COUNT=$((VERIFIED_COUNT + 1))
        log_ok "${SHORT_SHA}: verified (agent=${AGENT}, risk=${RISK})"
    elif [[ "${CLI_EXIT}" -eq 1 ]]; then
        # Verification failure (attestation missing or broken)
        STATUS="failed"
        AGENT="-"
        RISK="-"
        APPROVED="-"
        POLICY_OK="-"
        FAILED_COUNT=$((FAILED_COUNT + 1))
        HAS_FAILURE=true
        ERROR_MSG="$(echo "${CLI_OUTPUT}" | jq -r '.error // "verification failed"' 2>/dev/null || echo "verification failed")"
        log_err "${SHORT_SHA}: FAILED -- ${ERROR_MSG}"
    else
        # Unexpected error
        STATUS="error"
        AGENT="-"
        RISK="-"
        APPROVED="-"
        POLICY_OK="-"
        FAILED_COUNT=$((FAILED_COUNT + 1))
        HAS_FAILURE=true
        log_err "${SHORT_SHA}: ERROR (exit code ${CLI_EXIT})"
    fi

    # Append to results array
    ENTRY="$(jq -n \
        --arg sha "${sha}" \
        --arg short "${SHORT_SHA}" \
        --arg status "${STATUS}" \
        --arg agent "${AGENT}" \
        --arg risk "${RISK}" \
        --arg approved "${APPROVED}" \
        --arg policy_ok "${POLICY_OK}" \
        '{sha: $sha, short: $short, status: $status, agent: $agent, risk: $risk, approved: $approved, policy_satisfied: $policy_ok}'
    )"
    RESULTS="$(echo "${RESULTS}" | jq --argjson entry "${ENTRY}" '. + [$entry]')"

done <<< "${COMMITS}"

# ── Build summary report ─────────────────────────────────────────────
PASSED="true"
if [[ "${HAS_FAILURE}" == "true" ]] && [[ "${FAIL_ON_UNSIGNED}" == "true" ]]; then
    PASSED="false"
fi

REPORT="$(jq -n \
    --argjson commits "${RESULTS}" \
    --argjson total "${COMMIT_COUNT}" \
    --argjson verified "${VERIFIED_COUNT}" \
    --argjson failed "${FAILED_COUNT}" \
    --arg passed "${PASSED}" \
    '{commits: $commits, total: $total, verified: $verified, failed: $failed, passed: ($passed == "true")}'
)"

# ── Print human-readable table ───────────────────────────────────────
echo ""
log_info "=== Pedigree Verification Report ==="
echo ""
printf "%-14s %-12s %-16s %-10s %-10s\n" "COMMIT" "STATUS" "AGENT" "RISK" "APPROVED"
printf "%-14s %-12s %-16s %-10s %-10s\n" "--------------" "------------" "----------------" "----------" "----------"

echo "${RESULTS}" | jq -r '.[] | "\(.short) \(.status) \(.agent) \(.risk) \(.approved)"' | \
while IFS=' ' read -r c_short c_status c_agent c_risk c_approved; do
    if [[ "${c_status}" == "verified" ]]; then
        STATUS_DISPLAY="${GREEN}verified${NC}"
    elif [[ "${c_status}" == "failed" ]]; then
        STATUS_DISPLAY="${RED}FAILED${NC}"
    else
        STATUS_DISPLAY="${RED}ERROR${NC}"
    fi
    printf "%-14s ${STATUS_DISPLAY}%-4s %-16s %-10s %-10s\n" "${c_short}" "" "${c_agent}" "${c_risk}" "${c_approved}"
done

echo ""
log_info "Total: ${COMMIT_COUNT} | Verified: ${VERIFIED_COUNT} | Failed: ${FAILED_COUNT}"

# ── Set outputs ──────────────────────────────────────────────────────
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "passed=${PASSED}" >> "${GITHUB_OUTPUT}"
    # JSON must be single-line for GITHUB_OUTPUT
    REPORT_ONELINE="$(echo "${REPORT}" | jq -c '.')"
    echo "report_json=${REPORT_ONELINE}" >> "${GITHUB_OUTPUT}"
fi

# Write to file if --json-output was specified
if [[ -n "${JSON_OUTPUT_FILE}" ]]; then
    echo "${REPORT}" | jq '.' > "${JSON_OUTPUT_FILE}"
    log_info "Report written to ${JSON_OUTPUT_FILE}"
fi

# ── Exit code ────────────────────────────────────────────────────────
if [[ "${PASSED}" == "false" ]]; then
    log_err "Verification FAILED -- ${FAILED_COUNT} commit(s) missing valid attestations"
    exit 1
fi

log_ok "All ${COMMIT_COUNT} commit(s) verified successfully"
exit 0
