// When should a risk report go out? One pure rule, used by the Preview, the send route and the tests.
// Owner rule (2026-11-09): the check runs once a day on the BoM forecast for TOMORROW.
//   Storm in the forecast  -> a 1-day report the day before (GPTs High at "Tomorrow").
//   No storm               -> ONE report per week with the 7-day view (any day Today to In 6 days at High).
// Automatic sending is for production (a scheduler would call decideReport once a day). The demo has no scheduler.
import { sydneyDate, type BomDay } from "./bomPrecis";

// ASSUMPTION, not a council level: tomorrow counts as a storm when BoM gives a rain chance of at least
// STORM_MIN_CHANCE_PCT and the "25% chance of at least" amount reaches STORM_MIN_MM. Ask council on 13 Nov.
export const STORM_MIN_CHANCE_PCT = 60;
export const STORM_MIN_MM = 25;
export const STORM_COOLDOWN_HOURS = 24; // at most one storm report per 24 hours
export const WEEKLY_WEEKDAY = 1; // Monday (0 = Sunday)
export const WEEKLY_MIN_GAP_DAYS = 6; // never two weekly reports in one week

export type ReportKind = "storm_1day" | "weekly_7day";
export type LastSent = { storm: string | null; weekly: string | null }; // ISO timestamps of the last sends
export type Decision = { kind: ReportKind | "none"; reason: string };

export function isStorm(day: BomDay | undefined): boolean {
  return !!day && (day.popPct ?? 0) >= STORM_MIN_CHANCE_PCT && (day.highMm ?? 0) >= STORM_MIN_MM;
}

export function stormWords(day: BomDay | undefined): string {
  if (!day) return "no forecast for tomorrow";
  const chance = day.popPct === null ? "unknown chance" : `${day.popPct}% chance`;
  const mm = day.highMm === null ? "no rain range" : `up to ${day.highMm} mm (25% chance of at least that much)`;
  return `${chance} of rain, ${mm}`;
}

// Sydney weekday of a date string, 0 = Sunday.
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

const hoursSince = (iso: string, now: Date) => (now.getTime() - new Date(iso).getTime()) / 3_600_000;

export function decideReport(today: Date, forecast: readonly BomDay[], lastSent: LastSent): Decision {
  const date = sydneyDate(0, today);
  const tomorrow = forecast.find((d) => d.date === sydneyDate(1, today));
  const stormSentToday = !!lastSent.storm && sydneyDate(0, new Date(lastSent.storm)) === date;

  if (isStorm(tomorrow)) {
    if (lastSent.storm && hoursSince(lastSent.storm, today) < STORM_COOLDOWN_HOURS) {
      return {
        kind: "none",
        reason: `Storm forecast for tomorrow (${stormWords(tomorrow)}), but a storm report went out less than ${STORM_COOLDOWN_HOURS} hours ago.`,
      };
    }
    return {
      kind: "storm_1day",
      reason: `Storm forecast for tomorrow: ${stormWords(tomorrow)}. Send the 1-day report.`,
    };
  }

  const calm = tomorrow
    ? `No storm forecast for tomorrow (${stormWords(tomorrow)}).`
    : "No forecast for tomorrow, so no storm.";
  if (weekdayOf(date) !== WEEKLY_WEEKDAY)
    return { kind: "none", reason: `${calm} The weekly report goes out on Mondays.` };
  if (stormSentToday)
    return {
      kind: "none",
      reason: `${calm} Monday, but a storm report already went out today, so the weekly one is skipped.`,
    };
  if (lastSent.weekly && hoursSince(lastSent.weekly, today) < WEEKLY_MIN_GAP_DAYS * 24) {
    return {
      kind: "none",
      reason: `${calm} The weekly report was already sent in the last ${WEEKLY_MIN_GAP_DAYS} days.`,
    };
  }
  return { kind: "weekly_7day", reason: `${calm} Monday, so the weekly 7-day report is due.` };
}
