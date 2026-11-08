#!/bin/bash
source "$(dirname "$0")/lib.sh"
only_if 'gh pr create'
missing=""
[ -f "$STATE_DIR/$SESSION.planner" ] || missing="$missing planner (cd planner && npm test)"
[ -f "$STATE_DIR/$SESSION.pytest" ] || missing="$missing python (.venv/bin/pytest -q)"
[ -z "$missing" ] || block "full tests have not passed in this session. Missing:$missing. Run them, then retry gh pr create."
DET="$CLAUDE_PROJECT_DIR/.claude/skills/impeccable/scripts/impeccable"
DETECT=""
if [ -x "$DET" ] && [ -d "$CLAUDE_PROJECT_DIR/web/app" ]; then
  out=$("$DET" detect --json "$CLAUDE_PROJECT_DIR/web/app" 2>/dev/null)
  code=$?
  if [ "$code" = "2" ]; then
    n=$(echo "$out" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else len(d.get("findings",d)))' 2>/dev/null)
    DETECT=" Impeccable detector (web/app) reported ${n:-some} findings: run '.claude/skills/impeccable/scripts/impeccable detect web/app' and list them under Known issues in the PR body."
  elif [ "$code" = "0" ]; then
    DETECT=" Impeccable detector (web/app): clean."
  fi
fi
nudge PreToolUse "Pre-PR gates: dispatch fresh subagents for the smoke test first, then (once it passes) the UI, UX and design reviews (ui-reviewer, ux-reviewer, design-reviewer), run one after another, each in its own browser tab. design-reviewer applies Impeccable's critique rubric.${DETECT} Put the smoke-test evidence in the PR body (word 'smoke') because gh pr merge is blocked without it."
