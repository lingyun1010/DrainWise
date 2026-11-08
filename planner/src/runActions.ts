// Pure state changes for a crew that declines a run, skips a stop or ends a run early.
// No browser APIs here, so vitest can test them. The web app passes in its own saved state.

export type Reason = "full" | "breakdown" | "no_time" | "no_access" | "unavailable" | "other";
export type ReturnKind = "declined" | "skipped" | "ended";

export const REASONS: { id: Reason; label: string }[] = [
  { id: "full", label: "Truck is full" },
  { id: "breakdown", label: "Truck broke down" },
  { id: "no_time", label: "Not enough time left" },
  { id: "no_access", label: "Can't reach the site" },
  { id: "unavailable", label: "Crew unavailable" },
  { id: "other", label: "Other" },
];

export function reasonLabel(id: string): string {
  return REASONS.find((r) => r.id === id)?.label ?? "Other";
}

// These reasons mean the truck or crew cannot continue, so the whole run ends instead of one stop being skipped.
export function endsRun(reason: Reason): boolean {
  return reason === "full" || reason === "breakdown" || reason === "no_time";
}

// "Truck is full" only makes sense once something has been collected, and never when declining a run.
export function reasonsFor(kind: "decline" | "skip" | "end", doneCount: number): { id: Reason; label: string }[] {
  return REASONS.filter((r) => r.id !== "full" || (kind !== "decline" && doneCount > 0));
}

export type Skip = { stopId: string; reason: Reason; note?: string; at: string };
export type Ended = { reason: Reason; note?: string; at: string };
// One entry per stop that went back to the queue. `at` is an ISO timestamp.
export type Returned = {
  stopId: string;
  crewId: string;
  runId: string;
  kind: ReturnKind;
  reason: Reason;
  note?: string;
  at: string;
};

type RunLike = {
  runId: string;
  crew: string;
  stops: { id: string }[];
  done: string[];
  accepted: boolean;
  skipped?: Skip[];
  ended?: Ended;
};
type StateLike<R extends RunLike> = { runs: Record<string, R | undefined>; returns?: Returned[] };

export function isOpen(run: RunLike, stopId: string): boolean {
  return !run.done.includes(stopId) && !(run.skipped ?? []).some((s) => s.stopId === stopId);
}

export function openStops<R extends RunLike>(run: R): R["stops"] {
  return run.stops.filter((s) => isOpen(run, s.id));
}

function withReturns<R extends RunLike, S extends StateLike<R>>(state: S, add: Returned[]): Returned[] {
  return [...add, ...(state.returns ?? [])].slice(0, 200);
}

// Decline a run that has not been accepted. Every stop goes back to the queue. Returns the same state when nothing applies.
export function declineRun<R extends RunLike, S extends StateLike<R>>(
  state: S,
  crewId: string,
  reason: Reason,
  at: string,
  note?: string,
): S {
  const run = state.runs[crewId];
  if (!run || run.accepted || run.done.length > 0) return state;
  const add = run.stops.map((s) => ({
    stopId: s.id,
    crewId,
    runId: run.runId,
    kind: "declined" as const,
    reason,
    note,
    at,
  }));
  return { ...state, runs: { ...state.runs, [crewId]: undefined }, returns: withReturns(state, add) };
}

// End an accepted run. Cleaned stops stay; every other stop goes back to the queue. Nothing cleaned: the run disappears.
export function endRunEarly<R extends RunLike, S extends StateLike<R>>(
  state: S,
  crewId: string,
  reason: Reason,
  at: string,
  note?: string,
): S {
  const run = state.runs[crewId];
  if (!run || !run.accepted || openStops(run).length === 0) return state;
  const add = openStops(run).map((s) => ({
    stopId: s.id,
    crewId,
    runId: run.runId,
    kind: "ended" as const,
    reason,
    note,
    at,
  }));
  const kept = run.stops.filter((s) => run.done.includes(s.id));
  const next = kept.length ? ({ ...run, stops: kept, skipped: [], ended: { reason, note, at } } as R) : undefined;
  return { ...state, runs: { ...state.runs, [crewId]: next }, returns: withReturns(state, add) };
}

// Skip one stop. A reason that stops the truck (full, breakdown, no time) ends the run instead.
export function skipStop<R extends RunLike, S extends StateLike<R>>(
  state: S,
  crewId: string,
  stopId: string,
  reason: Reason,
  at: string,
  note?: string,
): S {
  const run = state.runs[crewId];
  if (!run || !run.accepted || !isOpen(run, stopId) || !run.stops.some((s) => s.id === stopId)) return state;
  if (endsRun(reason)) return endRunEarly(state, crewId, reason, at, note);
  const entry: Returned = { stopId, crewId, runId: run.runId, kind: "skipped", reason, note, at };
  const next = { ...run, skipped: [...(run.skipped ?? []), { stopId, reason, note, at }] } as R;
  return { ...state, runs: { ...state.runs, [crewId]: next }, returns: withReturns(state, [entry]) };
}

// Latest return of a stop that is still waiting in the queue, for the "Returned by ..." label.
export function lastReturn(returns: Returned[] | undefined, stopId: string): Returned | undefined {
  return (returns ?? []).find((r) => r.stopId === stopId); // newest first
}

export const AVOID_SAME_CREW_MS = 24 * 60 * 60 * 1000;

// Crews that sent one of these stops back in the last 24 hours. The crew picker does not pre-select them.
export function recentReturners(returns: Returned[] | undefined, stopIds: string[], now: number): Set<string> {
  const ids = new Set(stopIds);
  const out = new Set<string>();
  for (const r of returns ?? []) {
    if (ids.has(r.stopId) && now - Date.parse(r.at) < AVOID_SAME_CREW_MS) out.add(r.crewId);
  }
  return out;
}
