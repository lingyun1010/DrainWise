// Server-only access to the shared demo rooms table (see supabase/migrations/20261108010000_rooms.sql).
// Same rule as photoStore: the service role key stays in server env vars and never reaches the browser.
import "server-only";
import { MAX_ROOMS, roomExpiry } from "../../planner/src/roomCode";
import { auth, config } from "./photoStore";

type RoomRow = { code: string; state: unknown; updated_at: string };
export type Room = { state: unknown; updatedAt: string };

async function call(query: string, init?: RequestInit): Promise<{ res: Response; text: string } | null> {
  const c = config();
  if (!c) return null;
  try {
    const res = await fetch(`${c.url}/rest/v1/rooms?${query}`, {
      ...init,
      headers: { ...auth(c.key), "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return { res, text: await res.text() };
  } catch {
    return null;
  }
}

const parse = (text: string): RoomRow[] => (text ? (JSON.parse(text) as RoomRow[]) : []);

export async function getRoom(code: string): Promise<Room | null | "error"> {
  const r = await call(
    `code=eq.${code}&select=state,updated_at,expires_at&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`,
  );
  if (!r || !r.res.ok) return "error";
  const row = parse(r.text)[0];
  return row ? { state: row.state, updatedAt: row.updated_at } : null;
}

export type Created = { ok: true; updatedAt: string } | { ok: false; status: number; error: string };

// A taken code answers 409; the route then tries another one.
export async function createRoom(code: string, state: unknown): Promise<Created> {
  await deleteExpiredRooms();
  const count = await call("select=code&limit=1", { headers: { Prefer: "count=exact", Range: "0-0" } });
  if (!count || !count.res.ok) return { ok: false, status: 502, error: "team storage is not reachable" };
  const total = Number(count.res.headers.get("content-range")?.split("/")[1] ?? 0);
  if (total >= MAX_ROOMS) return { ok: false, status: 507, error: "too many teams for this demo, try later" };

  const now = Date.now();
  const r = await call("select=updated_at", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ code, state, updated_at: new Date(now).toISOString(), expires_at: roomExpiry(now) }),
  });
  if (!r) return { ok: false, status: 502, error: "team storage is not reachable" };
  if (r.res.status === 409) return { ok: false, status: 409, error: "code taken" };
  if (!r.res.ok) return { ok: false, status: 502, error: "could not create the team" };
  return { ok: true, updatedAt: parse(r.text)[0].updated_at };
}

// Replaces the session and pushes the expiry out again. Null when the room does not exist (or expired).
export async function saveRoom(code: string, state: unknown): Promise<string | null | "error"> {
  const now = Date.now();
  const r = await call(
    `code=eq.${code}&expires_at=gt.${encodeURIComponent(new Date(now).toISOString())}&select=updated_at`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ state, updated_at: new Date(now).toISOString(), expires_at: roomExpiry(now) }),
    },
  );
  if (!r || !r.res.ok) return "error";
  return parse(r.text)[0]?.updated_at ?? null;
}

export async function deleteExpiredRooms(): Promise<number> {
  const r = await call(`expires_at=lt.${encodeURIComponent(new Date().toISOString())}&select=code`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  return r && r.res.ok ? parse(r.text).length : 0;
}
