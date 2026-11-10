# Risk model (ml/)

Predicts the probability that a GPT (net) blocks soon. scikit-learn `HistGradientBoostingClassifier` with monotonic constraints (more canopy, leaf fall, rain or days since clean never lowers risk).

## Commands

```bash
python -m ml.simulate   # sample data generator (used by train)
python -m ml.train      # writes ml/model.joblib
python -m ml.evaluate   # pipeline recovery check (held-out seed 12345)
```

## What the evaluation means (read this first)

- All results are on **simulated sample data**. No observed council records exist yet.
- This is a **pipeline recovery check, not an accuracy claim.** Model AUC is about 0.84, essentially the same as the demo formula (about 0.84). **A model close to the formula is expected because the simulator uses the same rules.** It only shows training, saving and loading work and the monotonic rules hold.
- The numbers are not shown in the web UI or the pitch.
- Reported: AUC, Brier score, demo-formula AUC as baseline, and monotonic violations per feature (0 = rule holds).

## Plan for real records

1. Swap the training data only; keep the `/predict` contract unchanged.
2. Evaluate with a **time split** (train on earlier months, test on later), not a random split.
3. Only claim value if the model beats both the demo formula and a days-since-clean-only rule on the held-out period.

## Synthetic images (ticket 21)

`python -m ml.synth_images` edits the 7 council sample photos (`.local/sample-photos/`, from `python scripts/extract_sample_photos.py`). Each photo is one camera (cam-01 to cam-07). Per camera it writes 61 images to the gitignored `.local/synthetic-images/`: 1 clean reference, 10 fullness bands (0-9% to 90-100%) x 5, `net_broken` x 5, `net_fallen` x 5 (427 in all), plus `metadata.json` with the true band, damage and region of every image. The net position in each photo is a hand-marked polygon in `ml/synth_images.py`; debris is cut from the photo's own leaf litter. Every image carries a "SYNTHETIC EDIT" label and the file names say `synthetic`.

Limits: the photos are not clean (sample-5 already shows a fallen net, kept as is; sample-7 is a bar screen, treated like a net; the nets in sample-1 and sample-2 are small and half hidden), so the "clean reference" is the photo with a clean mesh drawn on the marked area. The edits are rough and say nothing about accuracy on real photos. The owner says the 7 sample photos are publicly published and may be used for model training (stated 2026-11-09, no licence text checked). Faces and number plates are still not checked (sample-6 has cars on a road); the project rule is to check before training. Needs Pillow (`requirements.txt`).
