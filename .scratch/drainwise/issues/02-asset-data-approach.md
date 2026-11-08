# 02 Asset data approach

Type: grilling
Status: resolved
Blocked by: 01

## Question

If real drain inlet / GPT locations are not available, how do we build the asset set? Options include fictional points inside the real Parramatta area, derived from public data (canopy, LiDAR terrain, creek lines), or a council sample if experts provide one. Decide the source, the number of assets, how canopy/rain features are attached, and how it is labelled "sample data" in UI and README.

## Decision (2026-11-08, grilled with owner)

- Source: anonymised council sample if experts provide one (Q1 on 9 Nov); otherwise fictional points inside the real Parramatta area near creek/roads. The abstract 800x500 map stays for the demo only.
- Count: 36 for the demo (about 30 inlets + 6 GPTs). The seed generator takes a count parameter so we can show hundreds. Planner performance above 200 assets is untested and must say so.
- Features: `canopy_pct`, `leaf_index`, `rain_mm_7d` are all simulated in the MVP. Once real locations exist, switch canopy to sampling the NSW tree canopy 2024-25 public layer and rain to BoM data; `leaf_index` stays a seasonal formula.
- Labelling: persistent "SAMPLE DATA" badge in the header, "simulated" next to risk reasons and in the asset modal, a Data honesty section at the top of README, and the pitch opens by saying it. No dismissible banner.
