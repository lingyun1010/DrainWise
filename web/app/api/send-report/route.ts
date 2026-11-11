// Sends the risk report over Gmail SMTP. SERVER ONLY. Credentials come from env vars (GMAIL_USER, GMAIL_APP_PASSWORD),
// never from the client. The report is rebuilt here, so the browser cannot choose the text. The address is used for
// this one send and is not stored; only a masked form is logged and returned.
import nodemailer from "nodemailer";
import path from "node:path";
import { FORCES, previewReport, reviewUrl, type Force } from "@/lib/reportJob";
import { lastSent, markSent } from "@/lib/reportHistory";
import { renderReportHtml } from "../../../../planner/src/reportHtml";
import {
  makeLimiter,
  maskAddress,
  keyMatches,
  sendBlocked,
  sendReportMail,
  validAddress,
} from "../../../../planner/src/sendReport";

const perClient = makeLimiter(3, Date.now); // 3 sends per hour per client
const overall = makeLimiter(10, Date.now); // 10 sends per hour in total (keeps well inside Gmail's daily limit)

export async function POST(request: Request) {
  // REPORT_EMAIL_MOCK=1 is for local tests and the smoke run: the whole flow runs but nothing leaves the server.
  const mock = process.env.REPORT_EMAIL_MOCK === "1" && process.env.NODE_ENV !== "production"; // never in production
  const blocked = sendBlocked(
    mock
      ? {
          ...process.env,
          GMAIL_USER: "mock",
          GMAIL_APP_PASSWORD: "mock",
          REPORT_ADMIN_KEY: process.env.REPORT_ADMIN_KEY ?? "mock",
        }
      : process.env,
  );
  if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });

  if (!keyMatches(request.headers.get("x-report-key"), process.env.REPORT_ADMIN_KEY ?? (mock ? "mock" : undefined))) {
    return Response.json({ error: "Admin key missing or wrong." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { to?: unknown; force?: string };
  if (!validAddress(body.to)) return Response.json({ error: "Enter one valid email address." }, { status: 400 });
  const force = (FORCES as readonly string[]).includes(body.force ?? "") ? (body.force as Force) : "bom";

  const p = await previewReport(force, lastSent());
  if (!p.ok) return Response.json({ error: p.error }, { status: p.status });
  const { decision, report } = p.value;
  if (!report || decision.kind === "none") return Response.json({ sent: false, rule: "none", reason: decision.reason });
  if (!report.send) {
    return Response.json({
      sent: false,
      rule: decision.kind,
      reason: "Storm report has no GPT to list, so nothing was sent.",
    });
  }

  // Counted only when a mail is really about to go out, so a "nothing to send" answer does not use up the quota.
  const client =
    request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "local";
  if (!perClient(client) || !overall("all")) {
    return Response.json({ error: "Too many reports this hour. Try again later." }, { status: 429 });
  }

  const masked = maskAddress(body.to);
  try {
    const transport = mock
      ? { sendMail: async () => undefined }
      : nodemailer.createTransport({
          service: "gmail",
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
        });
    // Designed HTML mail with the logo inlined (cid), plus the plain text for clients that do not show HTML.
    const html = renderReportHtml(report, { logoSrc: "cid:drainwise-logo", reviewUrl: reviewUrl() });
    const logo = {
      filename: "drainwise-logo.png",
      path: path.join(process.cwd(), "public", "brand-wordmark.png"),
      cid: "drainwise-logo",
    };
    await sendReportMail(transport, process.env.GMAIL_USER ?? "mock", body.to, report.subject, report.body, {
      html,
      attachments: [logo],
    });
  } catch {
    console.error(`[send-report] failed rule=${decision.kind} to=${masked}`);
    return Response.json({ error: "Gmail refused the message. Check the app password." }, { status: 502 });
  }
  if (force === "bom") markSent(decision.kind);
  console.log(`[send-report] sent rule=${decision.kind} to=${masked}`);
  return Response.json({ mock, sent: true, rule: decision.kind, masked, reason: decision.reason });
}
