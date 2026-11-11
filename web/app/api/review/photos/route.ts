// Lists stored crew BEFORE photos for the local review page. Same gate as the page.
import { connection } from "next/server";
import { jobKey } from "../../../../../planner/src/photoPairs";
import { afterCountsByJob, listBeforePhotos, storageConfigured } from "@/lib/photoStore";
import { reviewEnabled } from "@/lib/review";

export async function GET() {
  await connection();
  if (!reviewEnabled()) return Response.json({ error: "not found" }, { status: 404 });
  if (!storageConfigured()) return Response.json({ error: "photo storage is not configured" }, { status: 503 });
  const photos = await listBeforePhotos();
  if (!photos) return Response.json({ error: "photo storage is not reachable" }, { status: 502 });
  const afters = await afterCountsByJob(); // null if that lookup failed: the dialog then says it is unknown
  return Response.json({
    photos: photos.map((p) => ({
      afterCount: afters ? (afters.get(jobKey(p.run_id, p.stop_id)) ?? 0) : null,
      id: p.id,
      at: p.created_at,
      runId: p.run_id,
      stopId: p.stop_id,
      crewId: p.crew_id,
      suggested: p.suggested_level,
      confirmed: p.confirmed_level,
      confirmedAt: p.confirmed_at,
      reviewedAt: p.reviewed_at,
      band: p.admin_band,
      damage: p.admin_damage,
      note: p.admin_note ?? "",
      bandSource: p.band_source,
      damageSource: p.damage_source,
      shapes: Array.isArray(p.annotations) ? p.annotations : [],
    })),
  });
}
