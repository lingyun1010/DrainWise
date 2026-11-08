// Saves the level a person confirmed for one stored photo. The model's suggestion is stored beside it
// for comparison, but only the confirmed level counts as a label.
import { confirmPhoto } from "@/lib/photoStore";
import { reviewEnabled } from "@/lib/review";

const LEVEL = (v: unknown) => (v === 0 || v === 1 || v === 2 || v === 3 ? v : null);

export async function POST(request: Request) {
  if (!reviewEnabled()) return Response.json({ error: "not found" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    level?: unknown;
    suggested?: unknown;
  } | null;
  const level = LEVEL(body?.level);
  if (typeof body?.id !== "string" || level === null) return Response.json({ error: "bad request" }, { status: 400 });
  const ok = await confirmPhoto(body.id, level, LEVEL(body.suggested));
  return ok ? Response.json({ ok: true }) : Response.json({ error: "could not save the label" }, { status: 502 });
}
