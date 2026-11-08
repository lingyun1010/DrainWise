# 06 Schema and data model

Type: grilling
Status: resolved (2026-11-08)
Blocked by: none (02 and 04 are resolved; revisit after the 9 Nov answers on asset and history formats)

## Question

What is the Supabase / Postgres schema for the MVP? Cover `assets`, `observations`, `runs`, `run_stops`, job records, `weather`, `canopy_by_asset`, and `risk_scores`. Decide: which tables exist in the MVP vs only on paper (photos are in memory, see 04), PostGIS or plain lat/lng, how simulated vs real rows are marked (a `source` / `is_sample` column), how a council schema would map in, and whether the web app reads precomputed `risk_scores` or calls risk-api live.

## Decision (2026-11-08)

- **No database in the MVP.** Seed + localStorage + live risk-api stay. The schema is a design doc: `docs/schema.md`.
- **Tables**: 8, each marked with its MVP equivalent or "paper only". `job_records` holds `before` / `after` booleans only, no `photo_url`, until the 04 face / plate gate passes.
- **Geometry**: PostGIS `geography(Point, 4326)` + GiST. Abstract 800x500 units are display only.
- **Sample marking**: `source` column (`sample`, `council`, `crew`) on every table; any `sample` row in a result shows SAMPLE DATA.
- **Council mapping**: staging table, then one script into `assets`. `/predict` contract unchanged.
- **Handed to 07**: `risk_scores` precomputed vs live call to risk-api.
