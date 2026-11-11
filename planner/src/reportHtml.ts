// HTML version of the risk report email. Email clients ignore <style>, classes and web fonts, so this is table layout
// with inline styles and system fonts only. Pure: same Report in, same HTML out. SAMPLE DATA throughout.
// Colours follow the app (navy, orange High, blue accent). Risk is a text label plus a percent, never colour alone.
import { DAYS } from "./horizon";
import { HIGH_AT } from "./riskModel";
import { STORM_MIN_CHANCE_PCT, STORM_MIN_MM } from "./reportRule";
import type { Report } from "./reportBuilder";

export type HtmlOptions = {
  logoSrc: string; // "cid:drainwise-logo" in the real email, a public path in the browser preview
  reviewUrl?: string; // link for the "Review the run" button; no button when absent
};

const C = {
  navy: "#0B2233",
  panel: "#12304A",
  line: "#2A4B66",
  text: "#EAF4FA",
  mute: "#9DBBD0",
  orange: "#FF8A4C",
  blue: "#4FC3EA",
  yellow: "#FFD27A",
  paper: "#F3F7FA",
  ink: "#0B2233",
  inkMute: "#4A6678",
};
const FONT = "Arial, Helvetica, sans-serif";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const pct = (p: number) => `${Math.round(p * 100)}%`;

function gptCard(r: Report["rows"][number], i: number, weekly: boolean): string {
  const when = weekly ? ` <span style="color:${C.inkMute}">&middot; First at risk: ${esc(DAYS[r.day])}</span>` : "";
  const camera = r.hasCamera ? ` <span style="color:${C.inkMute}">&middot; Camera site</span>` : "";
  const reasons = r.reasons
    .filter((w) => !/^Asset type/.test(w)) // always "GPT" in this product, so it adds nothing
    .map((w) => `<li style="margin:0 0 2px 0;color:${C.ink}">${esc(w)}</li>`)
    .join("");
  return `<tr><td style="padding:0 0 12px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #C9D9E4;border-radius:12px">
<tr><td style="padding:14px 16px;font-family:${FONT};font-size:15px;line-height:1.5;color:${C.ink}">
<span style="font-size:13px;color:${C.inkMute}">${i + 1}.</span>
<strong style="font-size:17px">${esc(r.id)}</strong>
<span style="display:inline-block;margin-left:6px;padding:2px 10px;border-radius:999px;background:${C.orange};color:${C.ink};font-weight:bold;font-size:14px">High ${pct(r.p)}</span>${when}${camera}
<ul style="margin:8px 0 0 0;padding:0 0 0 20px;font-size:14px">${reasons}</ul>
</td></tr></table></td></tr>`;
}

export function renderReportHtml(report: Report, opts: HtmlOptions): string {
  const weekly = report.kind === "weekly_7day";
  const n = report.rows.length;
  const headline = weekly ? "Weekly GPT report" : "Storm tomorrow";
  const horizon = weekly ? "the next 7 days (Today to In 6 days)" : "tomorrow (1-day view)";
  const summary = n === 0 ? "No GPT to check" : `${n} GPT${n === 1 ? "" : "s"} to check`;
  const high = `High (${Math.round(HIGH_AT * 100)}%+)`;

  const list =
    n === 0
      ? `<tr><td style="padding:0 0 12px 0;font-family:${FONT};font-size:16px;line-height:1.5;color:${C.ink}">No GPT is predicted to be ${high} in this period.</td></tr>`
      : report.rows.map((r, i) => gptCard(r, i, weekly)).join("");

  const button = opts.reviewUrl
    ? `<tr><td style="padding:8px 0 20px 0"><a href="${esc(opts.reviewUrl)}" style="display:inline-block;padding:12px 22px;border-radius:12px;background:${C.blue};color:${C.ink};font-family:${FONT};font-size:16px;font-weight:bold;text-decoration:none">Review the run</a></td></tr>`
    : "";

  const suggestion =
    n === 0
      ? ""
      : `<tr><td style="padding:0 0 16px 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.ink}"><strong>Suggestion for the contractor (not an instruction):</strong> clean the GPTs at the top of this list first, and group nearby ones into one truck run.</td></tr>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(report.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.paper}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid #C9D9E4;border-radius:16px">
<tr><td style="background:${C.navy};border-radius:16px 16px 0 0;padding:20px 24px">
<img src="${esc(opts.logoSrc)}" alt="DrainWise" width="180" style="display:block;border:0;width:180px;height:auto">
<div style="padding-top:8px;font-family:${FONT};font-size:13px;color:${C.mute}">Clean the right gross pollutant traps before they fill.</div>
</td></tr>
<tr><td style="background:${C.yellow};padding:8px 24px;font-family:${FONT};font-size:13px;line-height:1.4;color:${C.ink}"><strong>Demo with sample data.</strong> The GPTs and the model below are simulated, not council records.</td></tr>
<tr><td style="padding:24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-family:${FONT};font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${C.inkMute};padding:0 0 4px 0">${esc(report.dateLabel)}</td></tr>
<tr><td style="font-family:${FONT};font-size:26px;font-weight:bold;color:${C.ink};padding:0 0 4px 0">${headline}</td></tr>
<tr><td style="font-family:${FONT};font-size:20px;font-weight:bold;color:#C4551A;padding:0 0 12px 0">${summary}</td></tr>
<tr><td style="font-family:${FONT};font-size:14px;line-height:1.5;color:${C.inkMute};padding:0 0 4px 0"><strong>Why this report:</strong> ${esc(report.why)}</td></tr>
<tr><td style="font-family:${FONT};font-size:14px;line-height:1.5;color:${C.inkMute};padding:0 0 16px 0"><strong>Horizon:</strong> ${esc(horizon)}. Listed when the predicted chance of blocking is ${high}.</td></tr>
${list}
${suggestion}
${button}
</table>
</td></tr>
<tr><td style="border-top:1px solid #C9D9E4;padding:16px 24px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.inkMute}">
Storm assumption: tomorrow counts as a storm at ${STORM_MIN_CHANCE_PCT}%+ chance of rain and ${STORM_MIN_MM} mm or more (BoM range). This is an assumption, not a council level.<br>
Predictions are estimates from a model trained on simulated data. They are not observed blockages.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
