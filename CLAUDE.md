# DrainWise — project brief for Claude Code

Working name: **DrainWise** (the demo page still says "FloodReady"; rename is pending the owner's confirmation).
Tagline: **Clean the right gross pollutant traps before they fill.** (was "drains before they block")
Owner: Lingyun (Sydney, solo, front-end developer moving into AI engineering). Reply in Chinese when she writes Chinese; code, UI copy and docs in English.

## 1. What this is

Entry for the City of Parramatta hackathon (WSTI Festi). Final submission around 18–20 Nov 2026. Council experts are online Mon 9 Nov and Fri 13 Nov.

Problem (from council experts): gross pollutant traps (GPTs) fill with leaves and debris and block. Council experts say there are 30+ GPTs (confirmed by the owner, 11 Nov), not hundreds: never say "hundreds". Cameras (owner, from council, 11 Nov): about 6 to 8, some views unclear or blocked, no smart alerts or recognition, all checked by a person. Cleaning today (owner, from council, 11 Nov): roughly one run every 3 months, 10 to 15 GPTs per run, and nobody knows which GPTs are full. Inspection is manual. Only some sites have cameras.

Idea: predict which GPTs will fill next, rank them, and suggest a truck run (for the outsourced contractor, who picks the day and the people) that cleans the riskiest nearby ones without exceeding the truck's capacity (default 3 m³, an assumption). Crews close each job with proof. Photos taken before cleaning become training data for the model; photos after cleaning are evidence of work. Sites with a camera need no photos.

Chosen hackathon challenge: **5. AI for Smarter Asset and Environmental Management** (primary), with 1 (Climate Resilience) as secondary. Select "City challenges", not "Open Innovation".

Scope decision (final, updated 9 Nov 2026 after the council session): **GPTs (net type) only.** No drain inlets, no roads, sandbags, resident notices or SES. Real-time flood warning already exists (FloodSmart/FLASH, BoM forecast + 3Di); we do not compete with it. Our value is operational action on blockage.

"GPT" is Gross Pollutant Trap (confirmed by the council session on 9 Nov). No dollar figures in the UI: the purpose is operational first, cost second.

## 2. What the demo already does (reference implementation)

`reference/demo-Main.dc.html` is the published demo (a Claude Design artifact, native DC format: React-based runtime, not plain HTML). It is a **UI and behaviour reference, not code to extend.** Reimplement in the real stack.

Behaviour to preserve:

- Role entry screen: Manager, Crew (phone), side-by-side demo. Demo only; no real auth needed for the hackathon.
- Manager view: 2D map with 36 mock assets (drop-shaped mascots: frowning orange = High, neutral yellow = Medium, smiling blue = Low; "G" badge = GPT; dashed ring = has a camera), creek, depot, 3 crew characters. 2D/3D toggle (3D water/terrain with Three.js).
- "Check next" queue ranked by risk, with reasons ("Heavy tree cover nearby", "Last cleaned N days ago").
- Truck run planner: capacity slider (1–4 m³), greedy plan (risk first, nearby first, never over capacity), numbered stops and dashed route on the map, per-stop load and "camera, no photos" / "photos needed".
- Crew phone app: accept run, "Stop n of m", load bar, next stops. At each stop: camera site = just "Mark as cleaned"; otherwise BEFORE photo, clear, AFTER photo, then "Submit and mark cleaned". Cannot submit without both photos.
- Compliance records panel: before photos (AI training), after photos (evidence), camera checks, per-job rows with thumbnails.
- What-if sliders: leaf fall, extra rain. Activity log. Rain forecast bars.

Design principles: original characters only (never reuse Disney/Pixar/Inside Out characters), severity must not rely on colour alone (faces + labels), support `prefers-reduced-motion`, mobile-first crew view.

Demo scoring formula (placeholder, **not a trained model**):
`s = (0.45*canopy/70 + 0.35*leaf/100 + 0.2*rain) * (0.2 + 0.8*min(1, days/150))`; High >= 0.46, Medium >= 0.28.
Load estimate (m³ of debris, made-up): inlet `0.06 + 0.22*f` (legacy, unused in the UI since GPT-only), GPT `0.35 + 1.0*f`, `f = min(1, s*1.3)`. Truck default 3 m³ is an assumption (owner decision 9 Nov 2026).

## 3. Data reality (be honest in the product and in the pitch)

NOT publicly available, must come from council or be mocked: drain/pit/GPT locations, which sites have cameras, historical blockage and cleaning records, truck and bin sizes, cost per clean.

Publicly available and useful:

- NSW tree canopy 2024–25 (public; the finest 0.48 m layer is restricted).
- ELVIS LiDAR (free) for terrain.
- Parramatta River Flood Study 2024 (planning-level, XP-RAFTS + 1D/2D TUFLOW, CC BY 3.0 AU, 43 PDFs).
- BoM rainfall; Data.NSW datasets (licences vary, check each).

Rules: label everything simulated as "sample data" in the UI. Never present the demo formula as an AI model. Until real history exists, the model is trained on **simulated** data and must say so.

## 4. Recommended real implementation (hackathon MVP, ~10 days)

Keep it small and demonstrable. Suggested stack (owner is a front-end dev; adjust if she prefers otherwise):

- Web app: Next.js + TypeScript + Tailwind. Crew view as a mobile-first PWA (camera via `<input type="file" accept="image/*" capture="environment">`).
- Map: MapLibre GL JS (2D) with 3D terrain/extrusion for the 3D view, or keep Three.js as in the demo.
- Backend/DB: Supabase (Postgres + PostGIS + Storage for photos). Tables: `assets` (id, type inlet|gpt, geom, has_camera), `observations` (asset_id, ts, source photo|camera|inspection, label blocked_level, photo_url), `jobs`/`runs`/`run_stops`, `weather`, `canopy_by_asset`.
- Risk service: Python (FastAPI) with scikit-learn first (gradient boosting on simulated history: canopy, season/leaf fall, rainfall, days since clean, catchment). TensorFlow only if there is a reason; `tensorflow-cpu` installs fine. Output: probability of blockage in next N days plus top reasons (feature contributions).
- Planner: start with the greedy heuristic from the demo; then a small knapsack + nearest-neighbour or OR-Tools routing if time allows. Keep it explainable.
- Photo pipeline: store before/after with timestamp, GPS, crew id, run id. Before photos feed a labelling queue (blocked level 0–3) to retrain. Check for faces/number plates before any training use.
- Auth: Supabase Auth with 2 roles (manager, crew) if time permits; otherwise keep the role picker.

Suggested build order: (1) seed data + map + ranked queue, (2) risk service on simulated data with explanations, (3) truck planner, (4) crew PWA with photo capture and compliance, (5) 3D view, (6) polish, README and pitch.

## 5. Open questions for council experts (9 and 13 Nov)

1. Can we get asset locations (GPTs), even a sample or anonymised?
2. How many GPTs and cameras are there, and how are cameras monitored today?
3. Is there any cleaning/blockage history, and in what format?
4. Truck and bin volumes, typical load per GPT, cost per clean (not shown in the UI), crews per day?
5. Existing work-order or inspection system we should integrate with, and rules for photo evidence?
6. Do judges prefer depth (one well-grounded model) or breadth?
7. (Answered 9 Nov: GPT means Gross Pollutant Trap.)

## 6. Open decisions for the owner

- Final name: DrainWise vs FloodReady. Scope line (section 1) is settled: GPT (net) only.
- Train a small model on simulated data now (recommended) vs. keep the transparent formula.
- Whether to extract tables from the flood-study PDFs for context.

## 7. Working agreements

- Prefer simple, explainable approaches over impressive-sounding ones.
- Do not fabricate data sources, statistics or council facts. Flag assumptions in the UI and README.
- Verify in a browser before claiming a UI works; test the crew flow end to end (accept, photos/camera, submit, next stop, return to depot).
- If the project is public, do not commit secrets or the owner's personal details.

## 8. AI / ML component

### Layout

- `ml/` training code: simulated data generator, training script, evaluation, saved model (`model.joblib`)
- `risk-api/` FastAPI service that loads the model and serves predictions
- `web/` Next.js app; calls risk-api (or reads precomputed scores from Supabase `risk_scores`)

### What the model does

- Predicts probability that a GPT (net) blocks within the next N days, plus top reasons (feature contributions).
- Features: tree canopy near asset, season / leaf-fall index, recent and forecast rainfall, days since last clean, catchment/terrain, asset type (the contract still accepts inlet|gpt for old data; the product is GPT only), has_camera.
- Start with scikit-learn gradient boosting. Do not add TensorFlow unless there is a clear reason.

### Data rules (important)

- There is NO real blockage/cleaning history yet. Train on SIMULATED data from `ml/simulate.py`.
- Everything simulated must be labelled "sample data" in the UI, README and pitch. Never present the demo formula or simulated results as observed council data.
- When real records arrive (council experts, 9 and 13 Nov), only swap the training data and retrain; keep the API contract unchanged.
- Never commit raw photos, large datasets or secrets. Model file is small and may be committed.

### API contract

POST /predict
in: [{asset_id, type, canopy_pct, leaf_index, rain_mm_7d, rain_forecast_mm, days_since_clean, has_camera}]
out: [{asset_id, p_block, level: low|medium|high, reasons: [string]}]

### Photo classification (separate from the risk model)

- Uses a hosted vision model called from the SERVER only (API key in env vars, never in client code).
- Returns blockage level 0-3 + confidence + short rationale; a human confirms before it becomes a training label.
- Only 7 unlabelled sample images exist: do not claim accuracy; report as a prototype with human review.
- Check for faces / number plates before any image is used for training.

### Commands

- `python -m ml.simulate` then `python -m ml.train` -> writes `ml/model.joblib`
- `uvicorn risk_api.main:app --reload` -> serves /predict
- `python -m risk_api.export_scores` -> writes `web/lib/precomputedScores.json` (default scenario, 36 sample assets, stamped with data source, time, model version). Reads `ml/sample_assets.json`, a snapshot of `web/lib/seed.ts`; a planner test fails if the two drift. Regenerate after retraining or changing seed assets.
- - Rain forecast: the Manager page reads the real BoM precis forecast (IDN11060, Parramatta) through `web/app/api/bom/route.ts` (server side, kept 1 h; parser `planner/src/bomPrecis.ts`). It gives a daily chance of rain and a rain range (75% / 25% chance of at least the first / second amount); there is no 3-hourly rain in this free product, so the 3-hourly strip is SAMPLE. The unofficial `api.weather.bom.gov.au` says "You must not use, copy or share it": do not use it. BoM free text products are not for commercial use; forecast grids need the paid real-time service. Header RAIN SINCE 9AM is a real reading from Sydney Olympic Park AWS via `web/app/api/rain-obs/route.ts` (IDN60920; rain since 9am, no rate).
    `python -m risk_api.export_model` -> writes `web/lib/riskModel.json` (the trees) and `planner/src/riskModel.parity.json` (Python answers). `planner/src/riskModel.ts` walks the trees in TypeScript; the public build uses it so what-if works with no risk-api. `riskModel.test.ts` fails if TS and Python disagree. Re-run after every retrain, together with `export_scores`.
- Keep results reproducible: fixed random seed, log the data source and version in each run.

### Working agreements

- Prefer simple, explainable models. Every score must show reasons.
- Test the full flow (train -> API -> web ranked queue) before claiming it works.

### Web and planner (added 2026-11-08)

- `planner/` TypeScript planner (vitest): `planRun` (knapsack + nearest-neighbour, min-risk cutoff) and `canComplete` (crew submit rule). Tests: `cd planner && npm test`.
- `web/` Next.js 16 app: manager page `/` (map, queue, truck run, sliders), crew phone page `/crew`. Imports the planner by relative path.
- Run: `uvicorn risk_api.main:app` from the project root, then `cd web && npm run dev`. `RISK_API_URL` env var overrides the default `http://127.0.0.1:8000`.
- Manager-to-crew handoff: localStorage on one device; with a shared room (`web/app/RoomChip.tsx`, `web/lib/runStore.ts`, `/api/room`) the session is also kept in Supabase table `rooms` and polled every 2 s, so a laptop and a phone share it. No sign-in; last write wins; rooms expire after 24 h. Photos go to Supabase Storage (ticket 16) when `NEXT_PUBLIC_PHOTO_UPLOAD=1`.

### Risk report email (updated 2026-11-11)

- One pure rule, `planner/src/reportRule.ts` (`decideReport`), used by the Preview, the send route, the daily job and tests. The check runs once a day over the 7-day BoM forecast.
- Default: one weekly report, at most every 7 days. A storm on any of the next 7 days (assumption: 60%+ chance and 25 mm+, ask council) sends a storm alert now and again every 24 h until a run is planned. Kinds: `storm_alert`, `weekly_7day`.
- Reports go to the admin only; sending to a crew is a manual step in the planner. Real Gmail send needs `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `REPORT_ADMIN_KEY`; the demo page only previews.
- The crew plan email (`planner/src/planEmailHtml.ts`, shown by `EmailPlan.tsx`) has the same designed look as the admin report, is read-only and has no link back to the admin. It is simulated: nothing is sent.
- The model and learning pages are linked from the footer (the old "More" nav is gone).

### Simulated sign-in (2026-11-11)

- `web/lib/demoAuth.ts`, `LoginDialog.tsx`: Manager needs name `admin` and its password; each crew (A, B, C) has its own password and sees only its own run (`CrewApp lockedCrewId`). Side-by-side needs no sign-in. Session is in sessionStorage. The credentials are in the client bundle: it is a demo of the idea, not security. Real deployment: council single sign-on. Do not write the passwords in the UI.
- Planned GPTs in the truck run planner can be removed with a reason (`RemoveStopDialog.tsx`); the reasons carry into the review dialog and the plan record.

### UI (updated 2026-11-08)

- UI matches `reference/demo-Main.dc.html`: role screen on `/` (Manager, Crew -> `/crew`, Side-by-side), map in 800x500 units, shared `web/app/CrewApp.tsx`. Run state and records in `web/lib/runStore.ts` (localStorage, events for same-tab sync). "Reset sample session" clears it.
- 3D water view: `web/app/Map3D.tsx` (three.js, lazy-loaded) on procedural SAMPLE terrain from `web/lib/terrain.ts`. Water level is an illustration driven by rain and the extra-rain slider, not a flood forecast. Planned: swap `heightAt` for a LiDAR heightmap (ELVIS DEM, Parramatta) downsampled to a small file; never commit raw LiDAR.

## UI consistency (required whenever you add or change a feature)

The owner does not want the look to drift between features. Before adding any UI, reuse what exists; only add a new pattern if nothing fits, and then add it to this list.

- **Popups**: only `web/app/Dialog.tsx`. Use `Dialog` for details and pickers, `ConfirmDialog` for yes/no. Never `window.confirm`, `alert`, or a hand-written overlay. Same card (dark panel, 3px border, radius 24), eyebrow in small caps, h2 title, body, then actions: primary button first, quiet "Cancel" last. Esc closes. It is fixed to the viewport and centred.
- **Dialog options**: `closeOnOutside` (backdrop click closes) and `focusDialog` (focus the card, not the first control) are off by default. Use them for read-only or chat dialogs; never for confirmations or destructive dialogs.
- **List dialogs from header tiles**: HIGH RISK and CLEANED TODAY are `fr-tile fr-tilebtn` buttons that open a `Dialog` listing the GPTs (row = id + detail, click opens its details). Rows are `fr-btn fr-sec`.
- **Dropdowns**: a native `<select>` (`className="fr-select"`) for plain short lists. A list that must look like the app (rows with detail, such as "Add a GPT to the run") uses `web/app/GptPicker.tsx`: same field look, list opens above in a dark panel (2px border, radius 16), keyboard Up/Down/Enter/Esc. The OS list of a native select cannot be styled.
- **Hover cards**: use `web/app/Tip.tsx` (the `.fr-tip` card: bold title, muted sub-lines, then detail), never the browser's native `title` tooltip. It also opens on keyboard focus and closes on Esc.
- **Destructive or hard-to-undo actions** (Remove, Withdraw, Reset, delete): always a `ConfirmDialog` with `tone="danger"`. The body must say what happens, what stays (for example records) and what the person is currently doing. Focus starts on Cancel.
- **Choices inside a dialog**: a native checkbox with a label sentence that changes with the state (for example "Also delete the AFTER photo of the same job"), default on for the safe path, 20px box. Used in the review "Delete photo" dialog.
- **Buttons**: `fr-btn` with `fr-pri` (main action), `fr-sec` (secondary), `fr-ghost` (quiet or Cancel). Minimum height 40px. Disabled looks come from the class, not inline colours. Label with a verb ("Withdraw run", "Send a crew").
- **Crew identity**: colour comes from `HATS` in `web/lib/runStore.ts` by crew position; letter from `crewLetter()`. Show a colour dot wherever a crew is named (map, lists, log, pickers). Crews are listed A to Z in pickers. Never rely on colour alone: keep the letter or the name next to it.
- **Risk levels**: High, Medium, Low keep their colour AND face AND label. Cut-offs are 60% and 30% (`risk_api/main.py`); write them as "High (60%+)".
- **Map (2D)**: real basemap with the SVG overlay in map units (`web/lib/geo.ts`); never draw invented roads. Wheel, drag and +/- zoom like the 3D view; "Reset view" and "Full screen" buttons sit on the map. Hover or focus on a GPT: scale up and glow (`.fr-mk-in`) plus the hover card (`.fr-tip`, rendered in `document.body`). Planned run stops are drawn above all other GPTs. Full screen is an in-page overlay (no navigation, Esc exits). Say "sample" for GPT and depot positions and credit OpenStreetMap and OpenFreeMap.
- **Floating chat button** (`web/app/ChatButton.tsx`, mounted in `layout.tsx`, hidden on `/crew`): the cloud button bottom-right opens the assistant in the shared `Dialog`. When closed it says a random tip bubble now and then (7 s visible, 14 s apart); clicking a tip asks that question. Suggested questions stay under the conversation as small `.fr-chip` pills (never full `fr-btn` buttons, so they stay below Send). Opening the chat does not focus the input (`focusDialog`), and clicking the backdrop closes it (`closeOnOutside`). The chat log scrolls with no scroll bar. Never put important controls under its corner.
- **Count badge**: red circle with the number at the top right of an icon (`.fr-badge`, like a phone notification), hidden at 0. Used on the review bell. Red is the owner's choice for notifications only; it does not mean a risk level.
- **Colours and type**: use the existing dark navy palette and CSS variables in `globals.css`; do not introduce new accent colours. Crew colours avoid orange, yellow and blue because those mean risk.
- **Copy**: English, short, plain words, no emoji. Say "sample data" for anything simulated. Name the thing ("Crew A", "GPT-014"), not "it".
- **Manager page** shows all panels at once (no tabs). Side-by-side keeps the tabbed layout next to the phone. The crew phone stays mobile-first.
- **Checks before saying done**: tsc, eslint, prettier, then look at it in the browser at desktop width and at 375px; open every dialog you touched. The `design-reviewer` gate applies to layout changes.

## Agent skills

### Issue tracker

Local markdown under `.scratch/<feature>/` (map, spec, one file per ticket). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each ticket. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Workflow hooks (lingyun-project, installed 2026-11-08)

Project hooks in `.claude/settings.json`, scripts in `.claude/hooks/` (state in gitignored `.claude/.state/`). Nudges are advice the agent may skip; blocks are enforced; CI on the PR is the only enforcement that does not depend on a Claude session.

- SessionStart: nudge naming the stage list. Do not ask again which hooks to install.
- `git commit`: nudge to run `simplify` and `security-review`.
- `gh pr create`: **block** unless `npm test` (planner) and `pytest` both passed this session; nudge to dispatch smoke/UI/UX subagents.
- `gh pr merge`: **block** unless `gh pr checks` is green and the PR body mentions "smoke"; afterwards nudge to re-run tests on main and update the map.
