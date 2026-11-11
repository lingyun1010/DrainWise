import { describe, expect, it } from "vitest";
import { buildReport, scoreHorizon, type ReportAsset } from "./reportBuilder";
import { DAY_RAIN_MM } from "./horizon";
import type { ModelJson } from "./riskModel";
import model from "../../web/lib/riskModel.json";

const M = model as unknown as ModelJson;
const assets: ReportAsset[] = [
  { id: "GPT-A", type: "gpt", canopyPct: 70, daysSinceClean: 170, hasCamera: false },
  { id: "GPT-B", type: "gpt", canopyPct: 5, daysSinceClean: 3, hasCamera: true },
];

describe("scoreHorizon", () => {
  it("lists only High GPTs, highest first, with the first day at risk", () => {
    const rows = scoreHorizon(assets, M, DAY_RAIN_MM, 90, 0, 6);
    expect(rows.map((r) => r.id)).toContain("GPT-A");
    expect(rows.map((r) => r.id)).not.toContain("GPT-B");
    for (const r of rows) expect(r.p).toBeGreaterThanOrEqual(0.6);
  });
  it("the 1-day view only looks at tomorrow", () => {
    expect(scoreHorizon(assets, M, DAY_RAIN_MM, 90, 1, 1).every((r) => r.day === 1)).toBe(true);
  });
});

describe("buildReport", () => {
  const rows = scoreHorizon(assets, M, DAY_RAIN_MM, 90, 0, 6);
  it("states sample data, horizon, threshold and words the plan as a suggestion", () => {
    const r = buildReport("weekly_7day", rows, "Mon 9 Nov 2026", "why");
    expect(r.body).toMatch(/Demo with sample data/);
    expect(r.body).toMatch(/7 days/);
    expect(r.body).toMatch(/High \(60%\+\)/);
    expect(r.body).toMatch(/Suggestion for the contractor/);
    expect(r.subject).toMatch(/Sample data/);
  });
  it("an empty storm report sends nothing, an empty weekly report sends a short note", () => {
    expect(buildReport("storm_1day", [], "d", "w").send).toBe(false);
    const weekly = buildReport("weekly_7day", [], "d", "w");
    expect(weekly.send).toBe(true);
    expect(weekly.body).toMatch(/No GPT is predicted/);
  });
});
