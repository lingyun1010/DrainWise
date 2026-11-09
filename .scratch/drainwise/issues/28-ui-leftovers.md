# 28: UI leftovers from the 8-9 Nov smoke notes

Type: task
Status: ready-for-agent
Blocked by: 23, 24 (all three touch `web/app/page.tsx`; start after they merge)
Spec: `.scratch/drainwise/map.md` ("Still open UI notes", "Known gaps")

## What to build

Fix the small known gaps, each with a test or a browser check:

- "Reset sample session" opens a `ConfirmDialog` with `tone="danger"`.
- Check next "Send crew" keeps its label when disabled: show why (for example "Crew busy").
- Simulated shift clock wraps every 72 s so log times look out of order: keep times increasing.
- No loading state after a slider change: show a quiet "Scoring..." state.
- Manager page at 375px: columns break; make it usable (single column).

## Acceptance criteria

- [ ] Each item above fixed or explicitly deferred in the PR with a reason.
- [ ] UI consistency list followed; checked at desktop and 375px.
- [ ] tsc, eslint, prettier, tests pass; smoke run.
