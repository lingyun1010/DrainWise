// Run simulated weeks (a made-up scheduler persona edits the proposed plans). SIMULATION, not a real council officer.
// Approved and enabled rules shape each proposed plan, so edits per plan can fall once a good rule is approved.
import { connection } from "next/server";
import { allowRequest } from "../../../../planner/src/photoUpload";
import { markCreekSide, simulateWeeks } from "../../../../planner/src/simulate";
import { DEPOT, makeSeedAssets } from "@/lib/seed";
import { storageConfigured } from "@/lib/photoStore";
import { listWeeks, liveRules, resetLearning, saveWeeks } from "@/lib/learnStore";

const hits = new Map<string, number[]>();
const MAX_WEEKS_TOTAL = 60;
const SEED = 42; // fixed, so every run can be reproduced

const guard = (request: Request) => {
  if (!storageConfigured()) return Response.json({ error: "storage is not configured on this build" }, { status: 503 });
  const who = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest(hits, who, Date.now(), 60)) return Response.json({ error: "too many requests" }, { status: 429 });
  return null;
};

export async function POST(request: Request) {
  await connection();
  const bad = guard(request);
  if (bad) return bad;
  const body = (await request.json().catch(() => null)) as { weeks?: unknown } | null;
  const n = typeof body?.weeks === "number" ? Math.floor(body.weeks) : 4;
  if (n < 1 || n > 8) return Response.json({ error: "weeks must be 1 to 8" }, { status: 400 });
  const [existing, rules] = await Promise.all([listWeeks(), liveRules()]);
  if (!existing || !rules) return Response.json({ error: "learning storage is not reachable" }, { status: 502 });
  if (existing.length + n > MAX_WEEKS_TOTAL)
    return Response.json({ error: "demo limit reached, reset the simulation" }, { status: 400 });
  const assets = markCreekSide(
    makeSeedAssets().map((a) => ({ id: a.id, type: a.type, risk: 0.2, x: a.x, y: a.y, hasCamera: a.hasCamera })),
  );
  const weeks = simulateWeeks({ assets, depot: DEPOT, weeks: n, seed: SEED, startWeek: existing.length, rules });
  if (!(await saveWeeks(weeks))) return Response.json({ error: "could not save the weeks" }, { status: 502 });
  return Response.json({ added: weeks.length });
}

export async function DELETE(request: Request) {
  await connection();
  const bad = guard(request);
  if (bad) return bad;
  if (!(await resetLearning())) return Response.json({ error: "could not reset" }, { status: 502 });
  return Response.json({ ok: true });
}
