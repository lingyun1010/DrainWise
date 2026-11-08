// Latest real rain observation from a Bureau of Meteorology weather station (NSW observations, product IDN60920).
// BoM gives rain since 9am (mm), not a rate. Free text products are not for commercial use.

export type RainObs = {
  station: string;
  observedAt: string; // Sydney local time of the reading
  sinceLocal: string; // start of the rain total, usually 9am
  rainMm: number;
};

export function parseRainObs(xml: string, bomId: string): RainObs | null {
  const start = new RegExp(`<station [^>]*bom-id="${bomId}"[^>]*>`).exec(xml);
  if (!start) return null;
  const station = /stn-name="([^"]*)"/.exec(start[0])?.[1] ?? bomId;
  const block = xml.slice(start.index, xml.indexOf("</station>", start.index));
  const period = /<period ([^>]*)>([\s\S]*?)<\/period>/.exec(block);
  if (!period) return null;
  const observedAt = /time-local="([^"]*)"/.exec(period[1])?.[1] ?? "";
  const rain = /<element ([^>]*)type="rainfall">([^<]*)<\/element>/.exec(period[2]);
  if (!rain || rain[2].trim() === "" || Number.isNaN(Number(rain[2]))) return null;
  return {
    station: station
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\bAws\b/, "AWS"),
    observedAt,
    sinceLocal: /start-time-local="([^"]*)"/.exec(rain[1])?.[1] ?? "",
    rainMm: Number(rain[2]),
  };
}
