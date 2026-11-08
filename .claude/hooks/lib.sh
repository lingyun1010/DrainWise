#!/bin/bash
# Shared helpers for lingyun-project hooks. jq is not installed, so use python3.
INPUT=$(cat)
field() { echo "$INPUT" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(eval(sys.argv[1]))' "$1" 2>/dev/null; }
COMMAND=$(field 'd["tool_input"]["command"]')
SESSION=$(field 'd.get("session_id","unknown")')
STATE_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/.state"
mkdir -p "$STATE_DIR"
# nudge EVENT TEXT -> adds context for the model, never blocks
nudge() { python3 -c 'import json,sys; print(json.dumps({"hookSpecificOutput":{"hookEventName":sys.argv[1],"additionalContext":sys.argv[2]}}))' "$1" "$2"; }
block() { echo "BLOCKED: $1" >&2; exit 2; }
# only_if REGEX: exit quietly unless the command runs that program at a command position.
# The settings "if" filter is not reliable for compound commands, so every script re-checks.
only_if() { echo "$COMMAND" | grep -qE "(^|[;&|] *)$1" || exit 0; }
