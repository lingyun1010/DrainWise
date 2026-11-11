# 24: Copy and scope pass: GPT only, contractor wording, How it works

Type: task
Status: done (merged, PR #38)
Blocked by: None (best after 20, so the score wording is final)
Spec: `.scratch/drainwise/map.md` (owner decisions after 9 Nov)

## What to build

Make the product match the 9 Nov decisions.

## Acceptance criteria

- [x] UI and docs say GPT (net) only; no drain inlet wording left in the UI. `CLAUDE.md` sections 1 and 6 scope line updated.
- [x] "Crew" stays in the phone flow, but copy says the run is a suggestion for the contractor, who picks the day and people.
- [x] Truck capacity default 3 m3, labelled "assumption". No dollar figures anywhere.
- [x] A "How it works" page or dialog: what the score means (70% full within 7 days, sample data), what the planner does step by step, what is simulated.
- [x] `has_camera` in `web/lib/seed.ts` is exactly 7 of the 36 GPTs (owner decision 2026-11-09; seed currently uses `rnd() < 0.3`), camera k = sample photo k = `cam-0k` of ticket 21. Update the ticket 17 photo mapping and `ml/sample_assets.json` (planner drift test), re-run `export_scores`.
- [x] Copy follows the UI consistency list: English, short, no emoji, "sample data".
- [x] tsc, eslint, prettier; checked at desktop and 375px.

## Done (2026-11-09)

- Seed: `CAMERA_INDEX` in `web/lib/seed.ts` marks GPT-003, 008, 013, 019, 024, 029, 034 (spread across the 36; a sample choice). Camera k (in GPT order) shows sample photo k, which is `cam-0k` in ticket 21. Planner test checks exactly 7 and the mapping.
- "How it works" is a dialog (`web/app/HowItWorks.tsx`) opened from the Truck run planner. The score is the existing High (60%+) / Medium (30%+) / Low risk; the 70% fullness line is not used in the score, so the "70% full within 7 days" wording from the ticket was not used (ticket 20 was dropped).
- Tagline in the UI is now "Clean the right gross pollutant traps before they fill." The product name DrainWise is unchanged.
- Model and planner contracts still accept `inlet`; only the UI and docs scope changed.
