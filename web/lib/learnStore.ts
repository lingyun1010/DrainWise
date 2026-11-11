// Server-only access to the learning tables (see supabase/migrations/20261111020000_learning.sql).
// SIMULATION data only. The service role key stays in server env vars and never reaches the browser.
import "server-only";
import type { SimWeek } from "../../planner/src/simulate";
import type { Lesson, LessonKind } from "../../planner/src/reflect";
import type { Rule } from "../../planner/src/rules";
import { auth, config } from "./photoStore";

export type LessonRow = {
  id: string;
  statement: string;
  kind: LessonKind;
  edit_ids: string[];
  count: number;
  status: "proposed" | "approved" | "rejected";
  created_at: string;
};
export type PrefRow = {
  id: string;
  lesson_id: string;
  kind: LessonKind;
  text: string;
  enabled: boolean;
  version: number;
  approved_at_week: number | null;
  created_at: string;
};

async function rest<T>(table: string, query: string, init?: RequestInit): Promise<T[] | null> {
  const c = config();
  if (!c) return null;
  try {
    const res = await fetch(`${c.url}/rest/v1/${table}?${query}`, {
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
    return text ? (JSON.parse(text) as T[]) : [];
  } catch {
    return null;
  }
}

export const listWeeks = async (): Promise<SimWeek[] | null> => {
  const rows = await rest<{ data: SimWeek }>("sim_weeks", "select=data&order=week.asc");
  return rows ? rows.map((r) => r.data) : null;
};
export const saveWeeks = (weeks: SimWeek[]) =>
  rest("sim_weeks", "select=week", {
    method: "POST",
    body: JSON.stringify(weeks.map((w) => ({ week: w.week, data: w }))),
  });
export const listLessons = () => rest<LessonRow>("lessons", "select=*&order=created_at.asc");
export const listPrefs = () => rest<PrefRow>("preferences", "select=*&order=created_at.asc");

export const replaceProposed = async (lessons: Lesson[]) => {
  const del = await rest("lessons", "status=eq.proposed", { method: "DELETE" });
  if (!del) return null;
  if (lessons.length === 0) return [];
  return rest<LessonRow>("lessons", "select=*", {
    method: "POST",
    body: JSON.stringify(
      lessons.map((l) => ({ statement: l.statement, kind: l.kind, edit_ids: l.editIds, count: l.count })),
    ),
  });
};
export const setLessonStatus = async (id: string, status: LessonRow["status"]) =>
  (
    await rest<LessonRow>("lessons", `id=eq.${id}&select=*`, { method: "PATCH", body: JSON.stringify({ status }) })
  )?.[0] ?? null;
export const getLesson = async (id: string) => (await rest<LessonRow>("lessons", `id=eq.${id}&select=*`))?.[0] ?? null;
export const createPref = async (l: LessonRow, atWeek: number) =>
  (
    await rest<PrefRow>("preferences", "select=*", {
      method: "POST",
      body: JSON.stringify({ lesson_id: l.id, kind: l.kind, text: l.statement, approved_at_week: atWeek }),
    })
  )?.[0] ?? null;
export const patchPref = async (id: string, patch: Partial<Pick<PrefRow, "text" | "enabled" | "version">>) =>
  (await rest<PrefRow>("preferences", `id=eq.${id}&select=*`, { method: "PATCH", body: JSON.stringify(patch) }))?.[0] ??
  null;

export async function resetLearning() {
  const a = await rest("preferences", "id=not.is.null", { method: "DELETE" });
  const b = await rest("lessons", "id=not.is.null", { method: "DELETE" });
  const c = await rest("sim_weeks", "week=gte.0", { method: "DELETE" });
  return a && b && c ? true : null;
}

// Only rules whose lesson is approved AND that are switched on can reach the planner.
export async function liveRules(): Promise<Rule[] | null> {
  const [lessons, prefs] = await Promise.all([listLessons(), listPrefs()]);
  if (!lessons || !prefs) return null;
  const approved = new Set(lessons.filter((l) => l.status === "approved").map((l) => l.id));
  return prefs
    .filter((p) => approved.has(p.lesson_id))
    .map((p) => ({ id: p.id, kind: p.kind, text: p.text, status: "approved" as const, enabled: p.enabled }));
}
