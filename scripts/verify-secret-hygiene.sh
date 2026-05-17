#!/usr/bin/env bash
# Scans staged and tracked files for leaked secrets.
# Exits non-zero if any pattern matches outside allowlisted paths.

set -euo pipefail

PATTERNS=(
  'sk-[a-zA-Z0-9]{20,}'
  'ibm_cloud_api_key'
  'WATSONX_API_KEY='
  'API_KEY=[^$]'
  'PRIVATE_KEY='
  'aws_secret_access_key'
  'ghp_[a-zA-Z0-9]{36}'
  'ghs_[a-zA-Z0-9]{36}'
)

ALLOWLIST='\.gitignore|\.env\.example|docs/|\.md:|verify-secret-hygiene\.sh|bob_sessions/'

EXIT_CODE=0

for pattern in "${PATTERNS[@]}"; do
  matches=$(git grep -n -E "$pattern" -- ':!node_modules' ':!.venv' ':!pnpm-lock.yaml' ':!uv.lock' 2>/dev/null || true)
  if [ -n "$matches" ]; then
    filtered=$(echo "$matches" | grep -v -E "$ALLOWLIST" || true)
    if [ -n "$filtered" ]; then
      echo "SECRET DETECTED -- pattern: $pattern"
      echo "$filtered"
      echo ""
      EXIT_CODE=1
    fi
  fi
done

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "Secret hygiene check passed."
fi

exit $EXIT_CODE
