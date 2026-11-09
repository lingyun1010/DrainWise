import { describe, expect, it } from "vitest";
import { decideReport, isStorm, type LastSent } from "./reportRule";
import type { BomDay } from "./bomPrecis";

// Sydney is UTC+11 in November. Mon 9 Nov 2026 12:00 Sydney = 01:00 UTC.
const MON = new Date("2026-11-09T01:00:00Z");
const WED = new Date("2026-11-11T01:00:00Z");
const day = (date: string, popPct: number, highMm: number): BomDay => ({ date, precis: "", popPct, lowMm: 0, highMm });
const none: LastSent = { storm: null, weekly: null };
const stormTomorrow = (today: string) => [day(today, 20, 2), day(nextDay(today), 90, 50)];
const calmTomorrow = (today: string) => [day(today, 20, 2), day(nextDay(today), 10, 1)];
function nextDay(d: string) {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

describe("decideReport", () => {
  it("storm tomorrow gives the 1-day report", () => {
    const r = decideReport(WED, stormTomorrow("2026-11-11"), none);
    expect(r.kind).toBe("storm_1day");
    expect(r.reason).toMatch(/90% chance/);
  });
  it("no storm on the weekly day gives the 7-day report", () => {
    expect(decideReport(MON, calmTomorrow("2026-11-09"), none).kind).toBe("weekly_7day");
  });
  it("no storm and not the weekly day gives none", () => {
    const r = decideReport(WED, calmTomorrow("2026-11-11"), none);
    expect(r.kind).toBe("none");
    expect(r.reason).toMatch(/Mondays/);
  });
  it("a second storm report within 24 hours gives none", () => {
    const sent = new Date(WED.getTime() - 5 * 3_600_000).toISOString();
    expect(decideReport(WED, stormTomorrow("2026-11-11"), { ...none, storm: sent }).kind).toBe("none");
    const old = new Date(WED.getTime() - 25 * 3_600_000).toISOString();
    expect(decideReport(WED, stormTomorrow("2026-11-11"), { ...none, storm: old }).kind).toBe("storm_1day");
  });
  it("storm and weekly on the same day gives the storm report only", () => {
    expect(decideReport(MON, stormTomorrow("2026-11-09"), none).kind).toBe("storm_1day");
  });
  it("a storm report already sent today skips the weekly one", () => {
    const sent = new Date(MON.getTime() - 2 * 3_600_000).toISOString();
    expect(decideReport(MON, calmTomorrow("2026-11-09"), { ...none, storm: sent }).kind).toBe("none");
  });
  it("the weekly report is not sent twice in one week", () => {
    const sent = new Date(MON.getTime() - 2 * 86_400_000).toISOString();
    expect(decideReport(MON, calmTomorrow("2026-11-09"), { ...none, weekly: sent }).kind).toBe("none");
  });
  it("a missing forecast for tomorrow is treated as no storm", () => {
    expect(decideReport(MON, [], none).kind).toBe("weekly_7day");
  });
});

describe("isStorm", () => {
  it("needs both the chance and the amount (assumed thresholds)", () => {
    expect(isStorm(day("d", 60, 25))).toBe(true);
    expect(isStorm(day("d", 59, 80))).toBe(false);
    expect(isStorm(day("d", 90, 24))).toBe(false);
    expect(isStorm(undefined)).toBe(false);
  });
});
