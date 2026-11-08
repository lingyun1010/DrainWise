#!/bin/bash
# PostToolUse (runs only on success): remember that full test suites passed this session.
source "$(dirname "$0")/lib.sh"
if echo "$COMMAND" | grep -qE 'npm (run )?test|vitest'; then touch "$STATE_DIR/$SESSION.planner"; fi
if echo "$COMMAND" | grep -qE 'pytest'; then touch "$STATE_DIR/$SESSION.pytest"; fi
exit 0
