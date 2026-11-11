// Ticket 30: the planner output is a SUGGESTION. The admin may remove stops (each needs a reason) and then confirms.
// Pure helpers, no I/O: the page, the API and the tests all use these. Learning from the edits is ticket 32;
// this only checks and records the evidence.

export const REMOVE_REASONS = [
  { id: "access", label: "Road or site not reachable" },
  { id: "recent", label: "Cleaned or checked recently" },
  { id: "crew", label: "Not enough crew time" },
  { id: "priority", label: "Another site matters more" },
  { id: "other", label: "Other (write why)" },
] as const;
export type RemoveReasonId = (typeof REMOVE_REASONS)[number]["id"];

export const MAX_NOTE = 200;
export const MAX_STOPS = 40;

export type PlanStop = { id: string; load: number; photosNeeded: boolean };
export type PlanEdit = { id: string; action: "remove" | "add"; reason: RemoveReasonId; note?: string };
export type PlanContext = { day: string; capacity: number };
export type PlanSource = "manual" | "email link";
export type PlanStatus = "pending" | "confirmed";

export type PlanRecord = {
  id: string;
  team: string | null;
  source: PlanSource;
  status: PlanStatus;
  proposed: PlanStop[];
  final: PlanStop[];
  edits: PlanEdit[];
  context: PlanContext;
  createdAt: string;
  confirmedAt?: string;
};

export function reasonLabel(id: RemoveReasonId): string {
  return REMOVE_REASONS.find((r) => r.id === id)?.label ?? id;
}

// "Cleaned or checked recently" or, for Other, the typed words.
export function editReasonText(e: Pick<PlanEdit, "reason" | "note">): string {
  const note = e.note?.trim();
  if (e.reason === "other") return note || reasonLabel("other");
  return note ? `${reasonLabel(e.reason)}: ${note}` : reasonLabel(e.reason);
}

// A removal needs a reason; "Other" needs words. Returns an error sentence or null.
export function reasonError(reason: RemoveReasonId | null, note: string): string | null {
  if (!reason) return "Pick a reason.";
  if (reason === "other" && !note.trim()) return "Write why you are removing it.";
  if (note.length > MAX_NOTE) return `Keep the note under ${MAX_NOTE} characters.`;
  return null;
}

export function totalLoad(stops: PlanStop[]): number {
  return stops.reduce((n, s) => n + s.load, 0);
}

// What changed between the suggestion and the final list. Every removed stop must have an edit with a valid reason.
export function missingReasons(proposed: PlanStop[], final: PlanStop[], edits: PlanEdit[]): string[] {
  const keep = new Set(final.map((s) => s.id));
  const removed = proposed.filter((s) => !keep.has(s.id)).map((s) => s.id);
  return removed.filter((id) => {
    const e = edits.find((x) => x.id === id && x.action === "remove");
    return !e || reasonError(e.reason, e.note ?? "") !== null;
  });
}

// Confirm is allowed when there is something to send, the truck is not over capacity, and every removal has a reason.
export function canConfirm(
  proposed: PlanStop[],
  final: PlanStop[],
  edits: PlanEdit[],
  capacity: number,
): { ok: true } | { ok: false; error: string } {
  if (final.length === 0) return { ok: false, error: "The run has no stops left. Put one back or cancel." };
  if (totalLoad(final) > capacity + 1e-9) {
    return { ok: false, error: `The run is over the truck capacity (${capacity.toFixed(1)} m³).` };
  }
  const missing = missingReasons(proposed, final, edits);
  if (missing.length) return { ok: false, error: `Give a reason for removing ${missing.join(", ")}.` };
  return { ok: true };
}

// Keep one edit per removed stop, drop edits for stops that were put back or never existed.
export function tidyEdits(proposed: PlanStop[], final: PlanStop[], edits: PlanEdit[]): PlanEdit[] {
  const keep = new Set(final.map((s) => s.id));
  const was = new Set(proposed.map((s) => s.id));
  const seen = new Set<string>();
  const out: PlanEdit[] = [];
  for (const e of edits) {
    const valid = e.action === "remove" ? was.has(e.id) && !keep.has(e.id) : !was.has(e.id) && keep.has(e.id);
    const key = `${e.action}:${e.id}`;
    if (!valid || seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

// Activity log line, one per edit.
export function editLogLine(e: PlanEdit): string {
  return e.action === "remove"
    ? `Admin removed ${e.id} from the suggestion: ${editReasonText(e)}`
    : `Admin added ${e.id} to the suggestion: ${editReasonText(e)}`;
}

// Shown back to the admin before confirming: nothing is applied silently.
export function rememberLines(edits: PlanEdit[]): string[] {
  return edits.map((e) => `${e.action === "remove" ? "Removed" : "Added"} ${e.id}: ${editReasonText(e)}`);
}

// ---- API body check (server): the browser sends a record, the server checks shape and size before saving ----

const TEAM = /^[A-HJKMNP-Z]{4}$/;

function stopsOk(v: unknown): v is PlanStop[] {
  return (
    Array.isArray(v) &&
    v.length <= MAX_STOPS &&
    v.every(
      (s) =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as PlanStop).id === "string" &&
        /^[A-Za-z0-9-]{1,20}$/.test((s as PlanStop).id) &&
        Number.isFinite((s as PlanStop).load) &&
        (s as PlanStop).load >= 0 &&
        (s as PlanStop).load <= 10 &&
        typeof (s as PlanStop).photosNeeded === "boolean",
    )
  );
}

function editsOk(v: unknown): v is PlanEdit[] {
  const ids = REMOVE_REASONS.map((r) => r.id as string);
  return (
    Array.isArray(v) &&
    v.length <= MAX_STOPS * 2 &&
    v.every((e) => {
      if (typeof e !== "object" || e === null) return false;
      const x = e as PlanEdit;
      return (
        typeof x.id === "string" &&
        /^[A-Za-z0-9-]{1,20}$/.test(x.id) &&
        (x.action === "remove" || x.action === "add") &&
        ids.includes(x.reason) &&
        (x.note === undefined || (typeof x.note === "string" && x.note.length <= MAX_NOTE))
      );
    })
  );
}

export type PlanInput = {
  team: string | null;
  source: PlanSource;
  proposed: PlanStop[];
  final: PlanStop[];
  edits: PlanEdit[];
  context: PlanContext;
  status: PlanStatus;
};

export function checkPlanInput(body: unknown): { ok: true; value: PlanInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Send a plan object." };
  const b = body as Record<string, unknown>;
  const team = b.team === null || b.team === undefined ? null : typeof b.team === "string" ? b.team : "?";
  if (team !== null && !TEAM.test(team)) return { ok: false, error: "Team code is not valid." };
  if (b.source !== "manual" && b.source !== "email link") return { ok: false, error: "Unknown source." };
  if (b.status !== "pending" && b.status !== "confirmed") return { ok: false, error: "Unknown status." };
  if (!stopsOk(b.proposed) || !stopsOk(b.final)) return { ok: false, error: "Stops are not valid." };
  if (!editsOk(b.edits)) return { ok: false, error: "Edits are not valid." };
  const c = b.context as PlanContext | undefined;
  if (!c || typeof c.day !== "string" || c.day.length > 20 || !Number.isFinite(c.capacity) || c.capacity <= 0) {
    return { ok: false, error: "Context is not valid." };
  }
  const edits = tidyEdits(b.proposed, b.final, b.edits);
  if (b.status === "confirmed") {
    const ok = canConfirm(b.proposed, b.final, edits, c.capacity);
    if (!ok.ok) return { ok: false, error: ok.error };
  }
  return {
    ok: true,
    value: {
      team,
      source: b.source,
      status: b.status,
      proposed: b.proposed,
      final: b.final,
      edits,
      context: { day: c.day, capacity: c.capacity },
    },
  };
}
