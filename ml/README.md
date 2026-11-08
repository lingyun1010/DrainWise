# Risk model (ml/)

Predicts the probability that a drain inlet / GPT blocks soon. scikit-learn `HistGradientBoostingClassifier` with monotonic constraints (more canopy, leaf fall, rain or days since clean never lowers risk).

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
