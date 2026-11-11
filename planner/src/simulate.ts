import { planRun, type Asset } from "./planRun";
import type { Rule, RuleContext } from "./rules";

// SIMULATION. A made-up scheduler persona with two hidden preferences edits proposed plans.
// Not a real council officer and not observed data. Fixed seed, so every run is reproducible.
export const SIMULATION_LABEL = "Simulation, not a real council officer";

export const HIDDEN_PREFERENCES = {
  creek: "Creek-side GPTs go first",
  rain: "After heavy rain, no far GPTs",
  farDist: 400, // map units from the depot
  creekMinRisk: 0.15,
};

export type SimEdit = { action: "add" | "remove"; assetId: string; reason: string };
export type SimWeek = {
  simulation: typeof SIMULATION_LABEL;
  week: number;
  context: { heavyRain: boolean; capacity: number };
  proposed: string[];
  final: string[];
  finalLoad: number;
  edits: SimEdit[];
  rulesUsed: string[]; // texts of the approved rules that shaped the proposed plan
};

function rng(seed: number) {
  let s = (Math.abs(Math.trunc(seed)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// Sample flag: about a third of the GPTs count as creek-side (the sample GPTs are all near a creek, so this picks the closest ones).
export function markCreekSide(assets: Asset[]): Asset[] {
  return assets.map((a, i) => ({ ...a, nearCreek: i % 3 === 1 }));
}

const load = (a: Asset) => 0.35 + 1.0 * Math.min(1, a.risk * 1.3);

export function simulateWeeks(opts: {
  assets: Asset[];
  depot: { x: number; y: number };
  weeks: number;
  seed: number;
  startWeek?: number;
  capacity?: number;
  rules?: Rule[];
}): SimWeek[] {
  const { assets, depot, weeks, seed, startWeek = 0, capacity = 3, rules = [] } = opts;
  const out: SimWeek[] = [];
  for (let w = startWeek; w < startWeek + weeks; w++) {
    const r = rng(seed * 1009 + w * 7919);
    const ctx: RuleContext = { heavyRain: r() < 0.45 };
    const weekAssets = assets.map((a) => ({ ...a, risk: Math.min(1, Math.max(0, a.risk + (r() - 0.5) * 0.8 + 0.25)) }));
    const byId = new Map(weekAssets.map((a) => [a.id, a]));
    const proposed = planRun(weekAssets, capacity, depot, 0.1, { rules, ctx }).stops.map((s) => s.id);

    const final = [...proposed];
    const edits: SimEdit[] = [];
    const dist = (a: Asset) => Math.hypot(a.x - depot.x, a.y - depot.y);

    // Preference 1: after heavy rain, remove far GPTs.
    if (ctx.heavyRain) {
      for (const id of [...final]) {
        const a = byId.get(id)!;
        if (dist(a) > HIDDEN_PREFERENCES.farDist) {
          final.splice(final.indexOf(id), 1);
          edits.push({ action: "remove", assetId: id, reason: "Too far from the depot after heavy rain" });
        }
      }
    }
    // Preference 2: creek-side GPTs first. Swap in a missing creek-side GPT for the lowest-risk plain stop.
    const missing = weekAssets
      .filter((a) => a.nearCreek && a.risk >= HIDDEN_PREFERENCES.creekMinRisk && !final.includes(a.id))
      .filter((a) => !(ctx.heavyRain && dist(a) > HIDDEN_PREFERENCES.farDist))
      .sort((a, b) => b.risk - a.risk);
    for (const m of missing.slice(0, 2)) {
      const plain = final
        .map((id) => byId.get(id)!)
        .filter((a) => !a.nearCreek)
        .sort((a, b) => a.risk - b.risk)[0];
      if (!plain) break;
      const total = final.reduce((n, id) => n + load(byId.get(id)!), 0) - load(plain) + load(m);
      if (total > capacity + 1e-9) continue;
      final.splice(final.indexOf(plain.id), 1, m.id);
      edits.push({ action: "remove", assetId: plain.id, reason: "Creek-side GPT should go first" });
      edits.push({ action: "add", assetId: m.id, reason: "Creek-side GPT should go first" });
    }
    out.push({
      simulation: SIMULATION_LABEL,
      week: w,
      context: { heavyRain: ctx.heavyRain ?? false, capacity },
      proposed,
      final,
      finalLoad: final.reduce((n, id) => n + load(byId.get(id)!), 0),
      edits,
      rulesUsed: rules.filter((x) => x.status === "approved" && x.enabled).map((x) => x.text),
    });
  }
  return out;
}

export function summarise(weeks: SimWeek[]): { acceptanceRate: number; editsPerPlan: number } {
  if (weeks.length === 0) return { acceptanceRate: 0, editsPerPlan: 0 };
  return {
    acceptanceRate: weeks.filter((w) => w.edits.length === 0).length / weeks.length,
    editsPerPlan: weeks.reduce((n, w) => n + w.edits.length, 0) / weeks.length,
  };
}

// Acceptance over the last `window` weeks (a plan is accepted when the persona made no edit).
export function rollingAcceptance(weeks: SimWeek[], window = 4): number[] {
  return weeks.map((_, i) => {
    const slice = weeks.slice(Math.max(0, i - window + 1), i + 1);
    return slice.filter((w) => w.edits.length === 0).length / slice.length;
  });
}
