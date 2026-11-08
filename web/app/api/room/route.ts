// Creates a shared demo room and seeds it with the caller's current session.
// Public, so it checks the session shape and size itself and limits how fast one client can make rooms.
import { allowRequest } from "../../../../planner/src/photoUpload";
import { checkRoomState, generateRoomCode } from "../../../../planner/src/roomCode";
import { createRoom } from "@/lib/roomStore";
import { storageConfigured } from "@/lib/photoStore";

const hits = new Map<string, number[]>();

export async function POST(request: Request) {
  if (!storageConfigured()) return Response.json({ error: "shared teams are not configured" }, { status: 503 });
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest(hits, client, Date.now(), 20)) {
    return Response.json({ error: "too many teams, try again later" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { state?: unknown } | null;
  const check = checkRoomState(body?.state);
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const made = await createRoom(code, body!.state);
    if (made.ok) return Response.json({ code, updatedAt: made.updatedAt });
    if (made.status !== 409) return Response.json({ error: made.error }, { status: made.status });
  }
  return Response.json({ error: "could not find a free code, try again" }, { status: 503 });
}
