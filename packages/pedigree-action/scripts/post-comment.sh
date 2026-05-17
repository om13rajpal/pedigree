#!/usr/bin/env bash
# Post a markdown-formatted PR comment with verification results.
#
# Reads the JSON report from the verify step and formats it as a table
# using gh pr comment. Requires GH_TOKEN, REPORT_JSON, PR_NUMBER, and
# REPO environment variables.

set -euo pipefail

# ── Validate environment ─────────────────────────────────────────────
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${REPORT_JSON:?REPORT_JSON is required}"
: "${PR_NUMBER:?PR_NUMBER is required}"
: "${REPO:?REPO is required}"

SPEC_URL="https://github.com/${REPO}/blob/main/docs/predicate-spec.md"

# ── Parse report ─────────────────────────────────────────────────────
TOTAL="$(echo "${REPORT_JSON}" | jq -r '.total')"
VERIFIED="$(echo "${REPORT_JSON}" | jq -r '.verified')"
FAILED="$(echo "${REPORT_JSON}" | jq -r '.failed')"
PASSED="$(echo "${REPORT_JSON}" | jq -r '.passed')"

if [[ "${PASSED}" == "true" ]]; then
    HEADER="### ✅ Pedigree Verification: Passed"
    BADGE="All ${TOTAL} commit(s) carry valid attestations."
else
    HEADER="### ❌ Pedigree Verification: Failed"
    BADGE="${FAILED} of ${TOTAL} commit(s) are missing valid attestations."
fi

# Build summary line
SUMMARY="**Summary:** ${TOTAL} total | ${VERIFIED} passed | ${FAILED} failed"

# ── Build markdown table ─────────────────────────────────────────────
TABLE_HEADER="| Commit | Status | Agent | Risk | Approved |"
TABLE_SEP="|--------|--------|-------|------|----------|"

TABLE_ROWS=""
while IFS= read -r row; do
    [[ -z "${row}" ]] && continue

    SHA="$(echo "${row}" | jq -r '.short')"
    STATUS="$(echo "${row}" | jq -r '.status')"
    AGENT="$(echo "${row}" | jq -r '.agent')"
    RISK="$(echo "${row}" | jq -r '.risk')"
    APPROVED_RAW="$(echo "${row}" | jq -r '.approved')"

    # Format status with indicator
    if [[ "${STATUS}" == "verified" ]]; then
        STATUS_DISPLAY="Verified"
    elif [[ "${STATUS}" == "failed" ]]; then
        STATUS_DISPLAY="MISSING"
    else
        STATUS_DISPLAY="ERROR"
    fi

    # Format approved as Yes/No
    if [[ "${APPROVED_RAW}" == "true" ]]; then
        APPROVED_DISPLAY="Yes"
    elif [[ "${APPROVED_RAW}" == "false" ]]; then
        APPROVED_DISPLAY="No"
    else
        APPROVED_DISPLAY="-"
    fi

    TABLE_ROWS="${TABLE_ROWS}
| \`${SHA}\` | ${STATUS_DISPLAY} | ${AGENT} | ${RISK} | ${APPROVED_DISPLAY} |"

done < <(echo "${REPORT_JSON}" | jq -c '.commits[]')

# ── Assemble comment body ────────────────────────────────────────────
COMMENT_BODY="${HEADER}

${SUMMARY}

${BADGE}

${TABLE_HEADER}
${TABLE_SEP}${TABLE_ROWS}

---
*Verified by [Pedigree](${SPEC_URL}) -- cryptographic provenance for AI-written code.*"

# ── Post or update comment ───────────────────────────────────────────
# Look for an existing Pedigree comment to update (avoid duplicates).
EXISTING_COMMENT_ID="$(gh api \
    "repos/${REPO}/issues/${PR_NUMBER}/comments" \
    --jq '.[] | select(.body | startswith("### Pedigree Verification")) | .id' \
    2>/dev/null | head -n 1 || true)"

if [[ -n "${EXISTING_COMMENT_ID}" ]]; then
    gh api \
        --method PATCH \
        "repos/${REPO}/issues/comments/${EXISTING_COMMENT_ID}" \
        -f body="${COMMENT_BODY}" \
        --silent
    echo "[pedigree] Updated existing PR comment #${EXISTING_COMMENT_ID}"
else
    gh pr comment "${PR_NUMBER}" \
        --repo "${REPO}" \
        --body "${COMMENT_BODY}"
    echo "[pedigree] Posted new PR comment"
fi
