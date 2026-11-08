// Receives one crew photo (already a small JPEG made in the browser) and stores it in the private
// DrainWise bucket. Works on the public demo too, so it checks everything itself: type, size,
// ids, a per-client limit and a hard cap on stored photos. Public uploads expire after 24 hours.
import { allowRequest, checkPhotoBytes, cleanId, expiryFor, parseKind } from "../../../../planner/src/photoUpload";
import { deleteExpired, savePhoto, storageConfigured } from "@/lib/photoStore";

const hits = new Map<string, number[]>();

export async function POST(request: Request) {
  if (!storageConfigured()) return Response.json({ error: "photo storage is not configured" }, { status: 503 });

  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest(hits, client, Date.now())) {
    return Response.json({ error: "too many photos, try again later" }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "expected form data" }, { status: 400 });
  const file = form.get("file");
  const runId = cleanId(form.get("runId"));
  const stopId = cleanId(form.get("stopId"));
  const assetId = cleanId(form.get("assetId"));
  const crewId = cleanId(form.get("crewId"));
  const kind = parseKind(form.get("kind"));
  if (!(file instanceof Blob) || !runId || !stopId || !assetId || !crewId || !kind) {
    return Response.json({ error: "missing or invalid field" }, { status: 400 });
  }
  if (file.size > 4 * 1024 * 1024) return Response.json({ error: "photo is larger than 3 MB" }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkPhotoBytes(bytes);
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  await deleteExpired(); // cheap clean-up on every upload; the daily cron covers quiet days
  const isPublic = process.env.NEXT_PUBLIC_PUBLIC_BUILD === "1";
  const saved = await savePhoto(
    { runId, stopId, assetId, crewId, kind, expiresAt: expiryFor(Date.now(), isPublic) },
    bytes,
  );
  return saved.ok ? Response.json({ id: saved.id }) : Response.json({ error: saved.error }, { status: saved.status });
}
