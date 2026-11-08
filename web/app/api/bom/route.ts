// Real Bureau of Meteorology forecast for Parramatta (free NSW precis product IDN11060), fetched on the server and
// kept for an hour so the page and BoM are not hit on every request. Works on the public build too.
// Source: Australian Government Bureau of Meteorology. Free text products are not for commercial use.
import { parsePrecis } from "../../../../planner/src/bomPrecis";

const FEED = "http://reg.bom.gov.au/fwo/IDN11060.xml";
const AREA = "Parramatta";
const KEEP_MS = 60 * 60 * 1000;
let kept: { at: number; body: object } | null = null; // per server instance; the CDN header below covers the rest

export async function GET() {
  const headers = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" };
  if (kept && Date.now() - kept.at < KEEP_MS) return Response.json(kept.body, { headers });
  try {
    const res = await fetch(FEED, {
      headers: { "User-Agent": "DrainWise-hackathon-prototype" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return Response.json({ error: `BoM returned ${res.status}` }, { status: 502 });
    const parsed = parsePrecis(await res.text(), AREA);
    if (!parsed) return Response.json({ error: "BoM file had no forecast for Parramatta" }, { status: 502 });
    const body = {
      source: "Australian Government Bureau of Meteorology, precis forecast IDN11060",
      copyright: "http://www.bom.gov.au/other/copyright.shtml",
      area: AREA,
      fetchedAt: new Date().toISOString(),
      ...parsed,
    };
    kept = { at: Date.now(), body };
    return Response.json(body, { headers });
  } catch {
    return Response.json({ error: "BoM forecast is not reachable" }, { status: 502 });
  }
}
