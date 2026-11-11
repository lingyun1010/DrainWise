// Photos waiting for an admin (ticket 29): feeds the Manager bell and the Records badge. Polled.
import { connection } from "next/server";
import { listUnreviewed, storageConfigured } from "@/lib/photoStore";
import { reviewEnabled } from "@/lib/review";

export async function GET() {
  await connection();
  if (!reviewEnabled()) return Response.json({ error: "not found" }, { status: 404 });
  if (!storageConfigured()) return Response.json({ items: [] }); // no storage, nothing can arrive
  const rows = await listUnreviewed();
  if (!rows) return Response.json({ error: "photo storage is not reachable" }, { status: 502 });
  return Response.json({
    items: rows.map((p) => ({ id: p.id, at: p.created_at, assetId: p.asset_id, crewId: p.crew_id, runId: p.run_id })),
  });
}
