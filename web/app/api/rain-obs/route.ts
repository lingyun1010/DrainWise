// Latest real rain reading near Parramatta from the Bureau of Meteorology (NSW observations IDN60920): rain since 9am at
// the Sydney Olympic Park automatic weather station. BoM updates it every 10 to 30 minutes, so it is kept for 10 minutes.
// Free text products are not for commercial use.
import { parseRainObs } from "../../../../planner/src/bomObs";

const FEED = "http://reg.bom.gov.au/fwo/IDN60920.xml";
const STATION_ID = "066212"; // Sydney Olympic Park AWS
const KEEP_MS = 10 * 60 * 1000;
let kept: { at: number; body: object } | null = null;

export async function GET() {
  const headers = { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600" };
  if (kept && Date.now() - kept.at < KEEP_MS) return Response.json(kept.body, { headers });
  try {
    const res = await fetch(FEED, {
      headers: { "User-Agent": "DrainWise-hackathon-prototype" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return Response.json({ error: `BoM returned ${res.status}` }, { status: 502 });
    const obs = parseRainObs(await res.text(), STATION_ID);
    if (!obs) return Response.json({ error: "BoM file had no rain reading for the station" }, { status: 502 });
    const body = {
      source: "Australian Government Bureau of Meteorology, NSW observations IDN60920",
      copyright: "http://www.bom.gov.au/other/copyright.shtml",
      fetchedAt: new Date().toISOString(),
      ...obs,
    };
    kept = { at: Date.now(), body };
    return Response.json(body, { headers });
  } catch {
    return Response.json({ error: "BoM observations are not reachable" }, { status: 502 });
  }
}
