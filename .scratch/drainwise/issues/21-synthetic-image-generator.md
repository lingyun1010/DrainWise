# 21: Synthetic GPT net image generator

Type: task
Status: done (PR pending)
Blocked by: None (first check the 7 sample photos as a base)
Spec: `.scratch/drainwise/map.md`; relates to tickets 13, 17, 18

## What to build

A script `python -m ml.synth_images` that edits the 7 council sample photos (one per camera, cam-01 to cam-07; owner decision 2026-11-09, the first drawn-scene version looked fake). Per camera: 1 clean reference, 10 fullness bands x 5, net broken x 5, net fallen x 5 (61 per camera, 427 in all). Experts accepted synthetic data. Real camera images may not arrive in time.

## Decisions

- Every output file and every UI use says "synthetic". Filenames carry `synthetic`; a metadata JSON records seed, band, damage type, generator version.
- Real photos only (the 7 in `.local/sample-photos/`); the net area in each is a hand-marked polygon. Do not commit council photos or outputs.
- Output goes to a gitignored folder; only a few small examples (if any) may be committed, after the owner agrees.

## Acceptance criteria

- [x] Fixed seed; same seed gives the same images.
- [x] One clean reference per synthetic camera; per band at least N images with varied lighting and debris position (N set in the script, default 5).
- [x] Damage types: `net_broken`, `net_fallen`, each with a known location in the metadata (used later to check the annotation in ticket 22).
- [x] Metadata JSON has the true band, damage type and region for every image.
- [x] pytest: determinism, metadata complete, bands cover 0-9 to 90-100.
- [x] README note: synthetic, not real camera data, no accuracy claim.

## Not in scope

- Photorealism. Training the image model (ticket 18).
