// Read and replace the session of one shared demo room. Last write wins: fine for one manager and one
// or two crews tapping a few times a minute, and stated as a limit in the README.
import { connection } from "next/server";
import { allowRequest } from "../../../../../planner/src/photoUpload";
import { checkRoomState, cleanRoomCode } from "../../../../../planner/src/roomCode";
import { getRoom, saveRoom } from "@/lib/roomStore";
import { storageConfigured } from "@/lib/photoStore";

const hits = new Map<string, number[]>();
// Guessing codes: a client that asks for too many rooms that do not exist is stopped (28k possible codes).
const misses = new Map<string, number[]>();
const MISS_LIMIT = 60;
const clientOf = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
const missesNow = (client: string) => (misses.get(client) ?? []).filter((t) => Date.now() - t < 3600_000);

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  await connection();
  if (!storageConfigured()) return Response.json({ error: "shared rooms are not configured" }, { status: 503 });
  const code = cleanRoomCode((await params).code);
  if (!code) return Response.json({ error: "invalid room code" }, { status: 400 });
  const client = clientOf(request);
  if (missesNow(client).length >= MISS_LIMIT) {
    return Response.json({ error: "too many unknown rooms, try again later" }, { status: 429 });
  }
  const room = await getRoom(code);
  if (room === "error") return Response.json({ error: "room storage is not reachable" }, { status: 502 });
  if (!room) {
    misses.set(client, [...missesNow(client), Date.now()]);
    return Response.json({ error: "room not found" }, { status: 404 });
  }
  return Response.json(room);
}

export async function PUT(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!storageConfigured()) return Response.json({ error: "shared rooms are not configured" }, { status: 503 });
  const code = cleanRoomCode((await params).code);
  if (!code) return Response.json({ error: "invalid room code" }, { status: 400 });
  const client = clientOf(request);
  if (!allowRequest(hits, client, Date.now(), 1200)) {
    return Response.json({ error: "too many updates, slow down" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { state?: unknown } | null;
  const check = checkRoomState(body?.state);
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  const updatedAt = await saveRoom(code, body!.state);
  if (updatedAt === "error") return Response.json({ error: "room storage is not reachable" }, { status: 502 });
  if (!updatedAt) return Response.json({ error: "room not found" }, { status: 404 });
  return Response.json({ updatedAt });
}
