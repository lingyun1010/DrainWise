# 06 Schema and data model

Type: grilling
Status: open
Blocked by: none (02 and 04 are resolved; revisit after the 9 Nov answers on asset and history formats)

## Question

What is the Supabase / Postgres schema for the MVP? Cover `assets`, `observations`, `runs`, `run_stops`, job records, `weather`, `canopy_by_asset`, and `risk_scores`. Decide: which tables exist in the MVP vs only on paper (photos are in memory, see 04), PostGIS or plain lat/lng, how simulated vs real rows are marked (a `source` / `is_sample` column), how a council schema would map in, and whether the web app reads precomputed `risk_scores` or calls risk-api live.
