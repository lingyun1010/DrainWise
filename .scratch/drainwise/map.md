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
- 2026-11-08: UI restyled to match `reference/demo-Main.dc.html` (dark navy, Fredoka/Nunito, role screen, header tiles, drop-shaped map in 800x500 units using the demo's seed generator, sidebar cards, activity log, asset modal, Crew phone frame in `web/app/CrewApp.tsx` shared by `/crew` and side-by-side). `lib/seed.ts` now exports DEPOT {70,445} and demo-style names (DR-001, GPT-01). Cleaned assets are sent to the model with days_since_clean=0. Verified in browser: desktop side-by-side, 375px /crew. NOT built then: 3D water view, crew travel animation, Crew B/C runs (built later in #12). Next: 3D view (Three.js, reference lines ~492-589 of the demo script).
- 2026-11-08: 3D water view built (`web/app/Map3D.tsx`, three.js, procedural SAMPLE terrain, not a flood forecast); Design review gate (design-reviewer + Impeccable detector) merged (#8).
- 2026-11-08 (#9): Manager app shell. CSS grid (2 columns Manager, 3 columns Side-by-side from 1200px, stacked below 900px), sticky map, right column is a tablist (Check next / Run plan / Records / Crews) with Arrow/Home/End keys, What-if and rain forecast in a collapsed details. Manager page 2774 px -> 900 px tall at 1280x800. Review gate rules changed: smoke-tester runs only when a feature is added or its behaviour changes; ui/ux/design reviewers always ask the owner first (`docs/review-gates.md`, agent descriptions, pre-PR hook, global `lingyun-project` skill).
- 2026-11-08 (#10): UI leftovers. Send buttons disabled while Crew A is on a run; Run plan explains top-risk assets left out ("Not in this run"); accessible names on Send crew buttons; toast is a persistent live region; skip link past the map markers; simulation controls at the bottom of the right column; Records says "latest 3 of N". Smoke passed (full flow, 4-stop run).
- 2026-11-08 (#12): Manager dashboard and crews. Manager shows every panel at once (no tabs; Side-by-side keeps tabs). One run per crew (`SavedState` in `web/lib/runStore.ts`, key `drainwise.state`); "Who should go?" dialog lists crews A to Z, busy ones disabled; crews can be renamed, added (max 6), removed; Withdraw (Crews row) takes a run back, Remove and Withdraw use a confirm dialog. Crew colours (`HATS`) as ring, letter badge and dashed route on the 2D map, dots in log and pickers, legend toggles per crew. Camera icon replaces the dashed ring; legend shows risk cut-offs High (60%+), Medium (30 to 59%), Low (under 30%). All assets are GPTs (GPT-001...), still 36 (`ASSET_COUNT` in `web/lib/seed.ts`). Activity log is its own panel (5 rows, expand for the day). Shared `web/app/Dialog.tsx` and a "UI consistency" section in `CLAUDE.md`. Smoke passed (subagent run before the log panel split). Rule change: the owner wants to be asked before ANY review or smoke subagent runs.
- Known gaps after #12: 3D view has no crew colours or camera icon; crew phone buttons have no colour; a removed crew's name can be reused by a new crew; going to about 200 GPTs needs the repeated `/api/risk` request problem found first (a first try showed no markers).
- Still open UI notes (not tickets): Check next "Send crew" keeps its label when disabled; simulated shift clock wraps every 72 s so log times look out of order; no loading state after a slider change; Side-by-side at 1100 puts panels below the phone in DOM order; `.fr-side` nested scroll and breakpoint resets could be rewritten mobile-first; optional `Tabs` component extraction.
- 2026-11-08 (PR #14, merged to main as 7448760): real 2D map. MapLibre basemap (`web/app/BaseMap.tsx`, OpenFreeMap positron tiles, OpenStreetMap data) behind the same SVG overlay; `web/lib/geo.ts` maps map units (800x500) to lon/lat (Web Mercator, bbox lon 150.975 to 151.035, centred near Parramatta CBD, about 5.5 km wide); overlay follows pan/zoom via a pixel-based transform, so it also works in full screen. `web/lib/parramattaWaterways.json` = OSM waterways (Parramatta River, Toongabbie, Duck, Vineyard, Subiaco, Domain Creek), downloaded once via Overpass (ODbL). Sample GPTs sit 20 to 100 m from those lines (`web/lib/seed.ts`, x 50..700, spacing 24); positions are SAMPLE DATA, not council assets. Added: wheel/drag/+- zoom and Reset view; marker hover (scale, glow) and tooltip card (portal in body); in-page Full screen (Esc exits); planned run stops drawn above all other GPTs; Manager columns scroll on their own with hidden scrollbars; Compliance records under Simulation controls (full column width).
- Known gaps (real map): 3D view still on procedural terrain (creeks do not match the real map; plan: ELVIS DEM); Manager page not checked at 375px and its columns break there (pre-existing); depot (70,445) is a sample spot; OpenFreeMap terms not read (check before the public build, or self-host tiles); no touch test of one-finger drag vs page scroll; `simplify` not run on this branch. `security-review` done by hand (no innerHTML or eval, external requests only to OpenFreeMap).

- 2026-11-08 PR #14 follow-ups: `maplibre-gl` upgraded 5.24.0 to 6.17.0 (npm audit critical GHSA-jrc7-96c5-q579, now 0). v6 ships its worker as separate .mjs files that Turbopack cannot bundle, so `web/scripts-copy-maplibre-worker.mjs` copies them to `web/public/maplibre/` (gitignored) in `predev` and `prebuild`, and `BaseMap.tsx` calls `setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")`. Smoke passed on the branch (main-flow, 375px crew, basemap). Smoke notes: "Reset sample session" has no `ConfirmDialog` (CLAUDE.md says destructive actions need `tone="danger"`); activity log times can look out of order (shift-clock wrap). Smoke did not cover reduced-motion, a real phone camera, or Full screen and zoom controls. `web/eslint.config.mjs` ignores `public/maplibre/**` (vendor files, otherwise 1100+ warnings).
- 2026-11-08 ticket 09 done (branch `feat/09-precomputed-scores`): `python -m risk_api.export_scores` runs the default scenario (leaf 60, rain 20 mm in 7 days, forecast 10 mm, nothing cleaned) for the 36 sample assets through the same `/predict` code path and writes `web/lib/precomputedScores.json` (7 KB: data source SAMPLE DATA, generation time, model version = algorithm, seed, n, sha256 of `model.joblib`, plus p_block, level, reasons per asset). Matches the live API (21 high, 9 medium, 6 low). Assets come from `ml/sample_assets.json`, a snapshot of `web/lib/seed.ts`; planner test `sampleAssets.test.ts` fails if they drift (regenerate the snapshot, then re-export). 4 pytests in `risk_api/tests/test_export_scores.py` check the command output only. The page is unchanged; reading the file and the offline banner are ticket 10. Generated file is in `.prettierignore`.
- 2026-11-08 ticket 10 done (branch `feat/10-score-fallback`): `planner/src/resolveScores.ts` (pure: live ok gives live; live failed or empty gives the precomputed file; neither gives an explicit error; 5 tests). `web/app/page.tsx` uses it: when risk-api is down the page shows a dashed-border banner "Offline: showing precomputed sample scores (risk-api offline)" with SAMPLE DATA, generation time and model version, the ranked queue and plan still work, and the What-if sliders are disabled, dimmed and reset to the file's scenario (leaf 60, extra rain 0). Cleaned assets keep their precomputed score while offline (the file has no per-run state). Reload with the API up removes the banner. Checked by hand in the browser: live, API stopped, API restarted. The banner and the error message sit above the map toggle (the toggle is absolutely positioned). The "both unavailable" state is only unit-tested, not shown in the browser.
- Next ticket: 11 model evaluation script (`issues/11-model-evaluation-script.md`), then 12 public deploy.
