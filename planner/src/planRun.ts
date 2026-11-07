export type Asset = {
  id: string;
  type: "inlet" | "gpt";
  risk: number; // 0..1
  x: number;
  y: number;
  hasCamera: boolean;
};

export type Stop = { id: string; load: number; photosNeeded: boolean };
export type Plan = { stops: Stop[]; totalLoad: number };

// Demo placeholder load estimate (m3, made-up), not observed data.
function estimateLoad(a: Asset): number {
  const f = Math.min(1, a.risk * 1.3);
  return a.type === "gpt" ? 0.35 + 1.0 * f : 0.06 + 0.22 * f;
}

const UNITS_PER_M3 = 1000; // integer weights for the knapsack DP

// Exact 0/1 knapsack: maximise total risk within capacity. Loads are rounded UP
// to 0.001 m3 so the chosen set can never exceed the real capacity.
function selectStops(items: { asset: Asset; load: number }[], capacity: number): { asset: Asset; load: number }[] {
  const cap = Math.floor(capacity * UNITS_PER_M3 + 1e-6);
  const w = items.map((it) => Math.ceil(it.load * UNITS_PER_M3 - 1e-9));
  const n = items.length;
  const best: number[][] = Array.from({ length: n + 1 }, () => new Array(cap + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let c = 0; c <= cap; c++) {
      best[i][c] = best[i - 1][c];
      if (w[i - 1] <= c) {
        const v = best[i - 1][c - w[i - 1]] + items[i - 1].asset.risk;
        if (v > best[i][c] + 1e-12) best[i][c] = v;
      }
    }
  }
  const chosen: { asset: Asset; load: number }[] = [];
  let c = cap;
  for (let i = n; i >= 1; i--) {
    if (best[i][c] !== best[i - 1][c]) {
      chosen.push(items[i - 1]);
      c -= w[i - 1];
    }
  }
  return chosen.reverse();
}

// Nearest-neighbour from the depot; ties go to the higher-risk asset.
function orderByProximity<T extends { asset: Asset }>(items: T[], depot: { x: number; y: number }): T[] {
  const left = [...items].sort((a, b) => b.asset.risk - a.asset.risk);
  const out: T[] = [];
  let pos = depot;
  while (left.length > 0) {
    let bi = 0;
    let bd = Infinity;
    left.forEach((it, i) => {
      const d = Math.hypot(it.asset.x - pos.x, it.asset.y - pos.y);
      if (d < bd - 1e-12) {
        bd = d;
        bi = i;
      }
    });
    const [next] = left.splice(bi, 1);
    out.push(next);
    pos = next.asset;
  }
  return out;
}

export function planRun(assets: Asset[], capacity: number, depot = { x: 0, y: 0 }, minRisk = 0): Plan {
  const items = assets.filter((a) => a.risk >= minRisk).map((asset) => ({ asset, load: estimateLoad(asset) }));
  const stops = orderByProximity(selectStops(items, capacity), depot).map(({ asset, load }) => ({
    id: asset.id,
    load,
    photosNeeded: !asset.hasCamera,
  }));
  return { stops, totalLoad: stops.reduce((sum, s) => sum + s.load, 0) };
}
