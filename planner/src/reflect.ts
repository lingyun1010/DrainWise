// Reflection (ticket 32): turn the scheduler's edits into PROPOSED lessons. Nothing is applied here.
// What learns is the rules table (memory). The Claude model's weights never change.
import type { SimWeek } from "./simulate";

export const MIN_SUPPORT = 3; // k, an assumption: a lesson needs at least this many supporting edits

export const LESSON_KINDS = ["creek_first", "drop_far_after_rain"] as const;
export type LessonKind = (typeof LESSON_KINDS)[number];

export type EvidenceEdit = { id: string; action: "add" | "remove"; assetId: string; reason: string };
export type Lesson = {
  statement: string;
  kind: LessonKind;
  editIds: string[];
  count: number;
  status: "proposed";
};

export function buildReflectPrompt(edits: EvidenceEdit[], ctx: { weeks: number }): string {
  const lines = edits.map((e) => `${e.id}: ${e.action} ${e.assetId} - "${e.reason}"`).join("\n");
  return [
    `A scheduler edited ${ctx.weeks} proposed truck-run plans for gross pollutant traps (GPTs). Their edits and reasons:`,
    lines,
    "",
    `Find patterns in how they change plans. Allowed kinds: ${LESSON_KINDS.join(", ")}.`,
    `creek_first = creek-side GPTs should go first. drop_far_after_rain = after heavy rain, far GPTs are removed.`,
    `Each lesson must cite the edit ids that support it, at least ${MIN_SUPPORT}. Do not invent edit ids.`,
    'Answer with JSON only, in this shape: {"lessons":[{"statement":"short sentence","kind":"creek_first","editIds":["e1","e2","e3"]}]}',
  ].join("\n");
}

export function parseLessons(raw: string, knownIds: Set<string>, k = MIN_SUPPORT): Lesson[] {
  const text = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const list = (data as { lessons?: unknown } | null)?.lessons;
  if (!Array.isArray(list)) return [];
  const out: Lesson[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const { statement, kind, editIds } = item as { statement?: unknown; kind?: unknown; editIds?: unknown };
    if (typeof statement !== "string" || statement.trim() === "") continue;
    if (!LESSON_KINDS.includes(kind as LessonKind)) continue;
    if (!Array.isArray(editIds)) continue;
    const ids = [...new Set(editIds.filter((x): x is string => typeof x === "string" && knownIds.has(x)))];
    if (ids.length < k) continue;
    out.push({
      statement: statement.trim().slice(0, 200),
      kind: kind as LessonKind,
      editIds: ids,
      count: ids.length,
      status: "proposed",
    });
  }
  return out;
}

// Edit ids are "w<week>-<n>", so a lesson can point at the exact edits behind it.
export function evidenceFromWeeks(weeks: SimWeek[]): EvidenceEdit[] {
  return weeks.flatMap((w) => w.edits.map((e, i) => ({ id: `w${w.week}-${i + 1}`, ...e })));
}
