// SAMPLE terrain for the 3D view. Procedural, not real elevation.
// Map units are 800 x 500 (same as the 2D map); world units are (x - 400) / 10, (y - 250) / 10.
// Later this file is the single place to swap in a LiDAR heightmap (ELVIS DEM) for Parramatta.

export const wx = (px: number) => (px - 400) / 10;
export const wz = (py: number) => (py - 250) / 10;

type P = [number, number];
const bez = (p0: P, p1: P, p2: P, p3: P, t: number): P => {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
};

// Same curve as CREEK in MapView: "M-10 270 C 120 215, 230 315, 370 255 S 610 190, 810 235".
// The S command mirrors the previous control point (230,315) about (370,255) -> (510,195).
export const CREEK_WORLD: P[] = (() => {
  const out: P[] = [];
  const seg = (a: P, b: P, c: P, d: P) => {
    for (let i = 0; i <= 60; i++) {
      const [x, y] = bez(a, b, c, d, i / 60);
      out.push([wx(x), wz(y)]);
    }
  };
  seg([-10, 270], [120, 215], [230, 315], [370, 255]);
  seg([370, 255], [510, 195], [610, 190], [810, 235]);
  return out;
})();

// Roads in map units: [x1, y1, x2, y2]. Same as the demo.
export const ROADS: [number, number, number, number][] = [
  [60, 70, 760, 100],
  [140, 0, 210, 500],
  [470, 0, 520, 500],
  [650, 0, 720, 500],
  [0, 410, 800, 380],
];

function distToCreek(x: number, z: number): number {
  let m = Infinity;
  for (const [cx, cz] of CREEK_WORLD) {
    const dx = x - cx;
    const dz = z - cz;
    const d = dx * dx + dz * dz;
    if (d < m) m = d;
  }
  return Math.sqrt(m);
}

/** Terrain height at a world position: low near the creek, rising away from it. */
export function heightAt(x: number, z: number): number {
  const d = Math.min(distToCreek(x, z), 30);
  return 0.35 + 0.055 * Math.pow(d, 1.3) + 0.22 * Math.sin(x * 0.35) * Math.cos(z * 0.3);
}

/** Illustrative water level (world units) from rain intensity (mm/h) and the extra-rain slider (0..100). */
export function waterLevel(rainMmH: number, extraPct: number): number {
  return 0.5 + (rainMmH / 31) * 1.25 + (extraPct / 100) * 1.1;
}
