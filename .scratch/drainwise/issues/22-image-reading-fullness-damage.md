# 22: Image reading: fullness band, damage type, location, annotated image

Type: task
Status: done (merged, PR #43)
Blocked by: 21 (needs images and reference); soft link to 13, 17, 18
Spec: `.scratch/drainwise/map.md` ("Image recognition" decision)

## What to build

For a camera GPT: compare today's image with a clean reference image of the same camera. Output: **fullness band** (10% steps), **damage** (`none`, `net_full`, `net_broken`, `net_fallen`), the **changed region**, and an **annotated image** (circle on the region, arrow, numbered caption). Reference diff comes first; the hosted vision model (server only, as in ticket 13) is a helper for unclear cases and sites without a reference. A human confirms before anything becomes a label.

## Decisions

- **Updated 2026-11-11 (owner): no AI model is called for photos, locally or on the public build.** Remove the hosted-vision criterion. Camera sites use the deterministic reference diff (not an AI model); crew photos and unclear cases get a MOCK reading and the admin marks the problem by hand (ticket 29). Annotation of the changed region by the reference diff is welcome where it works; the admin can delete and redraw it.

- Changed area fraction is a fullness proxy, not a measurement. Say so in the UI.
- Broken or fallen net shows as a mismatch against the reference.
- A prediction in the right 10% band counts as correct (for the pipeline check only). "Needs cleaning" = band 70-79 or higher.
- Bands are separate from High / Medium / Low risk. No accuracy claim.
- Output shape stays compatible with `parseSuggestion` where possible; extend it with band, damage, region.

## Acceptance criteria

- [x] Pure function (TS in `planner/` or Python in `ml/`, owner's call at start) `readImage(reference, today)` returning band, damage, region, confidence, rationale. Unit tests on the synthetic set from ticket 21 (true band within one band is reported as a pipeline check, not accuracy).
- [x] Annotated image: circle, arrow and numbered caption drawn from the region.
- [x] Camera popup (ticket 17) shows band, damage, annotated image, "Synthetic image" and "Prototype, no accuracy claim".
- [x] No hosted vision call anywhere (owner decision 2026-11-11); human confirm step kept (ticket 29).
- [x] Faces / number-plate gate still applies before any training use.
- [x] Browser check at desktop and 375px.

## Built (2026-11-09)

- TS in `planner/`: `readImage(reference, today, netPolygon)` (`planner/src/readImage.ts`), `annotate` (`annotateReading.ts`), net polygons per camera (`cameraNets.ts`, drift test against `ml/synth_images.py`). Changed pixels inside the net after removing the global light change, mapped to 10% bands; a lot of change outside the net = `net_fallen`; a compact dark patch inside = `net_broken`.
- `cd planner && node --experimental-strip-types scripts/checkSynthetic.ts <dir> [--write ../web/lib/imageReadings.json]` is the local pipeline check on the 420 non-reference synthetic images. Last run (seed 42, synthetic-images-2): damage type matched 389/420, band within one band 332/350, same side of the 70% line 330/350. Pipeline check on synthetic data only, NOT accuracy. Weak spot: small holes in dark nets are read as `none`.
- Popup (`web/app/CameraView.tsx`) shows the stored reading for the camera (`web/lib/imageReadings.json`, one example image per camera, SVG circle, arrow and caption over the image). The synthetic image is served only locally (`/api/camera/<id>/synthetic`, files in `.local/`, `SYNTHETIC_IMAGES_DIR` overrides the folder); the public build shows the reading as text only.
- Hosted vision helper: no new call added. `needs a person` is flagged by `unclear`; ticket 13's server-only route and human confirm are unchanged. Fields band, damage and region are not yet in `parseSuggestion`.
