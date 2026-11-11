// Approve, edit, reject or switch a rule on or off (ticket 32). Nothing reaches the planner without an approval here.
import { connection } from "next/server";
import { allowRequest } from "../../../../planner/src/photoUpload";
import { isUuid, storageConfigured } from "@/lib/photoStore";
import { createPref, getLesson, listPrefs, listWeeks, patchPref, setLessonStatus } from "@/lib/learnStore";

const hits = new Map<string, number[]>();

export async function PATCH(request: Request) {
  await connection();
  if (!storageConfigured()) return Response.json({ error: "storage is not configured on this build" }, { status: 503 });
  const who = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest(hits, who, Date.now(), 120)) return Response.json({ error: "too many requests" }, { status: 429 });
  const b = (await request.json().catch(() => null)) as {
    lessonId?: unknown;
    action?: unknown;
    text?: unknown;
    enabled?: unknown;
  } | null;
  if (!b || typeof b.lessonId !== "string" || !isUuid(b.lessonId))
    return Response.json({ error: "bad lesson id" }, { status: 400 });
  const lesson = await getLesson(b.lessonId);
  if (!lesson) return Response.json({ error: "lesson not found" }, { status: 404 });
  const prefs = await listPrefs();
  if (!prefs) return Response.json({ error: "storage is not reachable" }, { status: 502 });
  const pref = prefs.find((p) => p.lesson_id === lesson.id);

  switch (b.action) {
    case "approve": {
      if (lesson.status === "approved") return Response.json({ error: "already approved" }, { status: 409 });
      const weeks = await listWeeks();
      if (!weeks) return Response.json({ error: "storage is not reachable" }, { status: 502 });
      await setLessonStatus(lesson.id, "approved");
      const p = pref ? await patchPref(pref.id, { enabled: true }) : await createPref(lesson, weeks.length);
      return p ? Response.json({ ok: true }) : Response.json({ error: "could not save" }, { status: 502 });
    }
    case "reject": {
      await setLessonStatus(lesson.id, "rejected");
      if (pref) await patchPref(pref.id, { enabled: false });
      return Response.json({ ok: true });
    }
    case "edit": {
      const text = typeof b.text === "string" ? b.text.trim().slice(0, 200) : "";
      if (!text) return Response.json({ error: "write the rule text" }, { status: 400 });
      if (!pref) return Response.json({ error: "approve the rule first" }, { status: 409 });
      const p = await patchPref(pref.id, { text, version: pref.version + 1 });
      return p ? Response.json({ ok: true }) : Response.json({ error: "could not save" }, { status: 502 });
    }
    case "toggle": {
      if (!pref || typeof b.enabled !== "boolean")
        return Response.json({ error: "nothing to switch" }, { status: 400 });
      const p = await patchPref(pref.id, { enabled: b.enabled });
      return p ? Response.json({ ok: true }) : Response.json({ error: "could not save" }, { status: 502 });
    }
    default:
      return Response.json({ error: "unknown action" }, { status: 400 });
  }
}
