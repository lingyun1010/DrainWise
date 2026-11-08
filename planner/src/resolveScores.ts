// Which risk scores does the page show? Pure decision, so it is easy to test.
// Live scores win. If the live call failed (or came back empty), use the precomputed file. If neither exists, say so.

export type LiveResult<T> = { ok: true; scores: T[] } | { ok: false; error: string };

export type Resolved<T> =
  | { status: "live"; scores: T[] }
  | { status: "precomputed"; scores: T[]; reason: string }
  | { status: "error"; error: string };

export function resolveScores<T>(live: LiveResult<T>, precomputed: T[] | null): Resolved<T> {
  if (live.ok && live.scores.length > 0) return { status: "live", scores: live.scores };
  const reason = live.ok ? "risk-api returned no scores" : live.error;
  if (precomputed && precomputed.length > 0) return { status: "precomputed", scores: precomputed, reason };
  return { status: "error", error: reason };
}
