import { describe, it, expect } from "vitest";
import { planRun, type Asset } from "./planRun";
import { applyRules, type Rule } from "./rules";

const gpt = (id: string, risk: number, over: Partial<Asset> = {}): Asset => ({
  id,
  type: "gpt",
  risk,
  x: 0,
  y: 0,
  hasCamera: false,
  ...over,
});

const creekFirst: Rule = {
  id: "r1",
  kind: "creek_first",
  boost: 0.3,
  text: "Creek-side GPTs first",
  enabled: true,
  status: "approved",
};
const dropFar: Rule = {
  id: "r2",
  kind: "drop_far_after_rain",
  maxDist: 100,
  text: "After heavy rain, skip far GPTs",
  enabled: true,
  status: "approved",
};

describe("applyRules", () => {
  it("returns the assets untouched when there are no rules", () => {
    const a = [gpt("G1", 0.5)];
    const out = applyRules(a, [], { heavyRain: true }, { x: 0, y: 0 });
    expect(out.assets).toEqual(a);
    expect(out.notes.size).toBe(0);
  });

  it("ignores rules that are rejected, proposed or switched off", () => {
    const a = [gpt("G1", 0.5, { nearCreek: true })];
    const rules: Rule[] = [
      { ...creekFirst, status: "rejected" },
      { ...creekFirst, id: "r3", status: "proposed" },
      { ...creekFirst, id: "r4", enabled: false },
    ];
    const out = applyRules(a, rules, { heavyRain: true }, { x: 0, y: 0 });
    expect(out.assets).toEqual(a);
    expect(out.notes.size).toBe(0);
  });

  it("boosts creek-side GPTs and records the rule", () => {
    const out = applyRules([gpt("C", 0.4, { nearCreek: true }), gpt("D", 0.4)], [creekFirst], {}, { x: 0, y: 0 });
    expect(out.assets.find((x) => x.id === "C")!.risk).toBeCloseTo(0.7);
    expect(out.assets.find((x) => x.id === "D")!.risk).toBeCloseTo(0.4);
    expect(out.notes.get("C")).toEqual(["Creek-side GPTs first"]);
  });

  it("caps the boosted risk at 1", () => {
    const out = applyRules([gpt("C", 0.9, { nearCreek: true })], [creekFirst], {}, { x: 0, y: 0 });
    expect(out.assets[0].risk).toBe(1);
  });

  it("drops far GPTs only when it is heavy rain", () => {
    const far = gpt("far", 0.9, { x: 300, y: 0 });
    const near = gpt("near", 0.5, { x: 10, y: 0 });
    const dry = applyRules([far, near], [dropFar], { heavyRain: false }, { x: 0, y: 0 });
    expect(dry.assets.map((x) => x.id)).toEqual(["far", "near"]);
    const wet = applyRules([far, near], [dropFar], { heavyRain: true }, { x: 0, y: 0 });
    expect(wet.assets.map((x) => x.id)).toEqual(["near"]);
    expect(wet.dropped.get("far")).toEqual(["After heavy rain, skip far GPTs"]);
  });
});

describe("planRun with rules", () => {
  const assets = [gpt("plain", 0.5, { x: 5 }), gpt("creek", 0.45, { x: 6, nearCreek: true })];

  it("gives exactly the old plan when no rules are passed", () => {
    expect(planRun(assets, 1.5, { x: 0, y: 0 }, 0, { rules: [], ctx: {} })).toEqual(
      planRun(assets, 1.5, { x: 0, y: 0 }),
    );
  });

  it("changes which stop is picked and says why", () => {
    const plan = planRun(assets, 1.0, { x: 0, y: 0 }, 0, { rules: [creekFirst], ctx: {} });
    expect(plan.stops.map((s) => s.id)).toEqual(["creek"]);
    expect(plan.stops[0].adjustedBy).toEqual(["Creek-side GPTs first"]);
  });

  it("never exceeds capacity with rules on", () => {
    const many = Array.from({ length: 8 }, (_, i) => gpt(`g${i}`, 0.6, { nearCreek: i % 2 === 0 }));
    const plan = planRun(many, 3, { x: 0, y: 0 }, 0, { rules: [creekFirst], ctx: {} });
    expect(plan.totalLoad).toBeLessThanOrEqual(3 + 1e-9);
  });
});
