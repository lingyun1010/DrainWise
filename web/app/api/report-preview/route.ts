// Preview of the risk report: which rule fired and why, plus the subject and body. Sends nothing, needs no credentials.
import { FORCES, previewReport, type Force } from "@/lib/reportJob";
import { lastSent } from "@/lib/reportHistory";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { force?: string };
  const force = (FORCES as readonly string[]).includes(body.force ?? "") ? (body.force as Force) : "bom";
  const r = await previewReport(force, lastSent());
  return r.ok ? Response.json(r.value) : Response.json({ error: r.error }, { status: r.status });
}
