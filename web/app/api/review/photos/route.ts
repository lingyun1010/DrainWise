// Lists stored crew BEFORE photos for the local review page. Same gate as the page.
import { connection } from "next/server";
import { listBeforePhotos, storageConfigured } from "@/lib/photoStore";
import { reviewEnabled } from "@/lib/review";

export async function GET() {
  await connection();
  if (!reviewEnabled()) return Response.json({ error: "not found" }, { status: 404 });
  if (!storageConfigured()) return Response.json({ error: "photo storage is not configured" }, { status: 503 });
  const photos = await listBeforePhotos();
  if (!photos) return Response.json({ error: "photo storage is not reachable" }, { status: 502 });
  return Response.json({
    photos: photos.map((p) => ({
      id: p.id,
      at: p.created_at,
      runId: p.run_id,
      stopId: p.stop_id,
      crewId: p.crew_id,
      suggested: p.suggested_level,
      confirmed: p.confirmed_level,
      confirmedAt: p.confirmed_at,
    })),
  });
}
