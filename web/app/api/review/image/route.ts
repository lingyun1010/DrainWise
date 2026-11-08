// Serves one local sample image to the review page. Same gate as the page: no key, no route.
import { connection } from "next/server";
import { parseSampleNumber, readSample, reviewEnabled } from "@/lib/review";

export async function GET(request: Request) {
  await connection(); // answer each request; never bake one image into the build
  if (!reviewEnabled()) return new Response("Not found", { status: 404 });
  const n = parseSampleNumber(new URL(request.url).searchParams.get("n"));
  if (n === null) return new Response("Bad request", { status: 400 });
  const image = await readSample(n);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
  });
}
