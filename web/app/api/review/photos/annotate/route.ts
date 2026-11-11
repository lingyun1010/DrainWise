// Saves the admin's own fullness band, damage, note and marks for one stored photo (ticket 29).
// No model is called. The values are the admin's; "source" says what they started from.
import { parseBand, parseDamage, parseNote, parseShapes } from "../../../../../../planner/src/annotations";
import { saveAdminReview } from "@/lib/photoStore";
import { reviewEnabled } from "@/lib/review";

const SOURCE = (v: unknown) => (v === "mock" || v === "reference-diff" || v === "admin" ? v : "admin");

export async function POST(request: Request) {
  if (!reviewEnabled()) return Response.json({ error: "not found" }, { status: 404 });
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const shapes = parseShapes(b?.shapes ?? []);
  const band = b?.band === null || b?.band === undefined ? null : parseBand(b.band);
  const damage = b?.damage === null || b?.damage === undefined ? null : parseDamage(b.damage);
  const bad =
    typeof b?.id !== "string" ||
    !shapes ||
    (b?.band != null && band === null) ||
    (b?.damage != null && damage === null);
  if (bad) return Response.json({ error: "bad request" }, { status: 400 });
  const ok = await saveAdminReview(b!.id as string, {
    band,
    damage,
    note: parseNote(b!.note),
    bandSource: band === null ? null : SOURCE(b!.bandSource),
    damageSource: damage === null ? null : SOURCE(b!.damageSource),
    shapes: shapes!,
  });
  return ok ? Response.json({ ok: true }) : Response.json({ error: "could not save the review" }, { status: 502 });
}
