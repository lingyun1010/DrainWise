import { describe, expect, it } from "vitest";
import { resolveScores } from "./resolveScores";

const live = [{ asset_id: "GPT-001", p_block: 0.9 }];
const file = [{ asset_id: "GPT-001", p_block: 0.5 }];

describe("resolveScores", () => {
  it("uses the live scores when the live call worked", () => {
    expect(resolveScores({ ok: true, scores: live }, file)).toEqual({ status: "live", scores: live });
  });

  it("uses the live scores even when no precomputed file exists", () => {
    expect(resolveScores({ ok: true, scores: live }, null)).toEqual({ status: "live", scores: live });
  });

  it("falls back to the precomputed scores when the live call failed", () => {
    expect(resolveScores({ ok: false, error: "risk-api is not reachable" }, file)).toEqual({
      status: "precomputed",
      scores: file,
      reason: "risk-api is not reachable",
    });
  });

  it("gives an explicit error when both are unavailable", () => {
    expect(resolveScores({ ok: false, error: "risk-api is not reachable" }, null)).toEqual({
      status: "error",
      error: "risk-api is not reachable",
    });
    expect(resolveScores({ ok: false, error: "down" }, [])).toEqual({ status: "error", error: "down" });
  });

  it("treats an empty live answer as a failure, not as 'no risk'", () => {
    expect(resolveScores({ ok: true, scores: [] }, file)).toMatchObject({ status: "precomputed", scores: file });
  });
});
