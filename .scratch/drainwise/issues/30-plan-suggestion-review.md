# 30: Run suggestion review: admin removes GPTs with a reason, then confirms to the crew

Type: task
Status: ready-for-agent
Blocked by: 23 (email) for the link step; the in-app part can start now
Spec: `.scratch/drainwise/map.md` ("AI OS scope update 2026-11-11"); `design/AI_OS_DESIGN.md` section 6

## What to build

The planner output is a **suggestion**. An admin opens it in the app, can **remove GPTs (and optionally add)** and must give a **reason** for each removal (short text or a few preset reasons plus free text). Then **Confirm and send to crew** (the existing crew chooser flow; the second email to the crew is part of 23).

- Store each suggestion and the final plan as a plan record: proposed list, final list, per-change reason, context (forecast day, capacity), time, source (`email link` or `manual`). New Supabase table (migration, RLS on, server key only).
- Manual trigger stays: the admin can open or generate a suggestion without any email.
- Edits are shown back to the admin as "what DrainWise will remember" with the reason; nothing is applied silently. Learning from these edits (reflection, rules) is ticket 32; this ticket only records the evidence.
- Activity log: "Admin removed GPT-014 from the suggestion: reason".

## Acceptance criteria

- [ ] Removing a GPT requires a reason; cannot confirm with an empty reason.
- [ ] Proposed and final plans and reasons are saved and visible in a simple history list.
- [ ] Confirm hands the final plan to the existing crew send flow (capacity rule still holds).
- [ ] Access is by team code in the link; copy states that production would use real sign-in.
- [ ] Browser check at desktop and 375px; smoke test in the PR.
