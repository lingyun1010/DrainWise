// When should a risk report go out? One pure rule, used by the Preview, the send route, the daily job and the tests.
// Owner rule (2026-11-11): the check runs once a day over the whole 7-day BoM forecast.
//   Default            -> ONE weekly report, at most every 7 days (the 7-day view).
//   Storm on any of the next 7 days -> a storm alert NOW, even if the weekly report went out yesterday, and again every
//                         day (24 h apart) until a run has been planned. Then the reminders stop.
// Reports go to the admin only. Nothing here sends anything to a crew; that is a manual step in the planner.
// Automatic sending needs a scheduler to call decideReport once a day (see /api/auto-report). The demo page can only preview.
import { sydneyDate, type BomDay } from "./bomPrecis";

// ASSUMPTION, not a council level: tomorrow counts as a storm when BoM gives a rain chance of at least
// STORM_MIN_CHANCE_PCT and the "25% chance of at least" amount reaches STORM_MIN_MM. Ask council on 13 Nov.
export const STORM_MIN_CHANCE_PCT = 60;
export const STORM_MIN_MM = 25;
export const STORM_COOLDOWN_HOURS = 24; // reminders go out once a day
export const WEEKLY_MIN_GAP_DAYS = 7; // one weekly report per 7 days
export const PLAN_COVERS_DAYS = 7; // a planned run silences storm reminders for this long
export const FORECAST_DAYS = 7; // today and the next 6 days

export type ReportKind = "storm_alert" | "weekly_7day";
export type LastSent = { storm: string | null; weekly: string | null }; // ISO timestamps of the last sends
export type Decision = { kind: ReportKind | "none"; reason: string; stormDate?: string };

export function isStorm(day: BomDay | undefined): boolean {
  return !!day && (day.popPct ?? 0) >= STORM_MIN_CHANCE_PCT && (day.highMm ?? 0) >= STORM_MIN_MM;
}

export function stormWords(day: BomDay | undefined): string {
  if (!day) return "no forecast for tomorrow";
  const chance = day.popPct === null ? "unknown chance" : `${day.popPct}% chance`;
  const mm = day.highMm === null ? "no rain range" : `up to ${day.highMm} mm (25% chance of at least that much)`;
  return `${chance} of rain, ${mm}`;
}

const hoursSince = (iso: string, now: Date) => (now.getTime() - new Date(iso).getTime()) / 3_600_000;

// lastPlanAt: when a run was last planned (ISO), or null. A plan made after the last alert stops the daily reminders.
export function decideReport(
  today: Date,
  forecast: readonly BomDay[],
  lastSent: LastSent,
  lastPlanAt: string | null = null,
): Decision {
  const window = Array.from({ length: FORECAST_DAYS }, (_, k) => sydneyDate(k, today));
  const storm = forecast.find((d) => window.includes(d.date) && isStorm(d));

  if (storm) {
    const planned =
      !!lastPlanAt &&
      hoursSince(lastPlanAt, today) < PLAN_COVERS_DAYS * 24 &&
      (!lastSent.storm || new Date(lastPlanAt) > new Date(lastSent.storm));
    if (planned) {
      return {
        kind: "none",
        reason: `Storm forecast for ${storm.date} (${stormWords(storm)}), but a run has been planned since the last alert, so no more reminders.`,
      };
    }
    if (lastSent.storm && hoursSince(lastSent.storm, today) < STORM_COOLDOWN_HOURS) {
      return {
        kind: "none",
        reason: `Storm forecast for ${storm.date} (${stormWords(storm)}). A reminder went out less than ${STORM_COOLDOWN_HOURS} hours ago; the next one is due tomorrow unless a run is planned.`,
      };
    }
    return {
      kind: "storm_alert",
      stormDate: storm.date,
      reason: `Storm forecast for ${storm.date}: ${stormWords(storm)}. No run is planned yet, so the alert goes out.`,
    };
  }

  if (lastSent.weekly && hoursSince(lastSent.weekly, today) < WEEKLY_MIN_GAP_DAYS * 24) {
    return {
      kind: "none",
      reason: `No storm in the next ${FORECAST_DAYS} days. The weekly report was sent in the last ${WEEKLY_MIN_GAP_DAYS} days.`,
    };
  }
  return {
    kind: "weekly_7day",
    reason: `No storm in the next ${FORECAST_DAYS} days. The weekly 7-day report is due.`,
  };
}
