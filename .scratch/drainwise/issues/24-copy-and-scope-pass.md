# 24: Copy and scope pass: GPT only, contractor wording, How it works

Type: task
Status: ready-for-agent
Blocked by: None (best after 20, so the score wording is final)
Spec: `.scratch/drainwise/map.md` (owner decisions after 9 Nov)

## What to build

Make the product match the 9 Nov decisions.

## Acceptance criteria

- [ ] UI and docs say GPT (net) only; no drain inlet wording left in the UI. `CLAUDE.md` sections 1 and 6 scope line updated.
- [ ] "Crew" stays in the phone flow, but copy says the run is a suggestion for the contractor, who picks the day and people.
- [ ] Truck capacity default 3 m3, labelled "assumption". No dollar figures anywhere.
- [ ] A "How it works" page or dialog: what the score means (70% full within 7 days, sample data), what the planner does step by step, what is simulated.
- [ ] Count `has_camera` in `web/lib/seed.ts` (experts said 8 to 10 cameras; seed currently uses `rnd() < 0.3`) and set it to a fixed, documented number if it differs.
- [ ] Copy follows the UI consistency list: English, short, no emoji, "sample data".
- [ ] tsc, eslint, prettier; checked at desktop and 375px.
