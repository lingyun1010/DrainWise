import { expect, it } from "vitest";
import { parseRainObs } from "./bomObs";

// Trimmed copy of the real IDN60920 file (Sydney Olympic Park AWS, 2026-11-08).
const XML = `<product>
<station wmo-id="94764" bom-id="066124" stn-name="PARRAMATTA NORTH (MASONS DRIVE)" type="Non-AWS"><period index="0" time-local="2026-11-08T09:00:00+11:00"><level><element type="rainfall">3.0</element></level></period></station>
<station wmo-id="95765" bom-id="066212" stn-name="SYDNEY OLYMPIC PARK AWS (ARCHERY CENTRE)" type="AWS">
<period index="0" time-utc="2026-11-08T11:40:00+00:00" time-local="2026-11-08T22:40:00+11:00"><level type="surface">
<element units="Celsius" type="air_temperature">15.1</element>
<element start-time-local="2026-11-08T09:00:00+11:00" end-time-local="2026-11-08T22:43:00+11:00" duration="823" units="mm" type="rainfall">0.4</element>
</level></period></station></product>`;

it("reads rain since 9am for the asked station only", () => {
  expect(parseRainObs(XML, "066212")).toEqual({
    station: "Sydney Olympic Park AWS (Archery Centre)",
    observedAt: "2026-11-08T22:40:00+11:00",
    sinceLocal: "2026-11-08T09:00:00+11:00",
    rainMm: 0.4,
  });
});

it("returns null for an unknown station", () => {
  expect(parseRainObs(XML, "000000")).toBeNull();
});

it("returns null when the station has no rain reading", () => {
  const empty = XML.replace('type="rainfall">0.4<', 'type="rainfall"><');
  expect(parseRainObs(empty, "066212")).toBeNull();
});
