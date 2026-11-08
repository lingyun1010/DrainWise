# 11: Model evaluation script

Type: task
Status: ready-for-agent
Blocked by: None (can start immediately)
Spec: `.scratch/drainwise/spec.md` (ticket 08)

## What to build

An evaluation command for the risk model. It generates held-out sample data from a different seed and reports AUC, Brier score, a comparison with the demo formula baseline, and whether the monotonic rules hold (more canopy, leaf fall, rain, or days since clean never lowers risk). Results are documented as a pipeline recovery check, never as accuracy, and never shown in the UI or the pitch.

## Acceptance criteria

- [ ] One command prints the metrics and the monotonic check for the saved model; fixed seeds make it reproducible.
- [ ] A pytest runs it with a fixed seed and checks the metrics are present and in a sane range, and that a deliberately broken monotonic rule is reported.
- [ ] The model README states: results are on simulated data, "model close to formula is expected because the simulator uses the same rules", and not an accuracy claim.
- [ ] README also records the plan for real records: swap training data only, time-split evaluation, beat both the demo formula and a days-since-clean-only rule.
- [ ] Nothing from this ticket appears in the web UI.
