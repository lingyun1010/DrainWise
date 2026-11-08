// Camera reading for one GPT, by its number (ticket 17). SAMPLE DATA: a precomputed mock level, no model call here.
// A real build would read the latest camera frame result from a store; this route is that seam.
import readings from "@/lib/cameraReadings.json";

export async function GET(_req: Request, ctx: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await ctx.params;
  const r = readings.readings.find((x) => x.asset_id === assetId);
  if (!r) return Response.json({ error: "no camera reading for this asset" }, { status: 404 });
  return Response.json(
    {
      ...r,
      image: `/camera/sample-${r.photo}.jpg`,
      thumb: `/camera/sample-${r.photo}-thumb.jpg`,
      level_source: readings.level_source,
      data_source: readings.data_source,
      generated_at: readings.generated_at,
    },
    { headers: { "Cache-Control": "public, s-maxage=300" } },
  );
}
