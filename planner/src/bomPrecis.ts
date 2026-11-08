// Reads the Bureau of Meteorology "precis" forecast (product IDN11060, NSW) for one location.
// Real BoM data: daily rain chance and, when rain is expected, a rain range in mm. There is no 3-hourly rain in this free
// product. BoM explains the range as: first number = 75% chance of at least that much, second = 25% chance of at least that much.
// Source and terms: https://www.bom.gov.au/catalogue/data-feeds.shtml (free text products are not for commercial use).

export type BomDay = {
  date: string; // Sydney local date, YYYY-MM-DD
  precis: string;
  popPct: number | null; // chance of rain, percent
  lowMm: number | null; // 75% chance of at least this much
  highMm: number | null; // 25% chance of at least this much
};

export type BomParsed = { issuedAt: string; days: BomDay[] };

const attr = (tag: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1] ?? "";
const text = (body: string, type: string) => new RegExp(`<text type="${type}">([^<]*)</text>`).exec(body)?.[1] ?? null;
const element = (body: string, type: string) =>
  new RegExp(`<element type="${type}"[^>]*>([^<]*)</element>`).exec(body)?.[1] ?? null;

export function parseRange(s: string | null): { lowMm: number; highMm: number } | null {
  if (!s) return null;
  const to = /(\d+(?:\.\d+)?)\s*to\s*(\d+(?:\.\d+)?)\s*mm/i.exec(s);
  if (to) return { lowMm: +to[1], highMm: +to[2] };
  const less = /less than\s*(\d+(?:\.\d+)?)\s*mm/i.exec(s);
  if (less) return { lowMm: 0, highMm: +less[1] };
  return null;
}

export function parsePrecis(xml: string, areaName: string): BomParsed | null {
  const start = new RegExp(`<area [^>]*description="${areaName}"[^>]*type="location"[^>]*>`).exec(xml);
  if (!start) return null;
  const end = xml.indexOf("</area>", start.index);
  const area = xml.slice(start.index, end);
  const days: BomDay[] = [];
  for (const m of area.matchAll(/<forecast-period ([^>]*)>([\s\S]*?)<\/forecast-period>/g)) {
    const date = attr(m[1], "start-time-local").slice(0, 10);
    if (!date) continue;
    const pop = /^(\d+)%$/.exec(text(m[2], "probability_of_precipitation") ?? "");
    const range = parseRange(element(m[2], "precipitation_range"));
    days.push({
      date,
      precis: text(m[2], "precis") ?? "",
      popPct: pop ? +pop[1] : null,
      lowMm: range?.lowMm ?? null,
      highMm: range?.highMm ?? null,
    });
  }
  const issuedAt = /<issue-time-local[^>]*>([^<]*)</.exec(xml)?.[1] ?? "";
  return days.length ? { issuedAt, days } : null;
}

// One number for the model: the middle of the range. No range means BoM expects no measurable rain: 0 mm.
export function dayRainMm(d: BomDay | undefined): number | null {
  if (!d) return null;
  return d.lowMm === null || d.highMm === null ? 0 : (d.lowMm + d.highMm) / 2;
}

// Sydney calendar date (YYYY-MM-DD) plus n days.
export function sydneyDate(n: number, now: Date = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(now);
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
