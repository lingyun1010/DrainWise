// Real-world frame for the 2D map. Everything in the app still uses map units (800 x 500);
// this file maps those units to Parramatta lon/lat (Web Mercator, so they line up with the basemap tiles).
// Area: about 5.5 km wide, centred near Parramatta CBD. Asset and depot positions inside it are SAMPLE DATA.
import raw from "./parramattaWaterways.json";

export const MAP_W = 800;
export const MAP_H = 500;

const WEST = 150.975;
const EAST = 151.035;
const CENTER_LAT = -33.8155;

const rad = (d: number) => (d * Math.PI) / 180;
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + rad(lat) / 2));
const invMercY = (y: number) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;

const halfH = ((rad(EAST) - rad(WEST)) * (MAP_H / MAP_W)) / 2; // keeps the box at exactly 800:500 on screen
const cy = mercY(CENTER_LAT);
export const NORTH = invMercY(cy + halfH);
export const SOUTH = invMercY(cy - halfH);
export const BOUNDS: [[number, number], [number, number]] = [
  [WEST, SOUTH],
  [EAST, NORTH],
];

export function lonLatToXY(lon: number, lat: number): { x: number; y: number } {
  return {
    x: ((lon - WEST) / (EAST - WEST)) * MAP_W,
    y: ((mercY(NORTH) - mercY(lat)) / (mercY(NORTH) - mercY(SOUTH))) * MAP_H,
  };
}

// Metres per map unit (east-west, at the centre latitude).
export const METRES_PER_UNIT = ((((EAST - WEST) * Math.PI * 6378137) / 180) * Math.cos(rad(CENTER_LAT))) / MAP_W;

export type Waterway = { name: string; kind: string; pts: { x: number; y: number }[] };

export const WATERWAYS: Waterway[] = (raw.waterways as { name: string; kind: string; pts: number[][] }[]).map((w) => ({
  name: w.name,
  kind: w.kind,
  pts: w.pts.map(([lon, lat]) => lonLatToXY(lon, lat)),
}));

export const OSM_SOURCE = raw.source;

// Nearest mapped waterway to a point, in whole metres (rounded to 10 m). Sample positions, so the text says "about".
export function nearestWaterway(x: number, y: number): { name: string; metres: number } | null {
  let best: { name: string; d: number } | null = null;
  for (const w of WATERWAYS) {
    for (let i = 0; i < w.pts.length - 1; i++) {
      const a = w.pts[i];
      const b = w.pts[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
      const d = Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
      if (!best || d < best.d) best = { name: w.name, d };
    }
  }
  return best ? { name: best.name, metres: Math.max(10, Math.round((best.d * METRES_PER_UNIT) / 10) * 10) } : null;
}
