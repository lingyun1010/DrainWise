#!/bin/bash
# SessionStart nudge: name the lingyun-project stage and its gate.
cat >/dev/null
python3 - <<'PY'
import json
msg = ("lingyun-project: run /lingyun-project to name the current stage. Stages: 1 Init, 2 Think, 3 Map, 4 Slice, "
       "5 Build, 6 Pre-PR, 7 Review, 8 Merge, 9 Post-merge. Never advance past a stage whose gate is red. "
       "Hooks active in this repo: pre-commit nudge, pre-PR block (needs planner + pytest runs this session), "
       "pre-merge block (needs CI green + 'smoke' evidence in PR body), post-merge nudge.")
print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": msg}}))
PY
