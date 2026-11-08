// Writes web/lib/cameraReadings.json: one PLACEHOLDER reading per camera GPT (ticket 17).
// Run: npx --yes tsx scripts/make_camera_readings.ts
// SAMPLE DATA. The level is a MOCK from planner/src/mockSuggestion.ts, not read from the photo by any model.
import { writeFileSync } from "node:fs";
import { makeSeedAssets } from "../web/lib/seed";
import { mockSuggestion } from "../planner/src/mockSuggestion";
import precomputed from "../web/lib/precomputedScores.json";

export const PHOTO_COUNT = 7;
const NAMES = ["Clear", "Light debris", "Half blocked", "Blocked"];

const pct = new Map(precomputed.scores.map((s) => [s.asset_id, s.p_block * 100]));
const readings = makeSeedAssets()
  .filter((a) => a.hasCamera)
  .map((a) => {
    const n = Number(a.id.replace(/\D/g, ""));
    const s = mockSuggestion(pct.get(a.id), n);
    return {
      asset_id: a.id,
      photo: ((n - 1) % PHOTO_COUNT) + 1, // fixed rule: GPT number modulo 7
      level: s.level,
      name: NAMES[s.level],
      confidence: s.confidence >= 0.8 ? "high" : s.confidence >= 0.65 ? "medium" : "low",
      reason: s.rationale.replace(/^Mock: ./, (m) => m.slice(-1).toUpperCase()),
    };
  });

writeFileSync(
  new URL("../web/lib/cameraReadings.json", import.meta.url),
  JSON.stringify(
    {
      data_source: "SAMPLE DATA. Placeholder readings from planner/src/mockSuggestion.ts. No image model was run.",
      level_source: "mock",
      photo_rule: "photo = ((GPT number - 1) mod 7) + 1, one of the 7 council sample photos in web/public/camera",
      generated_at: new Date().toISOString(),
      readings,
    },
    null,
    2,
  ) + "\n",
);
console.log(`wrote ${readings.length} readings`);
