// Rules for the floating chatbot (ticket 31). Pure, so they are easy to test.
// The route checks everything again on the server, because anyone can call it directly.

export const MAX_INPUT_CHARS = 500;
export const MAX_TURNS = 12; // messages kept from the conversation (user + assistant)
export const HOURLY_LIMIT = 20; // questions per client per hour
export const DAILY_CAP = 300; // questions per server instance per day (best effort, see allowRequest)
export const MAX_TOKENS = 600;
export const MAX_TOOL_ROUNDS = 4;

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type MessagesCheck = { ok: true; messages: ChatMessage[] } | { ok: false; status: 400; error: string };

// Only the last MAX_TURNS messages are sent on, the last one must be a user question, and only the question is
// length-limited (earlier assistant replies were written by us).
export function checkMessages(raw: unknown): MessagesCheck {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, status: 400, error: "send a list of messages" };
  const messages: ChatMessage[] = [];
  for (const m of raw.slice(-MAX_TURNS)) {
    if (typeof m !== "object" || m === null) return { ok: false, status: 400, error: "bad message" };
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      return { ok: false, status: 400, error: "bad message" };
    }
    messages.push({ role, content: role === "assistant" ? content.slice(0, 4000) : content });
  }
  while (messages.length > 0 && messages[0].role !== "user") messages.shift();
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return { ok: false, status: 400, error: "the last message must be a question" };
  if (last.content.trim().length === 0) return { ok: false, status: 400, error: "the question is empty" };
  if (last.content.length > MAX_INPUT_CHARS) {
    return { ok: false, status: 400, error: `keep the question under ${MAX_INPUT_CHARS} characters` };
  }
  return { ok: true, messages };
}

// Daily counter: resets when the UTC day changes. Returns true when the question may go on.
export type DailyCounter = { day: string; n: number };
export function allowToday(counter: DailyCounter, nowMs: number, cap = DAILY_CAP): boolean {
  const day = new Date(nowMs).toISOString().slice(0, 10);
  if (counter.day !== day) {
    counter.day = day;
    counter.n = 0;
  }
  if (counter.n >= cap) return false;
  counter.n += 1;
  return true;
}

// The plain-language messages the panel shows for each stopped state. No stack traces, no keys.
export const CHAT_MESSAGES = {
  off: "Chat is switched off right now.",
  noKey: "Chat is not set up on this build (no API key).",
  rate: "You have asked a lot in the last hour. Please try again later.",
  cap: "The daily chat limit for this demo is used up. Please try again tomorrow.",
  failed: "Chat could not answer just now. Please try again.",
} as const;
