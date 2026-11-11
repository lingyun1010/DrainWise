// The email a manager sends BY HAND to a crew with the planned run. Pure: same inputs, same text.
// The server rebuilds it from GPT ids it knows, so the browser cannot put its own text in the mail.
// Never sent automatically: only the admin (with the admin key) triggers it from the planner.
export type PlanEmailStop = { id: string; hasCamera: boolean };

export const MAX_PLAN_STOPS = 30;

// null when the list is fine, else why not. knownIds are the GPT ids the server has.
export function checkStopIds(raw: unknown, knownIds: ReadonlySet<string>): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_PLAN_STOPS) return null;
  if (!raw.every((x): x is string => typeof x === "string" && knownIds.has(x))) return null;
  return new Set(raw).size === raw.length ? raw : null;
}

export function clampCapacity(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 3;
  return Math.min(4, Math.max(1, Math.round(n * 2) / 2));
}

export function buildPlanEmail(
  stops: readonly PlanEmailStop[],
  capacity: number,
  dateLabel: string,
): { subject: string; body: string } {
  const subject = `[Sample data] Run plan: ${stops.length} stop${stops.length === 1 ? "" : "s"}`;
  const lines = [
    "Demo with sample data. DrainWise is a hackathon prototype: the GPTs below are invented, not council assets.",
    "",
    `Plan date: ${dateLabel}`,
    `Truck capacity: ${capacity.toFixed(1)} m³ (assumption)`,
    "",
    "Stops, in order:",
    "",
    ...stops.map(
      (s, i) =>
        `${i + 1}. ${s.id}  ${s.hasCamera ? "camera site, no photos needed" : "photos needed (before and after)"}`,
    ),
    "",
    "This is a suggestion for the contractor, who picks the day and the people. Open the Crew page to accept the run and close each job.",
  ];
  return { subject, body: lines.join("\n") };
}
