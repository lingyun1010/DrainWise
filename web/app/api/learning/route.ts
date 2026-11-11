// Everything the Learning page shows: simulated weeks, proposed and decided lessons, rules. SIMULATION data only.
import { connection } from "next/server";
import { allowRequest } from "../../../../planner/src/photoUpload";
import { storageConfigured } from "@/lib/photoStore";
import { listLessons, listPrefs, listWeeks } from "@/lib/learnStore";
import { evidenceFromWeeks } from "../../../../planner/src/reflect";

const hits = new Map<string, number[]>();

export async function GET(request: Request) {
  await connection();
  if (!storageConfigured()) return Response.json({ error: "storage is not configured on this build" }, { status: 503 });
  const who = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest(hits, who, Date.now(), 600)) return Response.json({ error: "too many requests" }, { status: 429 });
  const [weeks, lessons, prefs] = await Promise.all([listWeeks(), listLessons(), listPrefs()]);
  if (!weeks || !lessons || !prefs)
    return Response.json({ error: "learning storage is not reachable" }, { status: 502 });
  return Response.json({ weeks, lessons, prefs, evidence: evidenceFromWeeks(weeks) });
}
