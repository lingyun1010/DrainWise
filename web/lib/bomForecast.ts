// Server-side BoM precis forecast for Parramatta (IDN11060), kept for an hour. Used by /api/bom and the report routes.
// Source: Australian Government Bureau of Meteorology. Free text products are not for commercial use.
import { parsePrecis, type BomParsed } from "../../planner/src/bomPrecis";

const FEED = "http://reg.bom.gov.au/fwo/IDN11060.xml";
export const BOM_AREA = "Parramatta";
const KEEP_MS = 60 * 60 * 1000;
export type BomBody = BomParsed & { source: string; copyright: string; area: string; fetchedAt: string };
let kept: { at: number; body: BomBody } | null = null; // per server instance

export async function getBom(): Promise<{ ok: true; body: BomBody } | { ok: false; status: number; error: string }> {
  if (kept && Date.now() - kept.at < KEEP_MS) return { ok: true, body: kept.body };
  try {
    const res = await fetch(FEED, {
      headers: { "User-Agent": "DrainWise-hackathon-prototype" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { ok: false, status: 502, error: `BoM returned ${res.status}` };
    const parsed = parsePrecis(await res.text(), BOM_AREA);
    if (!parsed) return { ok: false, status: 502, error: "BoM file had no forecast for Parramatta" };
    const body: BomBody = {
      source: "Australian Government Bureau of Meteorology, precis forecast IDN11060",
      copyright: "http://www.bom.gov.au/other/copyright.shtml",
      area: BOM_AREA,
      fetchedAt: new Date().toISOString(),
      ...parsed,
    };
    kept = { at: Date.now(), body };
    return { ok: true, body };
  } catch {
    return { ok: false, status: 502, error: "BoM forecast is not reachable" };
  }
}
