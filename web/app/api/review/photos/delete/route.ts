// Deletes one stored photo: the file, the row and the label with it.
import { deletePhoto } from "@/lib/photoStore";
import { reviewEnabled } from "@/lib/review";

export async function POST(request: Request) {
  if (!reviewEnabled()) return Response.json({ error: "not found" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  if (typeof body?.id !== "string") return Response.json({ error: "bad request" }, { status: 400 });
  const ok = await deletePhoto(body.id);
  return ok ? Response.json({ ok: true }) : Response.json({ error: "could not delete the photo" }, { status: 502 });
}
