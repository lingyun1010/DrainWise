# 19: Crew can decline a run, skip a stop or end a run early, with a reason

Type: task
Status: done
Blocked by: None
Spec: `.scratch/drainwise/spec.md`

## What to build

On the crew phone: **Decline run** (before accepting), **Skip this stop** and **End run early** (after accepting). Each opens a `ReasonDialog` (built on `Dialog`) with a fixed list of reasons: Truck is full, Truck broke down, Not enough time left, Can't reach the site, Crew unavailable, Other (optional note). The Activity log also gets crew toggle buttons, like the map legend.

## Decisions (owner, 2026-11-09)

- Truck is full, Truck broke down and Not enough time left end the whole run. Can't reach the site, Crew unavailable and Other skip only the current stop. Truck is full is offered only after at least one stop is cleaned, never on Decline.
- Stops not cleaned go back to Check next. Cleaned stops and records stay. The queue row says "Returned by Crew B: reason".
- The crew picker does not pre-select a crew that sent the same stop back in the last 24 hours. The manager can still pick that crew.
- Manager sees it in the Activity log, on the crew card ("Ended early: ..."), and in Records ("Sent back to the queue").
- Shared room stays last write wins. The crew re-reads the state before writing; a run the manager withdrew shows "Run was withdrawn by the manager".
- Log toggles are separate from the map toggles. Log entries without a crew always show. Shared component `CrewToggles`.
- No statistics screen; reasons are stored as a fixed enum so they can be counted later.

## Acceptance criteria

- [x] Pure functions `declineRun`, `endRunEarly`, `skipStop`, `reasonsFor`, `recentReturners` in `planner/src/runActions.ts` with vitest tests.
- [x] `isBusy` and `openStopIds` treat skipped stops as handled.
- [x] Old saved state without the new fields loads (fields are optional).
- [x] Dialogs checked at 375px; Esc closes; focus starts on "Keep going" / "Keep the run".
- [ ] Smoke run on the PR.
