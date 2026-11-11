// Run suggestions and confirmed plans (ticket 30). Access is by team code, like the shared room: no sign-in in this
// demo (production would use real sign-in). The server re-checks every plan, so the browser cannot skip the reason rule.
import { connection } from "next/server";
import { allowRequest } from "../../../../planner/src/photoUpload";
import { checkPlanInput } from "../../../../planner/src/planReview";
import { cleanRoomCode } from "../../../../planner/src/roomCode";
import { confirmPlan, createPlan, getPlan, listPlans } from "@/lib/planStore";
import { isUuid, storageConfigured } from "@/lib/photoStore";
import { getRoom } from "@/lib/roomStore";

const hits = new Map<string, number[]>();
const clientOf = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

async function teamOk(team: string | null): Promise<Response | null> {
  if (!team) return Response.json({ error: "team code needed" }, { status: 400 });
  const room = await getRoom(team);
  if (room === "error") return Response.json({ error: "team storage is not reachable" }, { status: 502 });
  if (!room) return Response.json({ error: "team not found" }, { status: 404 });
  return null;
}

export async function GET(request: Request) {
  await connection();
  if (!storageConfigured()) return Response.json({ error: "shared teams are not configured" }, { status: 503 });
  if (!allowRequest(hits, clientOf(request), Date.now(), 600)) {
    return Response.json({ error: "too many requests, slow down" }, { status: 429 });
  }
  const url = new URL(request.url);
  const team = cleanRoomCode(url.searchParams.get("team"));
  const bad = await teamOk(team);
  if (bad) return bad;
  const id = url.searchParams.get("id");
  if (id) {
    if (!isUuid(id)) return Response.json({ error: "invalid plan id" }, { status: 400 });
    const plan = await getPlan(team!, id);
    if (plan === "error") return Response.json({ error: "plan storage is not reachable" }, { status: 502 });
    if (!plan) return Response.json({ error: "plan not found" }, { status: 404 });
    return Response.json({ plan });
  }
  const plans = await listPlans(team!);
  if (!plans) return Response.json({ error: "plan storage is not reachable" }, { status: 502 });
  return Response.json({ plans });
}

export async function POST(request: Request) {
  if (!storageConfigured()) return Response.json({ error: "shared teams are not configured" }, { status: 503 });
  if (!allowRequest(hits, clientOf(request), Date.now(), 120)) {
    return Response.json({ error: "too many plans, slow down" }, { status: 429 });
  }
  const check = checkPlanInput(await request.json().catch(() => null));
  if (!check.ok) return Response.json({ error: check.error }, { status: 400 });
  const bad = await teamOk(check.value.team);
  if (bad) return bad;
  const plan = await createPlan(check.value);
  if (!plan) return Response.json({ error: "could not save the plan" }, { status: 502 });
  return Response.json({ plan });
}

// Confirm a pending plan: body is the same plan shape with status "confirmed" plus its id.
export async function PATCH(request: Request) {
  if (!storageConfigured()) return Response.json({ error: "shared teams are not configured" }, { status: 503 });
  if (!allowRequest(hits, clientOf(request), Date.now(), 120)) {
    return Response.json({ error: "too many plans, slow down" }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  if (!isUuid(body?.id)) return Response.json({ error: "invalid plan id" }, { status: 400 });
  // Check against the suggestion we stored, not the one the browser sends back.
  const team = cleanRoomCode((body as { team?: unknown }).team);
  const bad = await teamOk(team);
  if (bad) return bad;
  const stored = await getPlan(team!, body!.id as string);
  if (stored === "error") return Response.json({ error: "plan storage is not reachable" }, { status: 502 });
  if (!stored) return Response.json({ error: "plan not found" }, { status: 404 });
  if (stored.status === "confirmed") return Response.json({ error: "plan already confirmed" }, { status: 409 });
  const check = checkPlanInput({ ...body, team, proposed: stored.proposed, context: stored.context });
  if (!check.ok) return Response.json({ error: check.error }, { status: 400 });
  if (check.value.status !== "confirmed") return Response.json({ error: "status must be confirmed" }, { status: 400 });
  const plan = await confirmPlan(team!, body!.id as string, check.value);
  if (plan === "error") return Response.json({ error: "plan storage is not reachable" }, { status: 502 });
  if (!plan) return Response.json({ error: "plan not found or already confirmed" }, { status: 409 });
  return Response.json({ plan });
}
