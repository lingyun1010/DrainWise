// Asks the vision model for a blockage level for one sample image. Server only; a suggestion is
// never stored here and is never a label until a person confirms it on the review page.
import { parseSampleNumber, readSample, reviewEnabled, suggestLevel } from "@/lib/review";

export async function POST(request: Request) {
  if (!reviewEnabled()) return Response.json({ error: "not found" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { n?: unknown } | null;
  const n = parseSampleNumber(body?.n);
  if (n === null) return Response.json({ error: "bad image number" }, { status: 400 });
  const image = await readSample(n);
  if (!image) return Response.json({ error: "sample image not found" }, { status: 404 });
  const result = await suggestLevel(image);
  return result.ok ? Response.json(result.suggestion) : Response.json({ error: result.error }, { status: 502 });
}
