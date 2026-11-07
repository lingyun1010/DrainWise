# DrainWise

**Clean the right drains before they block.**

A hackathon prototype for the City of Parramatta challenge *5. AI for Smarter Asset and Environmental Management*. It predicts which stormwater drain inlets and gross pollutant traps (GPTs) are most likely to block next, ranks them, and plans a truck run that cleans the riskiest nearby ones without exceeding the truck's capacity. Crews close each job with proof: before photos become training data, after photos are evidence of work, and sites with a camera need no photos.

> **All data in this repository is simulated sample data.** There are no real council asset locations, no real blockage history, and no real truck sizes. The risk model is trained on simulated history (`ml/simulate.py`). The 3D terrain and water level are illustrations, not a flood forecast. Every screen says so.

We do not compete with real-time flood warning (FloodSmart / FLASH, BoM). The value here is the operational action on blockage: what to clean, in what order.

## What it does

- **Manager view** (`/`): 2D map of 36 sample assets (frowning orange drop = High, neutral yellow = Medium, smiling blue = Low, "G" badge = GPT, dashed ring = has a camera), a ranked "Check next" queue with reasons, a truck run planner (capacity slider, risk first, nearby first, never over capacity), what-if sliders (leaf fall, extra rain), a compliance records panel and an activity log.
- **3D water view**: three.js scene on procedural sample terrain with a water plane that rises with rain and the extra-rain slider. Drag to rotate, scroll to zoom, arrow keys and `+`/`-` also work.
- **Crew phone app** (`/crew`, mobile-first): accept a run, step through stops, at a camera site just "Mark as cleaned", otherwise take a BEFORE photo, clean, take an AFTER photo, then submit. Submit is blocked without both photos.
- **Risk model**: gradient boosting that returns a probability of blockage plus the top reasons for every score.

Design principles: original characters only, severity is never colour alone (faces and labels), `prefers-reduced-motion` is respected, crew view is mobile-first.

## Layout

| Path | What it is |
| --- | --- |
| `ml/` | Simulated data generator (`simulate.py`), training script (`train.py`), saved model (`model.joblib`, small, committed) |
| `risk_api/` | FastAPI service that loads the model and serves `POST /predict` |
| `planner/` | TypeScript planner with tests: `planRun` (knapsack + nearest neighbour, minimum-risk cutoff) and `canComplete` (crew submit rule) |
| `web/` | Next.js app: manager page, crew page, 3D view. Imports the planner by relative path |
| `reference/` | The original Claude Design demo (`demo-Main.dc.html`), banner and challenge briefing. A UI reference, not code to extend |
| `.scratch/` | Working notes: expert questions, issues, research |

## Run it

You need Python 3 with `fastapi`, `uvicorn`, `scikit-learn`, `joblib`, `numpy` and `pytest` (there is no `requirements.txt` yet), and Node.js.

```bash
# 1. Train the model on simulated data (writes ml/model.joblib)
python -m ml.simulate
python -m ml.train

# 2. Risk API, from the project root (default http://127.0.0.1:8000)
uvicorn risk_api.main:app --port 8000

# 3. Web app
cd web && npm install && npm run dev -- -p 3000
```

Open http://localhost:3000 and pick **Manager**, **Crew**, or **Side-by-side** (best for a demo). Set `RISK_API_URL` if the risk API is not on the default address. "Reset sample session" clears the saved run and records.

Tests:

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

Features: tree canopy near the asset, leaf-fall index, recent and forecast rainfall, days since last clean, asset type (inlet or GPT) and whether it has a camera. More canopy, leaf fall, rain or days since clean never lowers the risk (monotonic constraints). The High and Medium thresholds are placeholders.

When real records arrive, only the training data is swapped and the model retrained. The API contract stays the same. Runs are reproducible (fixed random seed, data source logged).

## Honest limits

- **Not public, must come from council or be mocked:** drain, pit and GPT locations, which sites have cameras, blockage and cleaning history, truck and bin sizes, cost per clean.
- **Load estimates and the 2.0 m³ default truck size are assumptions.** The 36 assets are generated, not surveyed.
- **"GPT" is interpreted as Gross Pollutant Trap.** This is not yet confirmed with the council.
- **Photos are kept in memory only** in this demo and are never persisted. A real pipeline would store before/after photos with time, GPS, crew and run id, and check for faces and number plates before any image is used for training. Photo classification (a hosted vision model called server-side, with human confirmation before a label is used) is planned, not built.
- **Manager-to-crew handoff uses `localStorage`.** It is a demo, there is no real authentication.

## Possible next steps

- Real terrain: replace the procedural `heightAt` in `web/lib/terrain.ts` with a heightmap from free ELVIS LiDAR (Geoscience Australia) for Parramatta. Only a small downsampled file should be committed, never raw LiDAR.
- Real inputs: NSW tree canopy 2024–25, BoM rainfall, and any asset and history data the council can share.
- Planner: OR-Tools routing, keeping results explainable.
- Supabase (Postgres + PostGIS + Storage) for assets, observations, runs and photos, with manager and crew roles.

## Data sources and licences

Public and useful: NSW tree canopy 2024–25 (the finest layer is restricted), ELVIS LiDAR (free), the Parramatta River Flood Study 2024 (planning-level, CC BY 3.0 AU), BoM rainfall and Data.NSW datasets (licences vary, check each one). Nothing from these is bundled in this repository yet.
