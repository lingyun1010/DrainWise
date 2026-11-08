#!/bin/bash
source "$(dirname "$0")/lib.sh"
missing=""
[ -f "$STATE_DIR/$SESSION.planner" ] || missing="$missing planner (cd planner && npm test)"
[ -f "$STATE_DIR/$SESSION.pytest" ] || missing="$missing python (.venv/bin/pytest -q)"
[ -z "$missing" ] || block "full tests have not passed in this session. Missing:$missing. Run them, then retry gh pr create."
nudge PreToolUse "Pre-PR gates: dispatch fresh subagents for the smoke test first, then (once it passes) UI and UX reviews, each in its own browser tab. Put the smoke-test evidence in the PR body (word 'smoke') because gh pr merge is blocked without it."
