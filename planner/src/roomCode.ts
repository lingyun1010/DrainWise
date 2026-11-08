// Shared room for a two-device demo (manager on a laptop, crew on a phone). Pure helpers, easy to test.
// A room is a short code that both devices type or open as a link. No sign-in: whoever has the code
// can read and change the sample session, so the code is only a way to keep demos apart.

// No I, L or O: easy to misread on a phone screen.
export const ROOM_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ";
export const ROOM_CODE_LENGTH = 4;
export const MAX_ROOM_BYTES = 200_000; // one sample session is a few KB; this stops junk
export const ROOM_TTL_HOURS = 24;
export const MAX_ROOMS = 100; // keeps the free Supabase plan safe

export function generateRoomCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_ALPHABET[Math.floor(random() * ROOM_ALPHABET.length)];
  }
  return code;
}

// Accepts what a person types ("abcd ", "ab-cd") and returns the clean code, or null.
export function cleanRoomCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== ROOM_CODE_LENGTH) return null;
  for (const ch of code) if (!ROOM_ALPHABET.includes(ch)) return null;
  return code;
}

export type StateCheck = { ok: true } | { ok: false; status: 400 | 413; error: string };

// The server never reads inside the session; it only checks the outer shape and the size.
export function checkRoomState(value: unknown): StateCheck {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, status: 400, error: "state must be an object" };
  }
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.crews) || !Array.isArray(v.records) || !Array.isArray(v.log)) {
    return { ok: false, status: 400, error: "state needs crews, records and log lists" };
  }
  if (typeof v.runs !== "object" || v.runs === null || Array.isArray(v.runs)) {
    return { ok: false, status: 400, error: "state needs a runs object" };
  }
  if (JSON.stringify(value).length > MAX_ROOM_BYTES) {
    return { ok: false, status: 413, error: "session is too large" };
  }
  return { ok: true };
}

export function roomExpiry(nowMs: number): string {
  return new Date(nowMs + ROOM_TTL_HOURS * 3600_000).toISOString();
}
