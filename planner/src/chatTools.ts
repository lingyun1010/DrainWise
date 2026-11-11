// What the chatbot may look at (ticket 31). Pure helpers that shape data for the model; the route fetches the data.
// Every result says where it came from, so the answer can say "sample data" or "BoM forecast".
import { dayRainMm, type BomDay } from "./bomPrecis";

export const TOOL_DEFS = [
  {
    name: "get_rain_outlook",
    description:
      "Rain outlook for Parramatta from the real BoM precis forecast: chance of rain and rain range per day. Use for rain questions.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_risk_ranking",
    description:
      "Which GPTs are fullest: blockage probability, level (High 60%+, Medium 30%+, Low) and reasons for the top GPTs, from the risk model. SAMPLE DATA (sample GPTs, model trained on simulated data). Optional what-if values.",
    input_schema: {
      type: "object",
      properties: {
        top: { type: "integer", minimum: 1, maximum: 10, description: "How many GPTs to return (default 5)" },
        extra_rain_mm: {
          type: "number",
          minimum: 0,
          maximum: 100,
          description: "What-if: extra rain in the last 7 days",
        },
        leaf_index: { type: "number", minimum: 0, maximum: 100, description: "What-if: leaf-fall index (default 60)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_crew_progress",
    description:
      "Progress of each crew in the shared team: accepted, stops done and left, skipped, ended early. Needs a team code. SAMPLE session.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
] as const;

export type RainOutlook = {
  source: string;
  issued_at: string;
  days: { date: string; summary: string; chance_of_rain_pct: number | null; rain_mm_likely: number | null }[];
};

export function rainOutlook(bom: { issuedAt: string; days: BomDay[]; source: string }): RainOutlook {
  return {
    source: bom.source,
    issued_at: bom.issuedAt,
    days: bom.days.slice(0, 7).map((d) => ({
      date: d.date,
      summary: d.precis,
      chance_of_rain_pct: d.popPct,
      rain_mm_likely: dayRainMm(d),
    })),
  };
}

type Scored = { asset_id: string; p_block: number; level: string; reasons: string[] };
export function rankedTop(scores: Scored[], top = 5) {
  const n = Math.max(1, Math.min(10, Math.round(top) || 5));
  return [...scores]
    .sort((a, b) => b.p_block - a.p_block)
    .slice(0, n)
    .map((s) => ({
      gpt: s.asset_id,
      blockage_pct: Math.min(99, Math.round(s.p_block * 100)),
      level: s.level,
      reasons: s.reasons,
    }));
}

type RunLike = {
  crew?: string;
  accepted?: boolean;
  stops?: { id: string }[];
  done?: string[];
  skipped?: unknown[];
  ended?: unknown;
};
type TeamLike = { crews?: { id: string; name: string }[]; runs?: Record<string, RunLike | undefined> };

// Reads a team session defensively: the server only checked its outer shape.
export function crewProgress(state: unknown) {
  const s = (state ?? {}) as TeamLike;
  return (s.crews ?? []).map((c) => {
    const run = s.runs?.[c.id];
    if (!run) return { crew: c.name, status: "no run" };
    const total = run.stops?.length ?? 0;
    const done = run.done?.length ?? 0;
    return {
      crew: c.name,
      status: run.ended ? "ended early" : !run.accepted ? "waiting to accept" : done >= total ? "finished" : "working",
      stops_done: done,
      stops_total: total,
      stops_skipped: run.skipped?.length ?? 0,
    };
  });
}
