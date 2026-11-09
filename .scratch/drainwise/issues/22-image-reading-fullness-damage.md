# 22: Image reading: fullness band, damage type, location, annotated image

Type: task
Status: ready-for-agent
Blocked by: 21 (needs images and reference); soft link to 13, 17, 18
Spec: `.scratch/drainwise/map.md` ("Image recognition" decision)

## What to build

For a camera GPT: compare today's image with a clean reference image of the same camera. Output: **fullness band** (10% steps), **damage** (`none`, `net_full`, `net_broken`, `net_fallen`), the **changed region**, and an **annotated image** (circle on the region, arrow, numbered caption). Reference diff comes first; the hosted vision model (server only, as in ticket 13) is a helper for unclear cases and sites without a reference. A human confirms before anything becomes a label.

## Decisions

- Changed area fraction is a fullness proxy, not a measurement. Say so in the UI.
- Broken or fallen net shows as a mismatch against the reference.
- A prediction in the right 10% band counts as correct (for the pipeline check only). "Needs cleaning" = band 70-79 or higher.
- Bands are separate from High / Medium / Low risk. No accuracy claim.
- Output shape stays compatible with `parseSuggestion` where possible; extend it with band, damage, region.

## Acceptance criteria

- [ ] Pure function (TS in `planner/` or Python in `ml/`, owner's call at start) `readImage(reference, today)` returning band, damage, region, confidence, rationale. Unit tests on the synthetic set from ticket 21 (true band within one band is reported as a pipeline check, not accuracy).
- [ ] Annotated image: circle, arrow and numbered caption drawn from the region.
- [ ] Camera popup (ticket 17) shows band, damage, annotated image, "Synthetic image" and "Prototype, no accuracy claim".
- [ ] Hosted vision call is server only; absent on the public build; human confirm step kept.
- [ ] Faces / number-plate gate still applies before any training use.
- [ ] Browser check at desktop and 375px.
