# 21: Synthetic GPT net image generator

Type: task
Status: done (PR pending)
Blocked by: None (first check the 7 sample photos as a base)
Spec: `.scratch/drainwise/map.md`; relates to tickets 13, 17, 18

## What to build

A script `python -m ml.synth_images` that writes synthetic camera-style images of a GPT net: a clean reference, 10 fullness bands (0-9% ... 90-100%), net broken, net fallen off. Experts accepted synthetic data. Real camera images may not arrive in time.

## Decisions

- Every output file and every UI use says "synthetic". Filenames carry `synthetic`; a metadata JSON records seed, band, damage type, generator version.
- Start by looking at the 7 sample photos in `.local/sample-photos/` for a usable base (same camera angle). If none is usable, draw the scene procedurally (Pillow). Do not commit council photos.
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
