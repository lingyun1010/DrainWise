// Reads one camera image against a clean reference image of the SAME camera (ticket 22).
// Pure function, no server and no model, so the public build can use it. PROTOTYPE, no accuracy claim:
// the changed-area fraction inside the net is a fullness PROXY, not a measurement.
// Fullness bands are for image reading only (10% steps). They are separate from the High / Medium / Low risk levels.

export type Pixels = { width: number; height: number; data: Uint8Array | Uint8ClampedArray }; // RGBA
export type Point = readonly [number, number];
export type Box = [number, number, number, number]; // x0, y0, x1, y1

export type Damage = "none" | "net_full" | "net_broken" | "net_fallen";

export type ImageReading = {
  band: number | null; // 0..9 (0 = 0-9%, 7 = 70-79%); null when the net is not in place
  bandLabel: string | null; // "70-79%"
  needsCleaning: boolean; // band 7 or higher, the owner's 70% line
  damage: Damage;
  region: Box | null; // changed region (where the circle and arrow point)
  changedFraction: number; // share of the net area that changed vs the reference
  confidence: number; // 0..1, a heuristic margin, not a probability
  unclear: boolean; // true when a human (or the optional hosted vision helper) should look first
  rationale: string;
};

export const BANDS = 10;
export const NEEDS_CLEANING_BAND = 7;
const DIFF_THRESHOLD = 34; // per-channel change (0-255) that counts as "changed"
const CELL = 8; // block size used to ignore single noisy pixels

export function bandLabel(band: number): string {
  return `${band * 10}-${band === BANDS - 1 ? 100 : band * 10 + 9}%`;
}

function bbox(poly: readonly Point[]): Box {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return [
    Math.floor(Math.min(...xs)),
    Math.floor(Math.min(...ys)),
    Math.ceil(Math.max(...xs)),
    Math.ceil(Math.max(...ys)),
  ];
}

function inPoly(x: number, y: number, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function gray(d: Uint8Array | Uint8ClampedArray, i: number): number {
  return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
}

// Global brightness change between the two images (daylight), from pixels away from the net.
function lightGain(ref: Pixels, today: Pixels, away: (x: number, y: number) => boolean): number {
  const ratios: number[] = [];
  for (let y = 0; y < ref.height; y += 5) {
    for (let x = 0; x < ref.width; x += 5) {
      if (!away(x, y)) continue;
      const i = (y * ref.width + x) * 4;
      const r = gray(ref.data, i);
      if (r > 25) ratios.push(gray(today.data, i) / r);
    }
  }
  if (ratios.length === 0) return 1;
  ratios.sort((a, b) => a - b);
  return ratios[Math.floor(ratios.length / 2)];
}

// 1 where the pixel changed (after removing the global light change), 0 otherwise.
function changeMap(ref: Pixels, today: Pixels, gain: number): Uint8Array {
  const out = new Uint8Array(ref.width * ref.height);
  for (let p = 0; p < out.length; p++) {
    const i = p * 4;
    let m = 0;
    for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(today.data[i + c] / gain - ref.data[i + c]));
    if (m > DIFF_THRESHOLD) out[p] = 1;
  }
  return out;
}

// Keep only 8x8 cells where more than a third of the pixels changed (drops sensor noise and thin lines).
function denoise(map: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(map.length);
  for (let cy = 0; cy < h; cy += CELL) {
    for (let cx = 0; cx < w; cx += CELL) {
      let n = 0;
      let total = 0;
      for (let y = cy; y < Math.min(h, cy + CELL); y++)
        for (let x = cx; x < Math.min(w, cx + CELL); x++) {
          n += map[y * w + x];
          total++;
        }
      if (n > total / 3) {
        for (let y = cy; y < Math.min(h, cy + CELL); y++)
          for (let x = cx; x < Math.min(w, cx + CELL); x++) out[y * w + x] = 1;
      }
    }
  }
  return out;
}

function boxOf(map: Uint8Array, w: number, area: (x: number, y: number) => boolean, box: Box): Box | null {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (let y = box[1]; y < box[3]; y++)
    for (let x = box[0]; x < box[2]; x++)
      if (map[y * w + x] && area(x, y)) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x + 1);
        y1 = Math.max(y1, y + 1);
      }
  return x0 === Infinity ? null : [x0, y0, x1, y1];
}

/**
 * Compare `today` with the clean `reference` of the same camera.
 * `net` is the hand-marked polygon where the net sits (pixel coordinates of the camera image).
 */
export function readImage(reference: Pixels, today: Pixels, net: readonly Point[]): ImageReading {
  const { width: w, height: h } = reference;
  if (today.width !== w || today.height !== h) throw new Error("reference and today must have the same size");
  const nb = bbox(net);
  const box: Box = [Math.max(0, nb[0]), Math.max(0, nb[1]), Math.min(w, nb[2]), Math.min(h, nb[3])];
  const mask = new Uint8Array(w * h);
  let netArea = 0;
  for (let y = box[1]; y < box[3]; y++)
    for (let x = box[0]; x < box[2]; x++)
      if (inPoly(x + 0.5, y + 0.5, net)) {
        mask[y * w + x] = 1;
        netArea++;
      }
  if (netArea === 0) throw new Error("net polygon is empty");
  const pad = 20;
  const gain = lightGain(
    reference,
    today,
    (x, y) => x < box[0] - pad || x > box[2] + pad || y < box[1] - pad || y > box[3] + pad,
  );
  const changed = denoise(changeMap(reference, today, gain), w, h);
  const inNet = (x: number, y: number) => mask[y * w + x] === 1;
  const outNet = (x: number, y: number) => mask[y * w + x] === 0;

  let inside = 0;
  let dark = 0; // changed pixels that are now very dark (a hole or an empty net spot)
  for (let y = box[1]; y < box[3]; y++)
    for (let x = box[0]; x < box[2]; x++) {
      const p = y * w + x;
      if (mask[p] && changed[p]) {
        inside++;
        if (gray(today.data, p * 4) / gain < 24) dark++;
      }
    }
  let outside = 0;
  for (let p = 0; p < changed.length; p++) if (changed[p] && !mask[p]) outside++;

  const insideFrac = inside / netArea;
  const outsideFrac = outside / netArea;
  const darkShare = inside ? dark / inside : 0;
  const darkFrac = dark / netArea;
  const full: Box = [0, 0, w, h];

  const base = { changedFraction: Math.round(insideFrac * 1000) / 1000 };

  // Net fallen: a lot changed OUTSIDE the net area (the net now sits somewhere else).
  if (outsideFrac > 0.25) {
    const region = boxOf(changed, w, outNet, full);
    return {
      ...base,
      band: null,
      bandLabel: null,
      needsCleaning: false,
      damage: "net_fallen",
      region,
      confidence: Math.round(Math.min(0.95, 0.5 + outsideFrac / 4) * 100) / 100,
      unclear: outsideFrac < 0.4,
      rationale:
        "The net area changed and a net-like shape now appears elsewhere in the image, so the net may have fallen off.",
    };
  }

  // Net broken: a compact dark patch (a hole) inside the net, not a fill from the bottom.
  const holeBox = boxOf(
    changed.map((v, p) => (v && gray(today.data, p * 4) / gain < 24 ? 1 : 0)) as unknown as Uint8Array,
    w,
    inNet,
    box,
  );
  if (darkFrac > 0.02 && darkShare > 0.35 && holeBox) {
    const holeArea = (holeBox[2] - holeBox[0]) * (holeBox[3] - holeBox[1]);
    const lowAnchored = holeBox[3] >= box[3] - 3 && holeArea / netArea > 0.5; // a dark fill from the bottom is not a hole
    if (!lowAnchored) {
      return {
        ...base,
        band: null,
        bandLabel: null,
        needsCleaning: false,
        damage: "net_broken",
        region: holeBox,
        confidence: Math.round(Math.min(0.9, 0.45 + darkFrac * 2) * 100) / 100,
        unclear: darkFrac < 0.05,
        rationale:
          "A dark patch inside the net area does not match the clean reference, so there may be a hole in the net.",
      };
    }
  }

  const region = boxOf(changed, w, inNet, box);
  if (insideFrac < 0.02 || !region) {
    return {
      ...base,
      band: 0,
      bandLabel: bandLabel(0),
      needsCleaning: false,
      damage: "none",
      region: null,
      confidence: Math.round(Math.min(0.95, 0.6 + (0.02 - insideFrac) * 10) * 100) / 100,
      unclear: false,
      rationale: "The net area matches the clean reference. Almost nothing has collected.",
    };
  }
  const band = Math.min(BANDS - 1, Math.floor(insideFrac * BANDS));
  // Confidence falls near a band edge (the proxy is only good to about +/- one band).
  const edge = Math.abs(insideFrac * BANDS - band - 0.5) / 0.5; // 0 at the middle, 1 at an edge
  const confidence = Math.round((0.75 - 0.35 * edge) * 100) / 100;
  const needsCleaning = band >= NEEDS_CLEANING_BAND;
  return {
    ...base,
    band,
    bandLabel: bandLabel(band),
    needsCleaning,
    damage: needsCleaning ? "net_full" : "none",
    region,
    confidence,
    unclear: edge > 0.8,
    rationale: `About ${Math.round(insideFrac * 100)}% of the net area differs from the clean reference, so the net looks ${bandLabel(band)} full${
      needsCleaning ? ", at or past the 70% cleaning line" : ""
    }. This is a proxy from the changed area, not a measurement.`,
  };
}
