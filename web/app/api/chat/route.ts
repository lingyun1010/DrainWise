// Floating chatbot (ticket 31). Public route, so it checks everything itself: kill switch, key, input size, a per-client
// hourly limit and a daily cap. Every stopped state answers with a plain message; nothing here leaks keys or stack traces.
import { connection } from "next/server";
import { allowRequest } from "../../../../planner/src/photoUpload";
import { cleanRoomCode } from "../../../../planner/src/roomCode";
import {
  CHAT_MESSAGES,
  HOURLY_LIMIT,
  allowToday,
  checkMessages,
  type DailyCounter,
} from "../../../../planner/src/chatGuards";
import { askClaude } from "@/lib/chat";

const hits = new Map<string, number[]>();
const today: DailyCounter = { day: "", n: 0 };

const say = (message: string, status: number, kind: string) => Response.json({ message, kind }, { status });

export async function POST(request: Request) {
  await connection();
  if (process.env.CHAT_DISABLED === "1") return say(CHAT_MESSAGES.off, 503, "off");
  if (!process.env.ANTHROPIC_API_KEY) return say(CHAT_MESSAGES.noKey, 503, "no-key");

  const body = (await request.json().catch(() => null)) as { messages?: unknown; team?: unknown } | null;
  const check = checkMessages(body?.messages);
  if (!check.ok) return say(check.error, check.status, "bad-input");

  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest(hits, client, Date.now(), HOURLY_LIMIT)) return say(CHAT_MESSAGES.rate, 429, "rate");
  if (!allowToday(today, Date.now())) return say(CHAT_MESSAGES.cap, 429, "cap");

  const team = cleanRoomCode(body?.team);
  const r = await askClaude(check.messages, team);
  if (!r.ok) return say(r.error === "no key" ? CHAT_MESSAGES.noKey : CHAT_MESSAGES.failed, r.status, "failed");
  return Response.json({ reply: r.reply, tools: r.tools });
}
