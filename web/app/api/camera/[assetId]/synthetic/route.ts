// LOCAL ONLY: serves the synthetic image that the stored reading was made from (ticket 22).
// The images are not committed (they live in .local/, gitignored), so the public build has none and answers 404;
// the popup then shows the reading as text only. The file name comes from imageReadings.json, never from the request.
import { readFile } from "node:fs/promises";
import path from "node:path";
import readings from "@/lib/imageReadings.json";
import cameraReadings from "@/lib/cameraReadings.json";

export async function GET(_req: Request, ctx: { params: Promise<{ assetId: string }> }) {
  if (process.env.NEXT_PUBLIC_PUBLIC_BUILD === "1") return new Response("Not found", { status: 404 });
  const { assetId } = await ctx.params;
  const r = cameraReadings.readings.find((x) => x.asset_id === assetId);
  const cam = (readings.cameras as Record<string, { file: string }>)[`cam-0${r?.photo}`];
  if (!cam) return new Response("Not found", { status: 404 });
  const dir = process.env.SYNTHETIC_IMAGES_DIR ?? path.join(process.cwd(), "..", ".local", "synthetic-images");
  try {
    const bytes = await readFile(path.join(dir, path.basename(cam.file)));
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
