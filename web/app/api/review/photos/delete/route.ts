// Deletes one stored photo: the file, the row and the label with it. For a before photo, withAfter (default
// true) also deletes the after photo of the same job so no half-deleted job is left. Run records stay.
import { deletePhoto } from "@/lib/photoStore";
import { reviewEnabled } from "@/lib/review";

export async function POST(request: Request) {
  if (!reviewEnabled()) return Response.json({ error: "not found" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { id?: unknown; withAfter?: unknown } | null;
  if (typeof body?.id !== "string") return Response.json({ error: "bad request" }, { status: 400 });
  const res = await deletePhoto(body.id, body.withAfter !== false);
  if (res.ok) return Response.json({ ok: true, before: res.before, after: res.after });
  if (res.reason === "not_found") return Response.json({ error: "photo not found" }, { status: 404 });
  return Response.json({ error: "could not delete the photo" }, { status: 502 });
}
