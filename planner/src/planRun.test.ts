import { describe, it, expect } from "vitest";
import { planRun, type Asset } from "./planRun";

// Load formula (demo placeholder, made-up estimates): inlet 0.06+0.22f, GPT 0.35+1.0f, f=min(1,1.3*risk)
const inlet = (id: string, risk: number): Asset => ({ id, type: "inlet", risk, x: 0, y: 0, hasCamera: false });
const gpt = (id: string, risk: number): Asset => ({ id, type: "gpt", risk, x: 0, y: 0, hasCamera: false });

describe("planRun", () => {
  it("never exceeds truck capacity, skipping a stop that does not fit", () => {
    // gpt at risk 1 => load 1.35 (> 1.0); each inlet at risk 1 => load 0.28
    const plan = planRun([gpt("G1", 1), inlet("A", 1), inlet("B", 1)], 1.0);
    expect(plan.stops.map((s) => s.id).sort()).toEqual(["A", "B"]);
    expect(plan.totalLoad).toBeCloseTo(0.56, 5);
  });

  it("picks higher-risk assets first when not everything fits", () => {
    // capacity 0.6: high 0.28 + mid 0.28 = 0.56 fits, low (0.1172) would push it to 0.677
    const plan = planRun([inlet("low", 0.2), inlet("high", 1), inlet("mid", 0.8)], 0.6);
    expect(plan.stops.map((s) => s.id)).toEqual(["high", "mid"]);
  });

  it("marks camera sites as no photos and others as photos needed", () => {
    const cam: Asset = { ...inlet("cam", 1), hasCamera: true };
    const plan = planRun([cam, inlet("plain", 0.9)], 2.0);
    expect(plan.stops.map((s) => [s.id, s.photosNeeded])).toEqual([
      ["cam", false],
      ["plain", true],
    ]);
  });

  it("chooses the stop set with the highest total risk, not just the riskiest stop first", () => {
    // capacity 1.5. gpt risk 0.7 => load 1.26. inlet risk 0.65 => load 0.06+0.22*0.845=0.2459 each.
    // Taking the gpt first leaves 0.24 (no inlet fits): total risk 0.7.
    // Six inlets cost 1.4754 and carry total risk 3.9.
    const inlets = ["i1", "i2", "i3", "i4", "i5", "i6"].map((id) => inlet(id, 0.65));
    const plan = planRun([gpt("G", 0.7), ...inlets], 1.5);
    expect(plan.stops.map((s) => s.id).sort()).toEqual(["i1", "i2", "i3", "i4", "i5", "i6"]);
  });

  it("orders the chosen stops by nearest-neighbour from the depot", () => {
    const at = (id: string, x: number, risk: number): Asset => ({ ...inlet(id, risk), x });
    // depot at (0,0); capacity is ample so all three are chosen
    const plan = planRun([at("far", 10, 0.9), at("near", 1, 0.8), at("mid", 5, 0.7)], 2.0);
    expect(plan.stops.map((s) => s.id)).toEqual(["near", "mid", "far"]);
  });

  it("leaves out assets below the minimum risk even when capacity allows", () => {
    const plan = planRun([inlet("low", 0.1), inlet("edge", 0.3), inlet("high", 0.9)], 4.0, { x: 0, y: 0 }, 0.3);
    expect(plan.stops.map((s) => s.id).sort()).toEqual(["edge", "high"]);
  });
});
