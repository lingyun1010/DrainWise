# Map: DrainWise build spec

Label: wayfinder:map

## Destination

A **decision-locked build spec** for the DrainWise hackathon MVP: stack, scope, risk model, planner, photo pipeline, demo script and pitch narrative are all decided, so work can be split straight into implementation sessions. This map writes no application code.

## Notes

- Project brief: `CLAUDE.md` (repo root). `reference/demo-Main.dc.html` is a UI/behaviour reference only.
- Hard deadline: final submission 18 Nov 2026 (window 18-20 Nov). Today is 8 Nov. This map should finish in 2-3 days so 7+ days remain to build and polish.
- Council experts online Mon 9 Nov and Fri 13 Nov. Tickets that feed the 9 Nov session go first.
- Standing decisions (settled, no ticket):
  - Rebuild in the real stack (Next.js + TS + Tailwind, Supabase, FastAPI); the demo is reference only.
  - MVP default is **depth**: ranked queue + explainable risk model + truck planner + crew photo flow are must-have; 3D view and Supabase Auth are stretch. Revisit if experts say judges prefer breadth.
  - Risk model: scikit-learn gradient boosting trained on **simulated** data, labelled "trained on simulated data" everywhere; keep the demo formula as a baseline for comparison.
  - Planner runs in TypeScript inside the Next.js app (recalculates live with the capacity slider); seam `plan_run(assets, capacity)`. The algorithm behind it is still open: ticket 03.
  - Name: **DrainWise** (the demo still says "FloodReady", to be renamed).
  - Assumption to verify with experts: "GPT" = Gross Pollutant Trap.
- AI/ML component spec (layout `ml/`, `risk-api/`, `web/`; `/predict` API contract; simulated-data rules; server-side hosted vision model for photo level 0-3 with human confirmation; only 7 unlabelled sample images exist) lives in `CLAUDE.md` section 8. Treat it as settled input; do not restate it here.
- Honesty rules: label all simulated data "sample data"; never present the demo formula as an AI model; do not fabricate council facts.
- Tracker: local markdown (`.scratch/drainwise/`). Blocking via `Blocked by:` lines; frontier = open, unblocked, unclaimed.
- Reply to the owner in Chinese with English technical terms; code, UI copy and docs in English.

## Decisions so far

<!-- one line per resolved ticket: [title](link): gist -->

- [Prepare for the 9 Nov council expert session](issues/01-expert-meeting-prep.md): ask all 7 questions on 9 Nov in build-blocking order, fall back to smallest usable data, no demo shown; sheet in [01-expert-questions.md](01-expert-questions.md).

- [Asset data approach](issues/02-asset-data-approach.md): council sample if given, else fictional points in real Parramatta; 36 assets, parameterised; all features simulated in MVP; persistent SAMPLE DATA labelling.
- [Photo pipeline and privacy](issues/04-photo-pipeline-privacy.md): photos in memory only; metadata-only Job record; minimal human-review page for 7 sample images; face/plate check is a gate before training (not built); honest "designed to become training data" claim.

- [Pitch and demo script](issues/05-pitch-and-demo-script.md): Action story (which drains to clean, plan the truck run, photo proof); 3-min path queue > run > crew > records; honesty line said at the start of the demo; challenge 5 primary, 1 secondary; live core with a recorded fallback.
- [Schema and data model](issues/06-schema-and-data-model.md): no database in the MVP; schema is a design doc (`docs/schema.md`); PostGIS point; `source` column marks sample vs council vs crew; `risk_scores` read path handed to 07.
- [Hosting and deploy](issues/07-hosting-and-deploy.md): live demo local, Vercel public link; public build reads baked precomputed scores JSON, local build calls risk-api and falls back to the JSON with a banner; vision key only in env vars and off on the public build.
- [Risk model evaluation on simulated data](issues/08-risk-model-evaluation.md): simulator rules ~ demo formula, so metrics are only a pipeline recovery check (`ml/evaluate.py`, not shown to judges); real result = beats formula and days-since-clean baselines on a time-split recent period.

## Open tickets

None. Stage 2 gate passed 2026-11-08; remaining unknowns wait for the 9 and 13 Nov expert answers (see 01-expert-questions.md).

## Not yet specified

- Presentation layer stretch items: 3D view (built), Supabase Auth.

## Out of scope

- Roads, sandbags, resident notices, SES: ruled out by the scope decision (drains and GPTs only).
- Real-time flood warning: already covered by FloodSmart/FLASH (BoM forecast + 3Di); we do not compete with it.

## Progress 2026-11-08

- Seam C `planner/src/planRun.ts` (TS + vitest, `cd planner && npm test`): 3 tests pass (capacity, risk-first, photosNeeded). Greedy by risk only; nearest-neighbour ordering / route still open under ticket 03. Load formula is the made-up demo placeholder.
- CLAUDE.md train command fixed to `python -m ml.train`.
- Seam D `planner/src/canComplete.ts`: 4 tests pass (camera direct; before+after required otherwise; reports which photo is missing). Ticket 03 resolved: knapsack + nearest-neighbour (see issues/03). Next: implement it in planRun, then 9 Nov expert answers.
- 2026-11-08: planRun now = knapsack (exact DP, loads rounded up to 0.001 m3) + nearest-neighbour from depot (default 0,0; ties to higher risk). 5 planRun tests, 9 TS tests total, all pass. Risk-first and capacity tests kept. Not covered: >200 assets performance, real road distances, multi-truck.
- 2026-11-08: `web/` Next.js 16 (App Router, Tailwind) manager screen: 36 sample assets (`web/lib/seed.ts`), `/api/risk` proxy to risk-api, ranked queue with reasons (face + label), capacity/leaf/rain sliders, planRun imported from `../planner`. Verified in browser incl. risk-api-down error state. Run: `uvicorn risk_api.main:app` (root) + `cd web && npm run dev`. Known: knapsack fills capacity with very low-risk stops when capacity is large (fixed 2026-11-08 via planRun minRisk param, web uses 0.3); schematic SVG map added (web/app/MapView.tsx, abstract 0-100 coords, no basemap, no 2D/3D toggle); crew view not built.
- 2026-11-08: Crew phone view `web/app/crew/page.tsx` + `web/lib/runStore.ts`. Manager "Send run to crew" saves run to localStorage; crew: accept, Stop n of m, load bar, camera site = Mark as cleaned, else BEFORE photo, cleared, AFTER photo, Submit (uses canComplete), next stops, run complete. Tested in browser at 375px with simulated file inputs (all 7 stops). Photos are in memory only, not stored. Not built: compliance records panel, real camera capture test on a phone, GPS/timestamp/crew id on photos, role entry screen, activity log.
- 2026-11-08: Compliance records panel on `/` (metadata only: stop, run id, crew, clock, before/after flags; no images stored). Crew submit writes JobRecord into runStore.
- 2026-11-08: UI restyled to match `reference/demo-Main.dc.html` (dark navy, Fredoka/Nunito, role screen, header tiles, drop-shaped map in 800x500 units using the demo's seed generator, sidebar cards, activity log, asset modal, Crew phone frame in `web/app/CrewApp.tsx` shared by `/crew` and side-by-side). `lib/seed.ts` now exports DEPOT {70,445} and demo-style names (DR-001, GPT-01). Cleaned assets are sent to the model with days_since_clean=0. Verified in browser: desktop side-by-side, 375px /crew. NOT built: 3D water view (button disabled), crew travel animation, Crew B/C runs (only Crew A wired), multi-run. Next: 3D view (Three.js, reference lines ~492-589 of the demo script).
