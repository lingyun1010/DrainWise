// Server-only: the floating chatbot (ticket 31). Calls the Anthropic Messages API with a few read-only tools.
// ANTHROPIC_API_KEY is read here and never sent to the browser. Answers must come from tool results.
import "server-only";
import { predict, type AssetInput, type ModelJson } from "../../planner/src/riskModel";
import { MAX_TOKENS, MAX_TOOL_ROUNDS, type ChatMessage } from "../../planner/src/chatGuards";
import { TOOL_DEFS, crewProgress, rainOutlook, rankedTop } from "../../planner/src/chatTools";
import { getBom } from "./bomForecast";
import { getRoom } from "./roomStore";
import { storageConfigured } from "./photoStore";
import riskModel from "./riskModel.json";
import { makeSeedAssets } from "./seed";

const MODEL = process.env.CHAT_MODEL || "claude-haiku-5-5";
const API = "https://api.anthropic.com/v1/messages";

const SYSTEM = `You are the DrainWise assistant for a council manager. DrainWise ranks gross pollutant traps (GPTs) by how likely they are to block and plans truck runs.
Rules:
- Answer ONLY from tool results. If a tool has no data, say so. Never invent numbers, sites, council facts or dollar figures.
- GPT positions, crews and the risk model are SAMPLE DATA (the model is trained on simulated data, not council records). Say "sample data" when you use them. The rain forecast is the real BoM forecast.
- Write risk levels as High (60%+), Medium (30%+), Low.
- Reply in the language of the user's question. Keep it short: a few sentences or a short list with "- " bullets. Plain text only: no markdown bold, headings or tables. No emoji.
- Do not write a "Data used" line: the app shows it under your answer. If you looked at no data, say so in your answer.
- You cannot change anything in the app. You only read data.`;

type Block = { type: string; id?: string; name?: string; input?: Record<string, unknown>; text?: string };
type ApiMessage = { role: "user" | "assistant"; content: string | unknown[] };

async function runTool(name: string, input: Record<string, unknown>, team: string | null): Promise<unknown> {
  if (name === "get_rain_outlook") {
    const r = await getBom();
    return r.ok ? rainOutlook(r.body) : { error: "the BoM forecast is not available right now" };
  }
  if (name === "get_risk_ranking") {
    const num = (v: unknown, d: number, lo: number, hi: number) =>
      typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
    const extraRain = num(input.extra_rain_mm, 0, 0, 100);
    const leaf = num(input.leaf_index, 60, 0, 100);
    const inputs: AssetInput[] = makeSeedAssets().map((a) => ({
      asset_id: a.id,
      type: a.type,
      canopy_pct: a.canopyPct,
      leaf_index: leaf,
      rain_mm_7d: 20 + extraRain, // default sample scenario is 20 mm in the last 7 days
      rain_forecast_mm: 10,
      days_since_clean: a.daysSinceClean,
      has_camera: a.hasCamera,
    }));
    const scores = predict(riskModel as unknown as ModelJson, inputs);
    return {
      data: "SAMPLE DATA: sample GPTs, model trained on simulated data",
      scenario: { leaf_index: leaf, rain_mm_7d: 20 + extraRain, rain_forecast_mm: 10, no_gpt_cleaned_yet: true },
      top: rankedTop(scores, typeof input.top === "number" ? input.top : 5),
    };
  }
  if (name === "get_crew_progress") {
    if (!team) return { error: "no team code: the manager has not joined or created a shared team" };
    if (!storageConfigured()) return { error: "shared teams are not set up on this build" };
    const room = await getRoom(team);
    if (room === "error") return { error: "team storage is not reachable" };
    if (!room) return { error: "team not found or expired" };
    return { data: "SAMPLE session", crews: crewProgress(room.state) };
  }
  return { error: "unknown tool" };
}

export type ChatResult = { ok: true; reply: string; tools: string[] } | { ok: false; status: number; error: string };

export async function askClaude(messages: ChatMessage[], team: string | null): Promise<ChatResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, status: 503, error: "no key" };
  const convo: ApiMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));
  const used: string[] = [];
  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const res = await fetch(API, {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM,
          tools: round < MAX_TOOL_ROUNDS ? TOOL_DEFS : undefined,
          messages: convo,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) return { ok: false, status: 502, error: `model returned ${res.status}` };
      const body = (await res.json()) as { content: Block[]; stop_reason: string };
      const calls = body.content.filter((b) => b.type === "tool_use");
      if (body.stop_reason !== "tool_use" || calls.length === 0) {
        const reply = body.content
          .filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("")
          .trim();
        return reply ? { ok: true, reply, tools: used } : { ok: false, status: 502, error: "empty reply" };
      }
      convo.push({ role: "assistant", content: body.content });
      const results = [];
      for (const c of calls) {
        if (c.name && !used.includes(c.name)) used.push(c.name);
        const out = await runTool(c.name ?? "", c.input ?? {}, team);
        results.push({ type: "tool_result", tool_use_id: c.id, content: JSON.stringify(out) });
      }
      convo.push({ role: "user", content: results });
    }
    return { ok: false, status: 502, error: "too many tool rounds" };
  } catch {
    return { ok: false, status: 502, error: "model is not reachable" };
  }
}
