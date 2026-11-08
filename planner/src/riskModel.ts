// Runs the exported risk model (gradient-boosted trees) without a server. Mirrors risk_api/main.py:
// same feature order, same 60% / 30% cut-offs, same "swap one feature for its training mean" reasons.
// Trained on SIMULATED data (SAMPLE DATA). Regenerate the JSON with `python -m risk_api.export_model`.

export type Level = "low" | "medium" | "high";

export type AssetInput = {
  asset_id: string;
  type: string;
  canopy_pct: number;
  leaf_index: number;
  rain_mm_7d: number;
  rain_forecast_mm: number;
  days_since_clean: number;
  has_camera: boolean;
};

export type Score = { asset_id: string; p_block: number; level: Level; reasons: string[] };

export type TreeJson = { f: number[]; t: number[]; l: number[]; r: number[]; v: number[]; leaf: number[] };

export type ModelJson = {
  model_version: string;
  data_source: string;
  baseline: number;
  means: number[];
  reasons: Record<string, [string, string]>;
  trees: TreeJson[];
};

export const HIGH_AT = 0.6;
export const MEDIUM_AT = 0.3;
const MAX_REASONS = 3;

export function levelFor(p: number): Level {
  return p >= HIGH_AT ? "high" : p >= MEDIUM_AT ? "medium" : "low";
}

// Same order as ml/train.py FEATURES.
export function toVector(a: AssetInput): number[] {
  return [
    a.type === "gpt" ? 1 : 0,
    a.canopy_pct,
    a.leaf_index,
    a.rain_mm_7d,
    a.rain_forecast_mm,
    a.days_since_clean,
    a.has_camera ? 1 : 0,
  ];
}

function walk(tree: TreeJson, x: number[]): number {
  let i = 0;
  while (!tree.leaf[i]) i = x[tree.f[i]] <= tree.t[i] ? tree.l[i] : tree.r[i];
  return tree.v[i];
}

export function probability(model: ModelJson, x: number[]): number {
  let raw = model.baseline;
  for (const tree of model.trees) raw += walk(tree, x);
  return 1 / (1 + Math.exp(-raw));
}

function explain(model: ModelJson, x: number[], p: number, days: number): string[] {
  const deltas: [number, number][] = Object.keys(model.reasons).map((k) => {
    const i = Number(k);
    const swapped = x.slice();
    swapped[i] = model.means[i];
    return [p - probability(model, swapped), i];
  });
  // Largest drop first; ties break on the larger feature index, like Python's tuple sort.
  const byDelta = (m: [number, number], n: [number, number]) => n[0] - m[0] || n[1] - m[1];
  const raising = deltas
    .filter((d) => d[0] > 0)
    .sort(byDelta)
    .slice(0, MAX_REASONS);
  const picks: [number, 0 | 1][] = raising.length
    ? raising.map((d) => [d[1], 0])
    : [[deltas.reduce((lo, d) => (d[0] < lo[0] || (d[0] === lo[0] && d[1] < lo[1]) ? d : lo))[1], 1]];
  return picks.map(([i, k]) => model.reasons[String(i)][k].replace("{days}", String(days)));
}

export function predict(model: ModelJson, assets: AssetInput[]): Score[] {
  return assets.map((a) => {
    const x = toVector(a);
    const p = probability(model, x);
    return { asset_id: a.asset_id, p_block: p, level: levelFor(p), reasons: explain(model, x, p, a.days_since_clean) };
  });
}
