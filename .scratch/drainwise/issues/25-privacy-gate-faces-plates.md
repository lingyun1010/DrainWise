# 25: Face and number-plate gate for photos

Type: task
Status: deferred (roadmap)
Blocked by: None
Spec: `CLAUDE.md` section 8; tickets 04 and 16

> Update 2026-11-11 (owner): only needed before any training; nothing is trained now. Say in the pitch that it is a required gate before training.

## What to build

`privacy_checked` exists as a flag (ticket 16, always false) but nothing sets it. Build a small **local-only** gate that scans an image for faces and number plates and reports `clear`, `found` (with boxes) or `unsure`, so a photo can be blurred or excluded before any training use. Owner says the 7 sample photos are public and OK for training; the gate still protects crew uploads and any future council photos (sample-6 has cars on a road, sample-2 has an already blurred shape).

## Decisions

- Prefer a light, offline detector (for example OpenCV Haar / DNN face detector in `ml/`, run on the CPU); a plate detector is optional and may be a conservative "vehicle-like region" rule. Check licence and install size before adding a dependency; if too heavy, keep it in an optional requirements file.
- Gate output never auto-clears a photo: `unsure` and `found` need a person. A "Blur regions" helper writes a blurred copy; the original is never overwritten.
- Local `/review` shows the gate result per photo and a "Mark privacy checked" button (human confirms). Public build: nothing changes.
- No claim of detection accuracy.

## Acceptance criteria

- [ ] `python -m ml.privacy_gate <folder>` prints a result per image and writes a small JSON report; deterministic.
- [ ] Blur helper writes a copy with boxes blurred; originals untouched.
- [ ] pytest on stand-in images (a drawn face-like test image is not enough: also test the empty and error cases); no council photos needed.
- [ ] `/review` (local) shows the result and the confirm button; `privacy_checked` only becomes true after the human confirms. UI follows the UI consistency list.
- [ ] README says what it does not catch and that it is not an accuracy claim.
