import { expect, it } from "vitest";
import { dayRainMm, parsePrecis, parseRange, sydneyDate } from "./bomPrecis";

// Trimmed copy of the real IDN11060 file (Parramatta, issued 2026-11-08).
const XML = `<product><amoc><issue-time-local tz="EDT">2026-11-08T21:50:17+11:00</issue-time-local></amoc>
<area aac="NSW_PT110" description="Parkes" type="location"><forecast-period index="0" start-time-local="2026-11-08T22:00:00+11:00"><text type="probability_of_precipitation">99%</text></forecast-period></area>
<area aac="NSW_PT111" description="Parramatta" type="location" parent-aac="NSW_PW005">
<forecast-period index="0" start-time-local="2026-11-08T22:00:00+11:00" end-time-local="2026-11-09T00:00:00+11:00">
<text type="precis">Partly cloudy.</text><text type="probability_of_precipitation">20%</text></forecast-period>
<forecast-period index="3" start-time-local="2026-11-11T00:00:00+11:00" end-time-local="2026-11-12T00:00:00+11:00">
<element type="precipitation_range">0 to 3 mm</element><element type="air_temperature_maximum" units="Celsius">29</element>
<text type="precis">Shower or two. Possible storm.</text><text type="probability_of_precipitation">60%</text></forecast-period>
</area></product>`;

it("reads only the asked location, with chance of rain and range", () => {
  const r = parsePrecis(XML, "Parramatta")!;
  expect(r.issuedAt).toBe("2026-11-08T21:50:17+11:00");
  expect(r.days).toEqual([
    { date: "2026-11-08", precis: "Partly cloudy.", popPct: 20, lowMm: null, highMm: null },
    { date: "2026-11-11", precis: "Shower or two. Possible storm.", popPct: 60, lowMm: 0, highMm: 3 },
  ]);
});

it("returns null for an unknown location", () => {
  expect(parsePrecis(XML, "Atlantis")).toBeNull();
});

it("parses the range forms BoM uses", () => {
  expect(parseRange("1 to 5 mm")).toEqual({ lowMm: 1, highMm: 5 });
  expect(parseRange("Less than 1 mm")).toEqual({ lowMm: 0, highMm: 1 });
  expect(parseRange(null)).toBeNull();
});

it("gives the model the middle of the range, and 0 when no range is given", () => {
  const r = parsePrecis(XML, "Parramatta")!;
  expect(dayRainMm(r.days[1])).toBe(1.5);
  expect(dayRainMm(r.days[0])).toBe(0);
  expect(dayRainMm(undefined)).toBeNull();
});

it("counts Sydney calendar days", () => {
  const now = new Date("2026-11-08T11:33:00Z"); // 22:33 in Sydney
  expect(sydneyDate(0, now)).toBe("2026-11-08");
  expect(sydneyDate(1, now)).toBe("2026-11-09");
  expect(sydneyDate(30, now)).toBe("2026-12-08");
});
