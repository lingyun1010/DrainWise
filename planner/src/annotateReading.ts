// Geometry for the annotated image: a circle on the changed region, an arrow pointing at it, a numbered caption.
// Pure, so it is easy to test; the web page draws it as an SVG over the image (the image itself is never edited).
import type { Box, ImageReading } from "./readImage";

export type Annotation = {
  circle: { cx: number; cy: number; r: number };
  arrow: { x1: number; y1: number; x2: number; y2: number }; // tail to head; the head touches the circle
  caption: { n: number; text: string };
};

export function captionFor(r: ImageReading): string {
  if (r.damage === "net_fallen") return "Net looks fallen off: the net shape sits away from its usual spot.";
  if (r.damage === "net_broken") return "Possible hole in the net.";
  if (r.band === null || !r.region) return "No change against the clean reference.";
  return `Net about ${r.bandLabel} full${r.needsCleaning ? " (at or past 70%)" : ""}. Changed area, not a measurement.`;
}

export function annotate(reading: ImageReading, size: { width: number; height: number }): Annotation | null {
  const b: Box | null = reading.region;
  if (!b) return null;
  const cx = (b[0] + b[2]) / 2;
  const cy = (b[1] + b[3]) / 2;
  const r = Math.max(24, Math.hypot(b[2] - b[0], b[3] - b[1]) / 2 + 10);
  // Arrow comes from the nearer horizontal side with more room, pointing at the circle edge.
  const fromLeft = cx > size.width / 2;
  const tx = Math.min(size.width - 10, Math.max(10, fromLeft ? cx - r - 90 : cx + r + 90));
  const ty = Math.max(30, cy - r - 60);
  const dx = cx - tx;
  const dy = cy - ty;
  const len = Math.hypot(dx, dy) || 1;
  return {
    circle: { cx, cy, r },
    arrow: { x1: tx, y1: ty, x2: cx - (dx / len) * r, y2: cy - (dy / len) * r },
    caption: { n: 1, text: captionFor(reading) },
  };
}
