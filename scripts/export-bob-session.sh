#!/usr/bin/env bash
# Exports a Bob IDE task session to bob_sessions/.
#
# Usage: ./scripts/export-bob-session.sh <task-id> <slug>
# Example: ./scripts/export-bob-session.sh 639be8ed init-agents-md
#
# For now this creates a placeholder. Replace with the actual exported
# markdown from Bob IDE (Views > More Actions > History > Export).

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <task-id> <slug>"
  echo "Example: $0 639be8ed init-agents-md"
  exit 1
fi

TASK_ID="$1"
SLUG="$2"
NEXT_NUM=$(ls bob_sessions/*.md 2>/dev/null | grep -v README | wc -l | tr -d ' ')
NEXT_NUM=$((NEXT_NUM + 1))
PADDED=$(printf "%02d" "$NEXT_NUM")
FILENAME="bob_sessions/${PADDED}-${SLUG}.md"

cat > "$FILENAME" <<EOF
# Bob Session: ${SLUG}

**Task ID:** ${TASK_ID}
**Exported:** $(date -u +"%Y-%m-%dT%H:%M:%SZ")

> Replace this placeholder with the actual exported task history from Bob IDE.
>
> In Bob IDE: Views > More Actions > History > select task > Export task history icon.
EOF

echo "Created placeholder: $FILENAME"
echo "Replace with actual Bob export."
