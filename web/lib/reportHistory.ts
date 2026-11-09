// When the last storm / weekly report went out. In memory on one server instance only: the demo has no database for it
// and no scheduler. It holds timestamps, never an address. In production this would live in a table.
import type { LastSent } from "../../planner/src/reportRule";

const sent: LastSent = { storm: null, weekly: null };
export const lastSent = (): LastSent => ({ ...sent });
export function markSent(kind: "storm_1day" | "weekly_7day", at: Date = new Date()): void {
  sent[kind === "storm_1day" ? "storm" : "weekly"] = at.toISOString();
}
