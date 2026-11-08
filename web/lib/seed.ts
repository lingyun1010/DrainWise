// SAMPLE DATA: invented for the demo. Not real council assets. Every asset is a gross pollutant trap (GPT).
// Same generator and map units (800 x 500) as reference/demo-Main.dc.html so the map matches.
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

export const DEPOT = { x: 70, y: 445 };

export function makeSeedAssets(): SeedAsset[] {
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const cx = [0, 120, 240, 370, 490, 610, 800];
  const cy = [262, 248, 282, 255, 222, 205, 232];
  const creekY = (x: number) => {
    for (let i = 0; i < cx.length - 1; i++) {
      if (x <= cx[i + 1]) {
        const f = (x - cx[i]) / (cx[i + 1] - cx[i]);
        return cy[i] + (cy[i + 1] - cy[i]) * f;
      }
    }
    return cy[cy.length - 1];
  };
  const out: SeedAsset[] = [];
  let tries = 0;
  while (out.length < ASSET_COUNT && tries++ < 50000) {
    const x = 50 + rnd() * 700;
    const y = creekY(x) + (rnd() < 0.5 ? -1 : 1) * (18 + rnd() * 105);
    if (y < 45 || y > 470 || (x < 150 && y > 380)) continue;
    if (out.some((q) => Math.abs(q.x - x) < 30 && Math.abs(q.y - y) < 30)) continue;
    const cam = rnd() < 0.3; // only some sites have a camera
    out.push({
      id: "GPT-" + String(out.length + 1).padStart(3, "0"),
      type: "gpt",
      typeLabel: "Gross pollutant trap",
      x: Math.round(x),
      y: Math.round(y),
      canopyPct: Math.round(8 + rnd() * 62),
      daysSinceClean: Math.round(5 + rnd() * 170),
      hasCamera: cam,
    });
  }
  return out;
}
