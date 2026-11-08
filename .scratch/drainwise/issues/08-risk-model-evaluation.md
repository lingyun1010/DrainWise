# 08 Risk model evaluation on simulated data

Type: grilling
Status: resolved (2026-11-08)
Blocked by: none

## Question

How do we evaluate the risk model honestly when the labels are simulated? Decide: which metrics are meaningful at all (the model can only recover the simulator's own rules), how we compare against the demo formula baseline, what we show judges (feature contributions and reasons rather than accuracy), the exact wording that results are on simulated data, and the plan to retrain on real records and what would count as a real result.

## Decision (2026-11-08)

- **Fact that frames this**: `ml/simulate.py` generates labels from almost the same rules as the demo formula (same weights, plus a GPT x1.1 and a logistic). The model can only recover those rules, so metrics on simulated data say nothing about real drains. `ml/train.py` currently has no held-out evaluation.
- **Purpose**: a pipeline recovery check, not accuracy. Add `ml/evaluate.py`: held-out data from a different seed, AUC and Brier score, comparison with the demo formula baseline, and a check that the monotonic constraints hold. Document "model ~ formula is expected, because the simulator uses the same rules". Results live in `ml/README` or `docs/` only, never in the UI or the pitch.
- **Shown to judges**: reasons (feature contributions), no accuracy numbers (see 05). Wording: "sample data", "trained on simulated history" (05, 06).
- **Real records (after 9 and 13 Nov)**: swap the training data only; the `/predict` contract is unchanged. Evaluate with a time split (train on earlier records, test on the most recent period), never a random split. A real result means beating both baselines (the demo formula and a days-since-clean-only rule) on the held-out recent period. The minimum number of real blocked events in the test set is decided once the council tells us the history size; no number is invented now. With too few events, report "too few events to evaluate" and no AUC. Until then every output keeps the "trained on simulated data" label.
- **Build work for Stage 4**: `ml/evaluate.py` and its test; README note.
