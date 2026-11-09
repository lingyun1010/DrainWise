// Builds the report on the SERVER from the same inputs the page uses (seed GPTs, exported trees, BoM forecast), so what
// Preview shows is what Send sends and the client cannot put its own text in the mail. SAMPLE DATA throughout.
import { DAYS, DAY_RAIN_MM } from "../../planner/src/horizon";
import { dayRainMm, sydneyDate, type BomDay } from "../../planner/src/bomPrecis";
import { decideReport, stormWords, type Decision, type LastSent } from "../../planner/src/reportRule";
import { buildReport, scoreHorizon, type Report } from "../../planner/src/reportBuilder";
import type { ModelJson } from "../../planner/src/riskModel";
import riskModel from "@/lib/riskModel.json";
import { makeSeedAssets } from "@/lib/seed";
import { getBom } from "@/lib/bomForecast";

export type Force = "bom" | "storm" | "calm";
export const FORCES: readonly Force[] = ["bom", "storm", "calm"];
const LEAF = 60; // sample leaf-fall index, same default as the manager page

export type Preview = {
  decision: Decision;
  report: Report | null; // null when the rule says none
  forecastSource: string;
  tomorrow: string;
  forced: Force;
};

// Monday 9 Nov 2026 at noon Sydney is used for "calm" so the weekly path can be shown on any day.
const MONDAY_NOON = new Date("2026-11-09T01:00:00Z");

export async function previewReport(
  force: Force,
  lastSent: LastSent,
  now: Date = new Date(),
): Promise<{ ok: true; value: Preview } | { ok: false; status: number; error: string }> {
  let today = now;
  let days: BomDay[] = [];
  let source = "";
  if (force === "bom") {
    const bom = await getBom();
    if (!bom.ok) return bom;
    days = bom.body.days;
    source = `BoM precis forecast IDN11060 (Parramatta), fetched ${bom.body.fetchedAt}`;
  } else {
    // Demo override: tomorrow's forecast is made up, the other days are the sample rain. Send history is ignored.
    if (force === "calm") today = MONDAY_NOON;
    const t = sydneyDate(1, today);
    days = [
      {
        date: t,
        precis: "Demo override",
        popPct: force === "storm" ? 90 : 10,
        lowMm: force === "storm" ? 40 : 0,
        highMm: force === "storm" ? 80 : 1,
      },
    ];
    source = `Demo override: ${force === "storm" ? "storm" : "no storm (Monday)"} forced for tomorrow, not a BoM reading`;
    lastSent = { storm: null, weekly: null };
  }
  const decision = decideReport(today, days, lastSent);
  const tomorrow = days.find((d) => d.date === sydneyDate(1, today));
  const value: Preview = {
    decision,
    report: null,
    forecastSource: source,
    tomorrow: stormWords(tomorrow),
    forced: force,
  };
  if (decision.kind === "none") return { ok: true, value };

  const dayRain = DAYS.map((_, k) => {
    const d = days.find((x) => x.date === sydneyDate(k, today));
    return d ? (dayRainMm(d) ?? 0) : DAY_RAIN_MM[k];
  });
  const [first, last] = decision.kind === "storm_1day" ? [1, 1] : [0, 6];
  const rows = scoreHorizon(makeSeedAssets(), riskModel as unknown as ModelJson, dayRain, LEAF, first, last);
  const dateLabel = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", dateStyle: "full" }).format(today);
  value.report = buildReport(decision.kind, rows, dateLabel, decision.reason);
  return { ok: true, value };
}
