import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { makeSeedAssets } from "../../web/lib/seed";

// ml/sample_assets.json is the snapshot the Python score export reads. It must match web/lib/seed.ts.
// If this fails: regenerate the snapshot from seed.ts, then run `python -m risk_api.export_scores`.
it("ml/sample_assets.json matches the assets in web/lib/seed.ts", () => {
  const snapshot = JSON.parse(readFileSync(new URL("../../ml/sample_assets.json", import.meta.url), "utf8"));
  const fromSeed = makeSeedAssets().map((a) => ({
    asset_id: a.id,
    type: a.type,
    canopy_pct: a.canopyPct,
    days_since_clean: a.daysSinceClean,
    has_camera: a.hasCamera,
  }));
  expect(snapshot).toEqual(fromSeed);
});
