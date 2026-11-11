import { describe, expect, it } from "vitest";
import { decideReport, isStorm, type LastSent } from "./reportRule";
import type { BomDay } from "./bomPrecis";

// Sydney is UTC+11 in November. Wed 11 Nov 2026 12:00 Sydney = 01:00 UTC.
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

const iso = (d: Date, hoursAgo: number) => new Date(d.getTime() - hoursAgo * 3_600_000).toISOString();
// Forecast with a calm today and tomorrow and a storm on day 6 (the seventh day).
const stormDay6 = (today: string) => {
  const days = [day(today, 10, 1)];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    days.push(day(d.toISOString().slice(0, 10), i === 6 ? 90 : 10, i === 6 ? 60 : 1));
  }
  return days;
};

describe("decideReport", () => {
  it("storm tomorrow gives a storm alert", () => {
    const r = decideReport(WED, stormTomorrow("2026-11-11"), none);
    expect(r.kind).toBe("storm_alert");
    expect(r.reason).toMatch(/90% chance/);
    expect(r.stormDate).toBe("2026-11-12");
  });
  it("a storm on the seventh day also gives a storm alert, even if the weekly report went out yesterday", () => {
    const weeklyYesterday = iso(WED, 24);
    const r = decideReport(WED, stormDay6("2026-11-11"), { ...none, weekly: weeklyYesterday });
    expect(r.kind).toBe("storm_alert");
    expect(r.stormDate).toBe("2026-11-17");
  });
  it("a storm after the 7-day window is ignored", () => {
    const days = [...stormDay6("2026-11-11"), day("2026-11-18", 95, 90)].map((d) =>
      d.date === "2026-11-17" ? day(d.date, 10, 1) : d,
    );
    expect(decideReport(WED, days, none).kind).toBe("weekly_7day");
  });
  it("no storm and nothing sent yet gives the weekly report", () => {
    expect(decideReport(WED, calmTomorrow("2026-11-11"), none).kind).toBe("weekly_7day");
  });
  it("the weekly report is not sent again within 7 days, but is on day 7", () => {
    expect(decideReport(WED, calmTomorrow("2026-11-11"), { ...none, weekly: iso(WED, 6 * 24) }).kind).toBe("none");
    expect(decideReport(WED, calmTomorrow("2026-11-11"), { ...none, weekly: iso(WED, 7 * 24 + 1) }).kind).toBe(
      "weekly_7day",
    );
  });
  it("storm reminders repeat every day while no run is planned", () => {
    expect(decideReport(WED, stormTomorrow("2026-11-11"), { ...none, storm: iso(WED, 5) }).kind).toBe("none");
    expect(decideReport(WED, stormTomorrow("2026-11-11"), { ...none, storm: iso(WED, 25) }).kind).toBe("storm_alert");
  });
  it("a run planned after the last alert stops the reminders", () => {
    const sent = { ...none, storm: iso(WED, 26) };
    expect(decideReport(WED, stormTomorrow("2026-11-11"), sent, iso(WED, 2)).kind).toBe("none");
    // A plan made before the alert does not count.
    expect(decideReport(WED, stormTomorrow("2026-11-11"), sent, iso(WED, 30)).kind).toBe("storm_alert");
  });
  it("a plan more than 7 days old does not silence a new storm", () => {
    const sent = { ...none, storm: iso(WED, 10 * 24) };
    expect(decideReport(WED, stormTomorrow("2026-11-11"), sent, iso(WED, 9 * 24)).kind).toBe("storm_alert");
  });
  it("a missing forecast is treated as no storm", () => {
    expect(decideReport(WED, [], none).kind).toBe("weekly_7day");
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
