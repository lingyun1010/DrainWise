# 07 Hosting and deploy

Type: grilling
Status: resolved (2026-11-08)
Blocked by: none

## Question

Where does each part run for the judges? Decide: web on Vercel or run locally for the demo, Supabase now or later, where FastAPI risk-api runs (a small host, serverless, or precomputed scores baked into the web app so risk-api is not needed live), where the server-side vision key lives, and what the fallback is if the network fails during the demo. Keep secrets out of the repo.

## Inherited from 06

06 chose no database for the MVP. Still to decide here: does the web app read precomputed scores (a file baked into the build, or the `risk_scores` table later) or call risk-api live? This depends on where risk-api runs.

## Decision (2026-11-08)

- **Access**: the live demo runs locally on the owner's laptop (no network needed). The web app is also deployed to Vercel as a public link for judges. The public build shows SAMPLE DATA and exposes no key. If the submission form needs no URL, drop to local only.
- **risk-api**: the public build does not depend on it. A precomputed JSON (default scenario, with data source, generated time and model version) is baked into the build. Leaf fall and extra rain sliders do not recompute on the public build ("run locally to try what-if"). The local build calls risk-api live.
- **Local fallback**: if risk-api is offline, the local build falls back to the same JSON, shows the banner "Showing precomputed sample scores (risk-api offline)" and greys out the sliders. One code path, two data sources.
- **Vision key**: only in local `web/.env.local` (gitignored) and Vercel server-side env vars; never in client code or the repo. The public build has no key, so vision is off there. The photo review page is local only (7 sample images, prototype, no accuracy claim, see 04).
- **Network failure**: live demo is local (no network); 05's recording is the next fallback. The public link is static with no backend dependency.
- **Inherited from 06**: `risk_scores` is not a table in the MVP; read path as above.
- **Build work for Stage 4**: export the JSON, fallback + banner, Vercel deploy with env vars, hide vision on the public build.
