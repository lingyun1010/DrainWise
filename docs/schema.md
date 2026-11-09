# Data model (design only)

**Status: paper design. The MVP does not use a database.** The web app runs on `web/lib/seed.ts` (sample assets), `web/lib/runStore.ts` (localStorage) and live calls to risk-api. This document says how the same data would live in Supabase / Postgres once real council data exists. See ticket 06 (`.scratch/drainwise/issues/06-schema-and-data-model.md`).

## Conventions

- Every table has `source text not null check (source in ('sample','council','crew'))`. Whenever a query returns any row with `source = 'sample'`, the UI shows the SAMPLE DATA label.
- Positions are `geography(Point, 4326)` with a GiST index. The 800x500 abstract map units in the MVP are display only, not geometry; real lat/lng replaces them.
- Photos are not stored (ticket 04). No `photo_url` column until the face / number-plate check gate has passed.
- Council data is loaded into a staging table first, then mapped into the core tables by one SQL statement or script. Core tables are never edited by hand. The `/predict` API contract does not change.

## Tables

| Table             | MVP equivalent today                  | Main columns                                                                                                  |
| ----------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `assets`          | `SeedAsset` in `web/lib/seed.ts`      | `id`, `type` (gpt; the contract still accepts inlet for old data), `geom`, `has_camera`, `source`             |
| `observations`    | none (paper only, needs real history) | `asset_id`, `ts`, `origin` (photo, camera, inspection), `blocked_level` (0-3), `source`                       |
| `runs`            | `SavedRun` in `web/lib/runStore.ts`   | `id`, `crew_id`, `capacity_m3`, `planned_at`, `accepted_at`, `source`                                         |
| `run_stops`       | `RunStop`                             | `run_id`, `seq`, `asset_id`, `load_m3`, `photos_needed`, `source`                                             |
| `job_records`     | `JobRecord`                           | `run_id`, `asset_id`, `crew_id`, `at`, `method` (camera or photos), `before` (bool), `after` (bool), `source` |
| `weather`         | none (slider inputs)                  | `ts`, `rain_mm`, `is_forecast`, `source`                                                                      |
| `canopy_by_asset` | none (seed field)                     | `asset_id`, `canopy_pct`, `year`, `source`                                                                    |
| `risk_scores`     | live response of `/api/risk`          | `asset_id`, `computed_at`, `p_block`, `level`, `reasons` (text[]), `model_version`, `source`                  |

`risk_scores` is a cache of `/predict` output. MVP read path (ticket 07): the public Vercel build reads a precomputed JSON of default-scenario scores; the local build calls risk-api live and falls back to that JSON when risk-api is offline. This table stays on paper.

## Mapping council data

1. Load the council file as-is into `staging_assets` (or the matching staging table).
2. One mapping script fills `assets` with `source = 'council'`, converting coordinates to WGS84 if needed.
3. Anything the council does not provide stays `source = 'sample'` and keeps the SAMPLE DATA label.
