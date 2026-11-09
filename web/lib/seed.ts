// SAMPLE DATA: invented for the demo. Not real council assets. Every asset is a gross pollutant trap (GPT).
// Map units are 800 x 500 and cover a real area of Parramatta (see geo.ts).
import { WATERWAYS } from "./geo";

export type SeedAsset = {
  id: string; // display name, unique (GPT-001)
  type: "inlet" | "gpt";
  typeLabel: string;
  x: number; // 0..800 map units
  y: number; // 0..500
  canopyPct: number;
  daysSinceClean: number;
  hasCamera: boolean;
};

export const ASSET_COUNT = 36; // demo size; the real network is expected to be about 200 GPTs (later)

// Positions in the list (0-based) of the 7 camera GPTs, spread across the 36. Sample choice, not real camera sites.
export const CAMERA_INDEX = [2, 7, 12, 18, 23, 28, 33];

export const DEPOT = { x: 110, y: 400 };

export function makeSeedAssets(): SeedAsset[] {
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // Sample GPTs sit 20 to 100 m from a real creek or river line (OpenStreetMap), on either bank.
  // The positions are invented: they are not council assets.
  const segs = WATERWAYS.flatMap((w) =>
    w.pts.slice(1).map((b, i) => ({ a: w.pts[i], b, len: Math.hypot(b.x - w.pts[i].x, b.y - w.pts[i].y) })),
  ).filter((s) => s.len > 0);
  const total = segs.reduce((n, s) => n + s.len, 0);
  const pick = () => {
    let r = rnd() * total;
    for (const s of segs) {
      r -= s.len;
      if (r <= 0) return s;
    }
    return segs[segs.length - 1];
  };
  const out: SeedAsset[] = [];
  let tries = 0;
  while (out.length < ASSET_COUNT && tries++ < 50000) {
    const s = pick();
    const t = rnd();
    const nx = -(s.b.y - s.a.y) / s.len;
    const ny = (s.b.x - s.a.x) / s.len;
    const off = (rnd() < 0.5 ? -1 : 1) * (3 + rnd() * 11);
    const x = s.a.x + (s.b.x - s.a.x) * t + nx * off;
    const y = s.a.y + (s.b.y - s.a.y) * t + ny * off;
    if (x < 50 || x > 700 || y < 45 || y > 455 || (x < 150 && y > 380)) continue;
    if (out.some((q) => Math.abs(q.x - x) < 24 && Math.abs(q.y - y) < 24)) continue;
    rnd(); // discarded on purpose: keeps the random stream (and so every position) as before; cameras are set below
    out.push({
      id: "GPT-" + String(out.length + 1).padStart(3, "0"),
      type: "gpt",
      typeLabel: "Gross pollutant trap",
      x: Math.round(x),
      y: Math.round(y),
      canopyPct: Math.round(8 + rnd() * 62),
      daysSinceClean: Math.round(5 + rnd() * 170),
      hasCamera: false,
    });
  }
  // Owner decision 2026-11-09: exactly 7 of the 36 sample GPTs have a camera, one per council sample photo.
  // Camera k (k = 1..7, in GPT order) shows sample photo k, which is cam-0k in the synthetic images (ticket 21).
  for (const i of CAMERA_INDEX) if (out[i]) out[i].hasCamera = true;
  return out;
}
