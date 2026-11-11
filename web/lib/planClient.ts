"use client";
// Browser side of the plan records (ticket 30). The history shown in the app lives in the saved session
// (works with no server); the server copy is evidence for later learning and the email/share link. Best effort.
import type { PlanInput, PlanRecord } from "../../planner/src/planReview";

export const MAX_LOCAL_PLANS = 20;

export async function savePlan(
  input: PlanInput,
): Promise<{ ok: true; plan: PlanRecord } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const j = (await res.json().catch(() => ({}))) as { plan?: PlanRecord; error?: string };
    return res.ok && j.plan ? { ok: true, plan: j.plan } : { ok: false, error: j.error ?? "could not save the plan" };
  } catch {
    return { ok: false, error: "could not reach the server" };
  }
}

export async function loadPlan(
  team: string,
  id: string,
): Promise<{ ok: true; plan: PlanRecord } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/plans?team=${encodeURIComponent(team)}&id=${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    const j = (await res.json().catch(() => ({}))) as { plan?: PlanRecord; error?: string };
    return res.ok && j.plan ? { ok: true, plan: j.plan } : { ok: false, error: j.error ?? "plan not found" };
  } catch {
    return { ok: false, error: "could not reach the server" };
  }
}

export async function confirmPlanOnServer(
  id: string,
  input: PlanInput,
): Promise<{ ok: true; plan: PlanRecord } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, id }),
    });
    const j = (await res.json().catch(() => ({}))) as { plan?: PlanRecord; error?: string };
    return res.ok && j.plan ? { ok: true, plan: j.plan } : { ok: false, error: j.error ?? "could not confirm" };
  } catch {
    return { ok: false, error: "could not reach the server" };
  }
}
