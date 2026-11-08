#!/bin/bash
source "$(dirname "$0")/lib.sh"
only_if 'gh pr create'
missing=""
[ -f "$STATE_DIR/$SESSION.planner" ] || missing="$missing planner (cd planner && npm test)"
[ -f "$STATE_DIR/$SESSION.pytest" ] || missing="$missing python (.venv/bin/pytest -q)"
[ -z "$missing" ] || block "full tests have not passed in this session. Missing:$missing. Run them, then retry gh pr create."
DET="$HOME/.claude/skills/impeccable/scripts/impeccable"
DETECT=""
if [ -x "$DET" ] && [ -d "$CLAUDE_PROJECT_DIR/web/app" ]; then
  out=$("$DET" detect --json "$CLAUDE_PROJECT_DIR/web/app" 2>/dev/null)
  code=$?
  if [ "$code" = "2" ]; then
    n=$(echo "$out" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else len(d.get("findings",d)))' 2>/dev/null)
    DETECT=" Impeccable detector (web/app) reported ${n:-some} findings: run '~/.claude/skills/impeccable/scripts/impeccable detect web/app' and list them under Known issues in the PR body."
  elif [ "$code" = "0" ]; then
    DETECT=" Impeccable detector (web/app): clean."
  fi
fi
nudge PreToolUse "Pre-PR gates (docs/review-gates.md): run the smoke test only if a feature was added or its behaviour changed; for layout/style/copy-only changes reuse earlier Smoke evidence and say what changed. Ask the user before running ui-reviewer, ux-reviewer or design-reviewer.${DETECT} The PR body must contain the word 'smoke' because gh pr merge is blocked without it."
