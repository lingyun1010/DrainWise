// Admin marks on a photo (ticket 29). Coordinates are normalised 0..1 of the image width and height,
// so a mark scales with the photo. Pure functions: the API route and the editor both use them.

export type Shape =
  | { id: string; kind: "circle"; x: number; y: number; r: number; caption: string }
  | { id: string; kind: "arrow"; x: number; y: number; x2: number; y2: number; caption: string };

export const DAMAGE = ["none", "net_full", "net_broken", "net_fallen"] as const;
export type Damage = (typeof DAMAGE)[number];
export type Source = "mock" | "reference-diff" | "admin";

export const MAX_SHAPES = 20;
export const MAX_CAPTION = 80;
export const MAX_NOTE = 300;

const unit = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;

function cleanText(v: unknown, max: number): string {
  return typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f]/g, " ")
        .trim()
        .slice(0, max)
    : "";
}

// Returns clean shapes, or null when the input is not an array of valid shapes (the route then answers 400).
export function parseShapes(raw: unknown): Shape[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_SHAPES) return null;
  const out: Shape[] = [];
  for (const s of raw as Record<string, unknown>[]) {
    if (!s || typeof s !== "object" || typeof s.id !== "string" || !/^[\w-]{1,40}$/.test(s.id)) return null;
    const caption = cleanText(s.caption, MAX_CAPTION);
    if (s.kind === "circle" && unit(s.x) && unit(s.y) && unit(s.r) && s.r > 0 && s.r <= 0.5) {
      out.push({ id: s.id, kind: "circle", x: s.x, y: s.y, r: s.r, caption });
    } else if (s.kind === "arrow" && unit(s.x) && unit(s.y) && unit(s.x2) && unit(s.y2)) {
      out.push({ id: s.id, kind: "arrow", x: s.x, y: s.y, x2: s.x2, y2: s.y2, caption });
    } else return null;
  }
  return out;
}

// Fullness band in 10% steps: 0, 10, ... 100.
export function parseBand(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 100 && v % 10 === 0 ? v : null;
}

export function parseDamage(v: unknown): Damage | null {
  return typeof v === "string" && (DAMAGE as readonly string[]).includes(v) ? (v as Damage) : null;
}

export function parseNote(v: unknown): string {
  return cleanText(v, MAX_NOTE);
}

// Source of a value: "admin" as soon as the admin changed it from the prefill.
export function sourceOf<T>(prefill: { value: T; source: Source }, current: T): Source {
  return current === prefill.value ? prefill.source : "admin";
}
