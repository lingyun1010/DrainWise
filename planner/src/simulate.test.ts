import { describe, it, expect } from "vitest";
import { simulateWeeks, markCreekSide, summarise, rollingAcceptance, HIDDEN_PREFERENCES } from "./simulate";
import type { Asset } from "./planRun";
import type { Rule } from "./rules";

const depot = { x: 100, y: 400 };
const base: Asset[] = Array.from({ length: 36 }, (_, i) => ({
  id: `GPT-${String(i + 1).padStart(3, "0")}`,
  type: "gpt" as const,
  risk: 0.2,
  x: 30 + ((i * 53) % 740),
  y: 40 + ((i * 97) % 420),
  hasCamera: i % 5 === 0,
}));
const assets = markCreekSide(base);

describe("simulateWeeks", () => {
  it("is reproducible for the same seed", () => {
    expect(simulateWeeks({ assets, depot, weeks: 4, seed: 7 })).toEqual(
      simulateWeeks({ assets, depot, weeks: 4, seed: 7 }),
    );
  });

  it("labels every week as a simulation", () => {
    const w = simulateWeeks({ assets, depot, weeks: 2, seed: 1 });
    expect(w.every((x) => x.simulation === "Simulation, not a real council officer")).toBe(true);
  });

  it("the persona edits the plan with a short reason and the final plan fits the truck", () => {
    const w = simulateWeeks({ assets, depot, weeks: 6, seed: 3, capacity: 3 });
    const edits = w.flatMap((x) => x.edits);
    expect(edits.length).toBeGreaterThan(0);
    expect(edits.every((e) => e.reason.length > 0 && (e.action === "add" || e.action === "remove"))).toBe(true);
    expect(w.every((x) => x.finalLoad <= 3 + 1e-9)).toBe(true);
  });

  it("uses a different set of weeks when startWeek moves on", () => {
    const a = simulateWeeks({ assets, depot, weeks: 2, seed: 5, startWeek: 0 });
    const b = simulateWeeks({ assets, depot, weeks: 2, seed: 5, startWeek: 2 });
    expect(b[0].week).toBe(2);
    expect(a[0].proposed).not.toEqual(b[0].proposed);
  });

  it("edits per plan fall once the rules that match the hidden preferences are approved", () => {
    const rules: Rule[] = [
      { id: "a", kind: "creek_first", boost: 0.3, text: "Creek-side GPTs first", status: "approved", enabled: true },
      {
        id: "b",
        kind: "drop_far_after_rain",
        maxDist: HIDDEN_PREFERENCES.farDist,
        text: "After heavy rain, skip far GPTs",
        status: "approved",
        enabled: true,
      },
    ];
    const without = summarise(simulateWeeks({ assets, depot, weeks: 12, seed: 9 }));
    const withRules = summarise(simulateWeeks({ assets, depot, weeks: 12, seed: 9, rules }));
    expect(withRules.editsPerPlan).toBeLessThan(without.editsPerPlan);
    expect(withRules.acceptanceRate).toBeGreaterThanOrEqual(without.acceptanceRate);
  });
});

describe("rollingAcceptance", () => {
  it("is the share of edit-free plans in the last weeks", () => {
    const w = (n: number) => ({ edits: Array.from({ length: n }) }) as never;
    expect(rollingAcceptance([w(2), w(0), w(0), w(1)], 2)).toEqual([0, 0.5, 1, 0.5]);
  });
});
