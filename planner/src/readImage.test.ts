import { describe, expect, it } from "vitest";
import { annotate } from "./annotateReading";
import { bandLabel, readImage, type Pixels, type Point } from "./readImage";
import { parseSuggestion } from "./parseSuggestion";

// Small stand-in images made in the test (no council photos): textured grey ground, a dark mesh net polygon.
const W = 160;
const H = 120;
const NET: Point[] = [
  [40, 30],
  [100, 30],
  [100, 90],
  [40, 90],
];
const inNet = (x: number, y: number) => x >= 40 && x < 100 && y >= 30 && y < 90;

function noise(x: number, y: number, s: number): number {
  const v = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}
function px(fn: (x: number, y: number) => [number, number, number], light = 1, seed = 1): Pixels {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [r, g, b] = fn(x, y);
      const n = noise(x, y, seed) * 2;
      const i = (y * W + x) * 4;
      data[i] = r * light + n;
      data[i + 1] = g * light + n;
      data[i + 2] = b * light + n;
      data[i + 3] = 255;
    }
  return { width: W, height: H, data };
}
const ground = (x: number, y: number): [number, number, number] => [110 + (x % 7) * 4, 120 + (y % 5) * 3, 100];
const mesh = (x: number, y: number): [number, number, number] =>
  inNet(x, y) ? ((x + y) % 8 === 0 ? [150, 155, 150] : [40, 45, 40]) : ground(x, y);
const reference = px(mesh);

// Debris (bright leaves) fills the net from the bottom up to `fullness`.
function withDebris(fullness: number, light = 1): Pixels {
  const top = 90 - fullness * 60;
  return px((x, y) => (inNet(x, y) && y >= top ? [170 + (x % 5) * 6, 120, 40] : mesh(x, y)), light, 2);
}

describe("readImage (stand-in images, a pipeline check, not accuracy)", () => {
  it("says nothing changed for a clean net, even if the light is different", () => {
    const r = readImage(reference, px(mesh, 1.08, 3), NET);
    expect(r.damage).toBe("none");
    expect(r.band).toBe(0);
    expect(r.region).toBeNull();
  });

  it.each([0.15, 0.35, 0.55, 0.75, 0.95])("puts fullness %f within one band", (f) => {
    const r = readImage(reference, withDebris(f), NET);
    expect(r.band).not.toBeNull();
    expect(Math.abs(r.band! - Math.min(9, Math.floor(f * 10)))).toBeLessThanOrEqual(1);
  });

  it("flags needs-cleaning from band 7 and calls it net_full", () => {
    const r = readImage(reference, withDebris(0.78), NET);
    expect(r.needsCleaning).toBe(true);
    expect(r.damage).toBe("net_full");
    expect(r.region).not.toBeNull();
  });

  it("copes with a different light level", () => {
    const r = readImage(reference, withDebris(0.55, 0.9), NET);
    expect(Math.abs(r.band! - 5)).toBeLessThanOrEqual(1);
  });

  it("reads a dark hole as net_broken and points at it", () => {
    const hole = px((x, y) => (x >= 55 && x < 75 && y >= 45 && y < 65 ? [10, 10, 10] : mesh(x, y)), 1, 4);
    const r = readImage(reference, hole, NET);
    expect(r.damage).toBe("net_broken");
    expect(r.region![0]).toBeGreaterThanOrEqual(50);
    expect(r.region![2]).toBeLessThanOrEqual(80);
  });

  it("reads a net moved away as net_fallen", () => {
    const moved = px(
      (x, y) => {
        if (inNet(x, y)) return [12, 12, 12];
        if (x >= 105 && x < 150 && y >= 50 && y < 110) return (x + y) % 8 === 0 ? [150, 155, 150] : [40, 45, 40];
        return ground(x, y);
      },
      1,
      5,
    );
    const r = readImage(reference, moved, NET);
    expect(r.damage).toBe("net_fallen");
    expect(r.band).toBeNull();
    expect(r.region![0]).toBeGreaterThanOrEqual(100);
  });

  it("does not call a change outside the net a fallen net", () => {
    const passer = px((x, y) => (x >= 105 && x < 150 && y >= 50 && y < 110 ? [200, 30, 30] : mesh(x, y)), 1, 7);
    const r = readImage(reference, passer, NET);
    expect(r.damage).not.toBe("net_fallen");
  });

  it("rejects images of different size and empty nets", () => {
    expect(() => readImage(reference, { ...reference, width: 10 }, NET)).toThrow();
    expect(() =>
      readImage(reference, reference, [
        [500, 500],
        [510, 500],
        [510, 510],
      ]),
    ).toThrow();
  });

  it("labels bands in 10% steps", () => {
    expect(bandLabel(7)).toBe("70-79%");
    expect(bandLabel(9)).toBe("90-100%");
  });
});

describe("annotate", () => {
  it("draws a circle round the region and an arrow that ends on the circle", () => {
    const r = readImage(reference, withDebris(0.8), NET);
    const a = annotate(r, { width: W, height: H })!;
    const [x0, y0, x1, y1] = r.region!;
    expect(a.circle.cx).toBeCloseTo((x0 + x1) / 2);
    expect(a.circle.cy).toBeCloseTo((y0 + y1) / 2);
    expect(Math.hypot(a.arrow.x2 - a.circle.cx, a.arrow.y2 - a.circle.cy)).toBeCloseTo(a.circle.r);
    expect(a.caption.n).toBe(1);
    expect(a.caption.text).toMatch(/\d+-\d+%/);
  });
  it("returns nothing when no region changed", () => {
    expect(annotate(readImage(reference, px(mesh, 1, 6), NET), { width: W, height: H })).toBeNull();
  });
});

describe("compatibility with parseSuggestion", () => {
  it("a reading maps to a suggestion that parseSuggestion accepts", () => {
    const r = readImage(reference, withDebris(0.8), NET);
    const level = r.band! >= 7 ? 3 : r.band! >= 4 ? 2 : r.band! >= 1 ? 1 : 0;
    const p = parseSuggestion(JSON.stringify({ level, confidence: r.confidence, rationale: r.rationale }));
    expect(p.ok).toBe(true);
  });
});
