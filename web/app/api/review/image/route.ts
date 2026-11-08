// Serves one local sample image to the review page. Same gate as the page: no key, no route.
import { connection } from "next/server";
import { readPhoto } from "@/lib/photoStore";
import { parseSampleNumber, readSample, reviewEnabled } from "@/lib/review";

export async function GET(request: Request) {
  await connection(); // answer each request; never bake one image into the build
  if (!reviewEnabled()) return new Response("Not found", { status: 404 });
  const params = new URL(request.url).searchParams;
  const photoId = params.get("id");
  const n = parseSampleNumber(params.get("n"));
  if (photoId === null && n === null) return new Response("Bad request", { status: 400 });
  // A stored crew photo (private bucket, read here with the server key) or one of the 7 local samples.
  const image = photoId !== null ? await readPhoto(photoId) : await readSample(n as number);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
  });
}
