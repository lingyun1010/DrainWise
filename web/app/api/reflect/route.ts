// Reflection (ticket 32): Claude drafts PROPOSED lessons from the simulated scheduler's edits. Nothing is applied.
// Same key, kill switch and daily cap as the chatbot. The model's weights never change; only the rules table learns.
import { connection } from "next/server";
import { allowRequest } from "../../../../planner/src/photoUpload";
import { CHAT_MESSAGES, allowToday, type DailyCounter } from "../../../../planner/src/chatGuards";
import { buildReflectPrompt, evidenceFromWeeks, parseLessons } from "../../../../planner/src/reflect";
import { storageConfigured } from "@/lib/photoStore";
import { listWeeks, replaceProposed } from "@/lib/learnStore";

const hits = new Map<string, number[]>();
const today: DailyCounter = { day: "", n: 0 };
const MODEL = process.env.CHAT_MODEL || "claude-haiku-5-5";
const say = (message: string, status: number, kind: string) => Response.json({ message, kind }, { status });

export async function POST(request: Request) {
  await connection();
  if (process.env.CHAT_DISABLED === "1") return say(CHAT_MESSAGES.off, 503, "off");
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return say("Reflection is not set up on this build (no API key).", 503, "no-key");
  if (!storageConfigured()) return say("Storage is not configured on this build.", 503, "no-storage");
  const who = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest(hits, who, Date.now(), 10)) return say(CHAT_MESSAGES.rate, 429, "rate");
  if (!allowToday(today, Date.now())) return say(CHAT_MESSAGES.cap, 429, "cap");

  const weeks = await listWeeks();
  if (!weeks) return say("Learning storage is not reachable.", 502, "failed");
  const evidence = evidenceFromWeeks(weeks);
  if (evidence.length === 0) return say("There are no edits yet. Run some simulated weeks first.", 400, "no-edits");

  let raw = "";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        system: "You find patterns in a scheduler's edits. You only propose; a person approves. Answer with JSON only.",
        messages: [{ role: "user", content: buildReflectPrompt(evidence.slice(-200), { weeks: weeks.length }) }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return say(CHAT_MESSAGES.failed, 502, "failed");
    const body = (await res.json()) as { content: { type: string; text?: string }[] };
    raw = body.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
  } catch {
    return say(CHAT_MESSAGES.failed, 502, "failed");
  }
  const lessons = parseLessons(raw, new Set(evidence.map((e) => e.id)));
  const saved = await replaceProposed(lessons);
  if (!saved) return say("Could not save the lessons.", 502, "failed");
  return Response.json({ proposed: saved.length });
}
