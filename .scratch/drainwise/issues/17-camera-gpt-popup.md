# 17: Camera GPT popup with a sample photo and an image-model result

Type: task
Status: done (PR pending; levels are a mock placeholder, owner choice)
Blocked by: None (can start immediately). Better with 18, but does not need it.
Spec: `.scratch/drainwise/spec.md` (tickets 04, 13 and 16)

## What to build

On the map, a GPT that has a camera (dashed ring) can be clicked. A `Dialog` opens with a camera still and what the image model says about it: a blockage level 0-3 with its name (for example "Level 2 · Half blocked"), a confidence, and a one-line reason. This shows the idea "sites with a camera need no crew photos; the camera photo is read by the image model".

There is no real camera feed. The still is one of the 7 sample photos, assigned to each camera GPT in a fixed way (for example by GPT number), and labelled "Sample photo, not a live camera".

## Decisions already made (owner and Claude, 2026-11-08)

- Use the existing sample photos to simulate camera images.
- The result is **precomputed** and stored as a small JSON file (for example `web/lib/cameraReadings.json`, stamped with data source, time and how each level was made). The public build must not call any model.
- Show a level and its name, **not a percentage**. The model outputs 4 levels; a percentage would be invented precision.
- The level comes from the human-confirmed label if there is one (from `/review`), otherwise from the local vision model suggestion, and the JSON says which. Never show a suggestion as if it were a confirmed label.
- Photos are not committed to git. The 7 council photos stay in `.local/sample-photos/`. For the public build, the dialog uses a small downsized copy only if the owner confirms the council photos may be shown publicly; otherwise the public build shows the level and reason without the image. **Ask the owner before copying any photo into `web/public`.**

## Acceptance criteria

- [ ] Clicking or pressing Enter on a camera GPT (map and queue) opens the dialog. Non-camera GPTs do not open it.
- [ ] Dialog follows the UI consistency list: only `Dialog` from `web/app/Dialog.tsx`, eyebrow, h2 title, body, primary action, quiet Cancel, Esc closes, fixed and centred.
- [ ] The dialog shows: GPT id, the sample photo (or the no-image fallback), level with name and a face or label (not colour alone), confidence, reason, and the lines "Sample photo, not a live camera" and "Prototype, no accuracy claim".
- [ ] Each camera GPT maps to a sample photo in a fixed, documented way; the same GPT always shows the same photo.
- [ ] Readings come from a precomputed JSON; a planner test checks that every camera GPT in the seed has a reading and every level is 0-3.
- [ ] No model call is made when the dialog opens, on any build.
- [ ] Checked in the browser at desktop and 375px; every dialog opened; keyboard focus; no console errors.
- [ ] Smoke test with evidence in the PR.

## Not in scope

- A real camera feed, or reading cameras on a schedule.
- Feeding the level into the risk model (that is a later step, see 18).
- Face and number-plate check (still a gate before any training use; not built).
