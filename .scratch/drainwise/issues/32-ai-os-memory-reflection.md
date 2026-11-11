# 32: AI OS: memory, reflection and approved preference rules

Type: task
Status: done (PR pending)
Blocked by: 30 (plan edits and reasons are the input), 31 (shares the Claude key, rate limits and chat context)
Spec: `design/AI_OS_DESIGN.md` sections 3, 5, 6, 8, 10; `.scratch/drainwise/map.md` ("AI OS scope update 2026-11-11")

## Decisions (owner, 2026-11-11)

- Scope = **minimal closed loop**: record -> reflect -> admin approves -> used by planner and chatbot. No backtest, no model versioning (stretch).
- Demo data = a **simulated scheduler persona** with hidden preferences that edits proposed plans. Every place it shows says "Simulation, not a real council officer".
- Honesty: the Claude model's weights never change. What learns is the rules table (memory). Say "learns from feedback via memory and approved rules", never "the AI evolves itself".

## What to build

1. **Tables** (Supabase migration, RLS on, server key only): `plan_edits` (from 30), `lessons` (statement, supporting edit ids, count, status `proposed|approved|rejected`), `preferences` (rule, effect, evidence ids, status, enabled, version). Keep the schema small.
2. **Simulator** `ml/` or `planner/`: persona with 2 hidden preferences (for example "after heavy rain, drop GPTs far from the depot" and "creek-side GPTs first"), fixed seed, generates N simulated weeks of proposed and final plans and edits with short reasons. Button "Run simulated weeks" in an admin area, labelled simulation.
3. **Reflection** `POST /api/reflect`: sends recent edits, reasons and context (forecast, capacity) to Claude (same key, limits and kill switch as 31); asks for lessons as structured JSON with the supporting edit ids. A lesson needs at least k supporting edits (k = 3, constant, assumption). Output is stored as `proposed`; nothing is applied.
4. **Review UI**: list proposed rules with their evidence (the edits behind each). Approve, edit text, or reject; switch any rule on or off; version number shown. Use `Dialog` and `ConfirmDialog` patterns.
5. **Use**: approved and enabled rules become soft weights in `planRun` inputs (a pure, tested function; the run plan shows "Adjusted by rule: ..." per stop so it stays explainable), and are passed as context to the chatbot, which names the rule it used.
6. **Evaluation view (small)**: per simulated week, plan acceptance rate and edits per plan. Success = rules recover the persona's hidden preferences and edits per plan fall. Labelled simulation.

## Acceptance criteria

- [ ] Planner tests: no rules gives the old plan exactly; a rule changes order or exclusion as described; capacity is never exceeded.
- [ ] Reflection output is schema-validated; a lesson with fewer than k supporting edits is dropped; a rejected rule never reaches the planner.
- [ ] Nothing applies without approval; every applied rule is listed with its evidence.
- [ ] Simulated results are labelled everywhere; copy follows the honesty rules.
- [ ] Without a key or with the kill switch on, reflection shows a plain message and the rest of the app still works.
- [ ] Browser check at desktop and 375px; smoke test in the PR.
