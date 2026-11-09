// Real Bureau of Meteorology forecast for Parramatta (free NSW precis product IDN11060), fetched on the server and
// kept for an hour (see lib/bomForecast.ts) so the page and BoM are not hit on every request. Works on the public build too.
import { getBom } from "@/lib/bomForecast";

export async function GET() {
  const headers = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" };
  const r = await getBom();
  return r.ok ? Response.json(r.body, { headers }) : Response.json({ error: r.error }, { status: r.status });
}
