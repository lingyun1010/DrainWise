// Camera reading for one GPT, by its number (ticket 17). SAMPLE DATA: a precomputed mock level, no model call here.
// A real build would read the latest camera frame result from a store; this route is that seam.
import readings from "@/lib/cameraReadings.json";
import imageReadings from "@/lib/imageReadings.json";

export async function GET(_req: Request, ctx: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await ctx.params;
  const r = readings.readings.find((x) => x.asset_id === assetId);
  if (!r) return Response.json({ error: "no camera reading for this asset" }, { status: 404 });
  // Ticket 22: the stored reference-diff reading of one synthetic image for this camera (cam = sample photo number).
  const cam = (imageReadings.cameras as Record<string, unknown>)[`cam-0${r.photo}`] ?? null;
  return Response.json(
    {
      ...r,
      image_reading: cam,
      image_reading_meta: {
        data_source: imageReadings.data_source,
        note: imageReadings.note,
        image_size: imageReadings.image_size,
        pipeline_check: imageReadings.pipeline_check,
      },
      image: `/camera/sample-${r.photo}.jpg`,
      level_source: readings.level_source,
      data_source: readings.data_source,
      generated_at: readings.generated_at,
    },
    { headers: { "Cache-Control": "public, s-maxage=300" } },
  );
}
