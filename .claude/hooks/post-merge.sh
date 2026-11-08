#!/bin/bash
source "$(dirname "$0")/lib.sh"
nudge PostToolUse "Post-merge (stage 9): switch to main, re-run planner + pytest tests and the smoke test, close the ticket, update .scratch/drainwise/map.md, name the next ticket. Ask: is main green, and is the map updated?"
