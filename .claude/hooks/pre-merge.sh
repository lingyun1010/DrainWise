#!/bin/bash
source "$(dirname "$0")/lib.sh"
only_if 'gh pr merge'
PR=$(echo "$COMMAND" | grep -oE 'gh pr merge +[0-9]+' | grep -oE '[0-9]+')
ARGS=${PR:+$PR}
checks=$(gh pr checks $ARGS 2>&1) || block "CI is not green on this PR:
$checks"
body=$(gh pr view $ARGS --json body --jq .body 2>&1)
echo "$body" | grep -qi 'smoke' || block "no smoke-test evidence ('smoke') found in the PR body. Add it (command output or screenshot) before merging."
exit 0
