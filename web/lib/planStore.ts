// Server-only access to the plans table (see supabase/migrations/20261111010000_plans.sql).
// Same rule as roomStore: the service role key stays in server env vars and never reaches the browser.
import "server-only";
import type { PlanInput, PlanRecord } from "../../planner/src/planReview";
import { auth, config } from "./photoStore";

type Row = {
  id: string;
  team: string | null;
  source: PlanRecord["source"];
  status: PlanRecord["status"];
  proposed: PlanRecord["proposed"];
  final: PlanRecord["final"];
  edits: PlanRecord["edits"];
  context: PlanRecord["context"];
  created_at: string;
  confirmed_at: string | null;
};

const toRecord = (r: Row): PlanRecord => ({
  id: r.id,
  team: r.team,
  source: r.source,
  status: r.status,
  proposed: r.proposed,
  final: r.final,
  edits: r.edits,
  context: r.context,
  createdAt: r.created_at,
  confirmedAt: r.confirmed_at ?? undefined,
});

async function call(query: string, init?: RequestInit): Promise<Row[] | null> {
  const c = config();
  if (!c) return null;
  try {
    const res = await fetch(`${c.url}/rest/v1/plans?${query}`, {
      ...init,
      headers: {
        ...auth(c.key),
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...init?.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text ? (JSON.parse(text) as Row[]) : [];
  } catch {
    return null;
  }
}

export async function createPlan(p: PlanInput): Promise<PlanRecord | null> {
  const rows = await call("select=*", {
    method: "POST",
    body: JSON.stringify({
      team: p.team,
      source: p.source,
      status: p.status,
      proposed: p.proposed,
      final: p.final,
      edits: p.edits,
      context: p.context,
      confirmed_at: p.status === "confirmed" ? new Date().toISOString() : null,
    }),
  });
  return rows?.[0] ? toRecord(rows[0]) : null;
}

export async function listPlans(team: string, limit = 20): Promise<PlanRecord[] | null> {
  const rows = await call(`team=eq.${team}&select=*&order=created_at.desc&limit=${limit}`);
  return rows ? rows.map(toRecord) : null;
}

export async function getPlan(team: string, id: string): Promise<PlanRecord | null | "error"> {
  const rows = await call(`team=eq.${team}&id=eq.${id}&select=*`);
  if (!rows) return "error";
  return rows[0] ? toRecord(rows[0]) : null;
}

// Only a pending plan can be confirmed, and only once.
export async function confirmPlan(team: string, id: string, p: PlanInput): Promise<PlanRecord | null | "error"> {
  const rows = await call(`team=eq.${team}&id=eq.${id}&status=eq.pending&select=*`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "confirmed",
      final: p.final,
      edits: p.edits,
      confirmed_at: new Date().toISOString(),
    }),
  });
  if (!rows) return "error";
  return rows[0] ? toRecord(rows[0]) : null;
}
