# 20: Risk target = net reaches the 70% band within 1 / 7 days

Type: task
Status: wontfix (owner, 2026-11-09: the dashboard Forecast day slider already scores Today to In 6 days, see `planner/src/horizon.ts`; relabelling `p_block` is not needed now)
Blocked by: None
Spec: `.scratch/drainwise/map.md` ("Council session 9 Nov 2026"); `CLAUDE.md` section 8

## What to build

Change what `p_block` means. Today it is a made-up "blocks within N days". New meaning: **probability that the GPT net reaches the 70% full band within the horizon** (1 day or 7 days; 7 days is the default, 1 day is for after a storm). The API contract shape does not change; only the documented meaning does.

## Decisions (owner, 2026-11-09)

- "Needs cleaning" line is 70% full. Fullness bands (10% steps) belong to image reading (ticket 22) only. High / Medium / Low cut-offs (60% / 30%) stay as they are. Keep the two apart in copy.
- Everything is still trained on SAMPLE DATA from `ml/simulate.py`.

## Acceptance criteria

- [ ] `ml/simulate.py` simulates a fullness fraction per GPT over time and labels "reached 70% within 1 / 7 days". Fixed seed; data source and version logged in each run.
- [ ] A horizon parameter (1 or 7) is supported in training and in `POST /predict` (optional field, default 7; existing callers unchanged).
- [ ] Model retrained; `python -m risk_api.export_scores` and `python -m risk_api.export_model` re-run; `riskModel.test.ts` parity test passes.
- [ ] `ml/README.md`, `CLAUDE.md` section 8 and UI copy describe `p_block` as "chance the net is 70% full within 7 days (sample data)".
- [ ] Monotonic constraints kept; `python -m ml.evaluate` still runs and is labelled a pipeline check.
- [ ] `cd planner && npm test` and `.venv/bin/pytest -q` pass.

## Not in scope

- Changing the High / Medium / Low cut-offs.
- Claiming accuracy.
