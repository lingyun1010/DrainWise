# DrainWise

**Clean the right gross pollutant traps before they fill.**

A hackathon prototype for the City of Parramatta challenge _5. AI for Smarter Asset and Environmental Management_ (primary), with a nod to _1. Climate Resilience_. It predicts which gross pollutant traps (GPTs, net type only) are most likely to fill next, ranks them, and suggests a truck run for the contractor that cleans the riskiest nearby ones without exceeding the truck's capacity (3 m³ is an assumption). Crews close each job with proof: before photos are designed to become training data, after photos are evidence of work, and sites with a camera need no photos.

## What is real and what is sample data

Read this first. These statements are the same on every screen and in the pitch.

- **Everything shown is sample data.** There are no real council asset locations, no real blockage history and no real truck sizes. The 36 assets are generated at real Parramatta locations, not surveyed.
- **The risk model is trained on simulated history** (`ml/simulate.py`). It is not trained on council records.
- **The demo formula is a baseline, not an AI model.** It is kept only to compare against the trained model.
- **Photos are designed to become training data. Nothing is retrained.** A human confirms every label, and no photo may enter training until it has been checked for faces and number plates (that check is not built yet).
- **No accuracy is claimed anywhere.** `python -m ml.evaluate` is a pipeline recovery check on simulated data (see `ml/README.md`).
- **The 3D terrain and water level are illustrations,** not a flood forecast. Real-time flood warning already exists (FloodSmart / FLASH, BoM); we do not compete with it.

## Try it

- **Public demo:** https://drainwise-zeta.vercel.app. It reads precomputed scores, shows a "Public demo" banner and runs the what-if sliders in the browser. No key is needed and nothing is installed.
- **Local build:** below. It adds the live risk service and the local-only photo review page.

## What it does

- **Manager view** (`/`): a real basemap (OpenStreetMap, OpenFreeMap) with 36 sample assets (frowning orange drop = High, neutral yellow = Medium, smiling blue = Low, "G" badge = GPT, dashed ring = has a camera), a ranked "Check next" queue with reasons, a truck run planner (capacity slider, risk first, nearby first, never over capacity), what-if sliders (leaf fall, extra rain), a compliance records panel and an activity log. The rain forecast uses the real BoM precis forecast for Parramatta; the 3-hourly strip is sample.
- **3D water view:** three.js scene on procedural sample terrain with a water plane that rises with rain.
- **Crew phone app** (`/crew`, mobile-first): accept a run, step through stops. At a camera site just "Mark as cleaned"; otherwise take a BEFORE photo, clean, take an AFTER photo, then submit. Submit is blocked without both photos.
- **Shared room:** the Manager and the Crew phone can share one sample session across two devices (room chip in the header, no sign-in, last write wins, rooms expire after 24 hours).
- **Photo review** (`/review`): lists stored before photos and the 7 sample images. The AI suggestion on the public build is a labelled mock. Real vision calls run only on a local build with a key, and a human confirms the level before it counts as a label.
- **Model page** (`/model`): inputs, the validation loop, the training pipeline and an interactive what-if on the 36 sample GPTs. Sample data.
- **Risk model:** gradient boosting that returns a probability of blockage plus the top reasons for every score. High is 60%+, Medium is 30%+.

Design principles: original characters only, severity is never colour alone (faces and labels), `prefers-reduced-motion` is respected, the crew view is mobile-first.

## Layout

| Path         | What it is                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ml/`        | Simulated data generator, training script, evaluation, saved model (`model.joblib`, small, committed). See `ml/README.md`                                                 |
| `risk_api/`  | FastAPI service that loads the model and serves `POST /predict`, plus the export scripts for the public build                                                             |
| `planner/`   | TypeScript planner with tests: `planRun` (knapsack + nearest neighbour, minimum-risk cutoff), `canComplete` (crew submit rule), the TypeScript risk model, the BoM parser |
| `web/`       | Next.js app: manager, crew, `/model`, `/review`, API routes. Imports the planner by relative path                                                                         |
| `supabase/`  | Migrations for crew photos and shared rooms                                                                                                                               |
| `reference/` | The original Claude Design demo, banner and challenge briefing. A UI reference, not code to extend                                                                        |
| `docs/`      | Schema and review gates                                                                                                                                                   |
| `.scratch/`  | Working notes: expert questions, tickets, research                                                                                                                        |

## Run it locally

You need Python 3 and Node.js.

```bash
python -m venv .venv && .venv/bin/pip install -r requirements.txt

# 1. Train the model on simulated data (writes ml/model.joblib)
.venv/bin/python -m ml.simulate
.venv/bin/python -m ml.train

# 2. Risk API, from the project root (default http://127.0.0.1:8000)
.venv/bin/uvicorn risk_api.main:app --port 8000

# 3. Web app
cd web && npm install && npm run dev -- -p 3000
```

Open http://localhost:3000 and pick **Manager**, **Crew**, or **Side-by-side** (best for a demo). Set `RISK_API_URL` if the risk API is not on the default address. "Reset sample session" clears the saved run and records.

**Offline banner.** If the risk service is not running, the Manager page falls back to the precomputed scores file and shows a banner saying the scores are precomputed sample scores, with the source and the time they were generated. The what-if sliders are off in that state. (The public build is different: it runs what-if in the browser by walking the same trees in TypeScript, `planner/src/riskModel.ts`, and a test fails if that and the Python model disagree.)

**Optional environment variables** go in `web/.env.local` (gitignored; see `web/.env.sample`). Never commit them.

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_PHOTO_UPLOAD=1`: save crew photos and shared rooms. Without them photos stay in memory.
- `OPENAI_API_KEY`: turns on real vision suggestions at `/review`. Local only; never set it on Vercel. Without it `/review` still works and the suggestion is a labelled mock.

After retraining, regenerate the files the public build reads:

```bash
.venv/bin/python -m risk_api.export_scores
.venv/bin/python -m risk_api.export_model
```

Tests and checks:

```bash
.venv/bin/pytest -q          # model and API
cd planner && npm test       # planner (vitest)
cd web && npx tsc --noEmit   # types
```

## Risk API

```
POST /predict
  in:  [{asset_id, type, canopy_pct, leaf_index, rain_mm_7d, rain_forecast_mm, days_since_clean, has_camera}]
  out: [{asset_id, p_block, level: low|medium|high, reasons: [string]}]
```

Features: tree canopy near the asset, leaf-fall index, recent and forecast rainfall, days since last clean, asset type and whether it has a camera. More canopy, leaf fall, rain or days since clean never lowers the risk (monotonic constraints).

When real records arrive, only the training data is swapped and the model retrained. The API contract stays the same. Runs are reproducible (fixed random seed, data source logged).

## Open items for the council

We need these from council experts. Until then everything stays sample data.

1. GPT locations, even a sample or anonymised.
2. How many GPTs and cameras there are, and how cameras are monitored today.
3. Any cleaning or blockage history, and its format.
4. Truck and bin volumes, typical load per GPT, cost per clean (not shown in the UI), crews per day.
5. An existing work-order or inspection system to integrate with, and rules for photo evidence.
6. Confirmation that **"GPT" means Gross Pollutant Trap.** We assume so; it is not confirmed.

## Email report (ticket 23)

`/report` (button "Email report" in the Records panel) previews and sends the risk report to the contractor over Gmail SMTP. The rule, in `planner/src/reportRule.ts` (`decideReport`): once a day, look at the BoM forecast for tomorrow. A storm (assumed: 60%+ chance and 25 mm or more, not a council level) sends a 1-day report the day before (GPTs High at tomorrow). No storm sends one 7-day report a week, on Mondays. Max one storm report per 24 hours; a storm report the same day skips the weekly one; a storm report with no GPT to list sends nothing.

- **Automatic sending is not built.** The demo has no scheduler (no cron). In production a scheduler would call `decideReport` once a day and send what it returns. In the demo you press Preview, then Send. The page says so.
- **Setup:** copy `web/.env.sample` to `web/.env.local` and fill `GMAIL_USER` and `GMAIL_APP_PASSWORD` (a Google app password; the owner creates it). They are server-only env vars, never in the repo or the browser. Empty means `/api/send-report` answers 503 "not set up". `REPORT_EMAIL_OFF=1` is the kill switch (503). `REPORT_EMAIL_MOCK=1` runs the flow without sending, for tests.
- **Limits:** 3 sends per hour per client and 10 per hour in total, in memory on one server instance. The recipient is typed at send time and never stored; the server logs and the Activity log keep only a masked form (`a***@gmail.com`). Gmail's own daily sending limit has not been verified.
- **Honest limits:** every mail says "Demo with sample data". The GPTs and the model are simulated. The truck-run part is worded as a suggestion for the contractor. Real Gmail delivery has not been tested by the agent (it needs the owner's app password); the send path is tested with a mock SMTP transport.

## Honest limits

- **Not public, must come from council or be mocked:** asset locations, which sites have cameras, blockage and cleaning history, truck and bin sizes, cost per clean.
- **Load estimates and the 2.0 m³ default truck size are assumptions.**
- **Crew photos are stored** in a private Supabase bucket when uploads are on (JPEG, shrunk to 1280 px in the browser, which also drops EXIF and GPS). Public demo uploads expire after 24 hours. The face and number-plate check is not built, so no photo may enter training.
- **No sign-in.** The Manager and Crew roles are a picker, and shared rooms are last-write-wins.
- **Vision classification is a prototype with human review.** Only 7 unlabelled sample images exist, so no accuracy is claimed.
- **Basemap:** OpenStreetMap and OpenFreeMap, free, no key, attribution stays visible. Depot and GPT positions are sample.

## Possible next steps

- Real terrain: replace the procedural `heightAt` in `web/lib/terrain.ts` with a heightmap from free ELVIS LiDAR for Parramatta. Only a small downsampled file should be committed, never raw LiDAR.
- Real inputs: NSW tree canopy 2024–25, BoM rainfall, and any asset and history data the council can share.
- Planner: OR-Tools routing, keeping results explainable.
- Roles: Supabase Auth with manager and crew.

## Data sources and licences

Public and useful: NSW tree canopy 2024–25 (the finest layer is restricted), ELVIS LiDAR (free), the Parramatta River Flood Study 2024 (planning-level, CC BY 3.0 AU), BoM rainfall and Data.NSW datasets (licences vary, check each one). The rain forecast is the BoM free precis product; BoM free text products are not for commercial use. Nothing from the flood study, canopy or LiDAR is bundled in this repository yet.

## Pitch

The three-minute path and the data-honesty lines are in [`docs/pitch-outline.md`](docs/pitch-outline.md).
