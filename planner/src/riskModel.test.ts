import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { predict, type AssetInput, type ModelJson, type Score } from "./riskModel";

// riskModel.json and riskModel.parity.json come from `python -m risk_api.export_model`.
// If this fails after retraining: re-run that command and commit both files.
const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const model: ModelJson = read("../../web/lib/riskModel.json");
const cases: (Score & { input: AssetInput })[] = read("./riskModel.parity.json");

it("has parity cases for several scenarios", () => {
  expect(cases.length).toBeGreaterThanOrEqual(36 * 4);
});

it("gives the same probability, level and reasons as the Python model", () => {
  const got = predict(
    model,
    cases.map((c) => c.input),
  );
  cases.forEach((c, i) => {
    expect(Math.abs(got[i].p_block - c.p_block), c.input.asset_id).toBeLessThan(1e-6);
    expect(got[i].level).toBe(c.level);
    expect(got[i].reasons).toEqual(c.reasons);
  });
});

it("labels the model as sample data", () => {
  expect(model.data_source).toContain("SAMPLE DATA");
});
