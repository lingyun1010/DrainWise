import { describe, expect, it } from "vitest";
import readings from "../../web/lib/cameraReadings.json";
import { makeSeedAssets } from "../../web/lib/seed";

// Ticket 17: every camera GPT in the seed has one placeholder reading, with a fixed photo and a level 0-3.
// If this fails after changing seed.ts: `npx --yes tsx scripts/make_camera_readings.ts`.
describe("camera readings", () => {
  const cams = makeSeedAssets().filter((a) => a.hasCamera);

  it("covers exactly the camera GPTs in the seed", () => {
    expect(readings.readings.map((r) => r.asset_id).sort()).toEqual(cams.map((a) => a.id).sort());
  });

  it("has exactly 7 camera GPTs (owner decision 2026-11-09)", () => {
    expect(cams).toHaveLength(7);
  });

  it("has a level 0-3, a photo 1-7 from the fixed rule (camera k shows sample photo k), and a reason", () => {
    const order = cams.map((a) => a.id);
    for (const r of readings.readings) {
      expect([0, 1, 2, 3]).toContain(r.level);
      expect(r.photo).toBe(order.indexOf(r.asset_id) + 1);
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });

  it("says the levels are a mock", () => {
    expect(readings.level_source).toBe("mock");
  });
});
