#!/bin/bash
# PostToolUse (runs only on success): remember that full test suites passed this session.
source "$(dirname "$0")/lib.sh"
# Only count a suite when it is the command word of a segment, and never when "||" could mask a failure.
case "$COMMAND" in *"||"*) exit 0 ;; esac
if echo "$COMMAND" | grep -qE '(^|[;&|] *)npm (run )?test( |$)'; then touch "$STATE_DIR/$SESSION.planner"; fi
if echo "$COMMAND" | grep -qE '(^|[;&|] *)(\.venv/bin/)?(python3? -m )?pytest( |$)'; then touch "$STATE_DIR/$SESSION.pytest"; fi
exit 0
