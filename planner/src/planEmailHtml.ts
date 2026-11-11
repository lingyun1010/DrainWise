// HTML version of the plan email a manager sends BY HAND to a crew. Same look as the admin report email
// (renderReportHtml): logo header, sample-data banner, numbered cards, footer. Differences: it is read-only for the
// crew and has NO "Review the run" button or any link back to the admin. Pure: same input, same HTML. SAMPLE DATA.
import { C, FONT, esc } from "./reportHtml";
import type { PlanEmailStop } from "./planEmail";

export type PlanHtmlOptions = { logoSrc: string };

function stopCard(s: PlanEmailStop, i: number): string {
  const level = s.level ? s.level[0].toUpperCase() + s.level.slice(1) : null;
  const badge =
    level && s.pct !== undefined
      ? `<span style="display:inline-block;margin-left:6px;padding:2px 10px;border-radius:999px;background:${s.level === "high" ? C.orange : s.level === "medium" ? C.yellow : C.blue};color:${C.ink};font-weight:bold;font-size:14px">${esc(level)} ${Math.round(s.pct)}%</span>`
      : "";
  const load =
    s.load !== undefined ? ` <span style="color:${C.inkMute}">&middot; about ${s.load.toFixed(2)} m&sup3;</span>` : "";
  const photos = s.hasCamera ? "Camera site: no photos needed" : "Photos needed: before and after";
  const reasons = (s.reasons ?? [])
    .filter((w) => !/^Asset type/.test(w))
    .slice(0, 3)
    .map((w) => `<li style="margin:0 0 2px 0;color:${C.ink}">${esc(w)}</li>`)
    .join("");
  return `<tr><td style="padding:0 0 12px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #C9D9E4;border-radius:12px">
<tr><td style="padding:14px 16px;font-family:${FONT};font-size:15px;line-height:1.5;color:${C.ink}">
<span style="font-size:13px;color:${C.inkMute}">Stop ${i + 1}.</span>
<strong style="font-size:17px">${esc(s.id)}</strong>${badge}${load}
<div style="font-size:14px;color:${C.inkMute}">${photos}</div>
${reasons ? `<ul style="margin:8px 0 0 0;padding:0 0 0 20px;font-size:14px">${reasons}</ul>` : ""}
</td></tr></table></td></tr>`;
}

export function renderPlanHtml(
  stops: readonly PlanEmailStop[],
  capacity: number,
  dateLabel: string,
  opts: PlanHtmlOptions,
): string {
  const n = stops.length;
  const total = stops.reduce((m, s) => m + (s.load ?? 0), 0);
  const loadLine = total > 0 ? ` Estimated load ${total.toFixed(1)} of ${capacity.toFixed(1)} m&sup3;.` : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Run plan: ${n} stop${n === 1 ? "" : "s"}</title></head>
<body style="margin:0;padding:0;background:${C.paper}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid #C9D9E4;border-radius:16px">
<tr><td style="background:${C.navy};border-radius:16px 16px 0 0;padding:20px 24px">
<img src="${esc(opts.logoSrc)}" alt="DrainWise" width="180" style="display:block;border:0;width:180px;height:auto">
<div style="padding-top:8px;font-family:${FONT};font-size:13px;color:${C.mute}">Clean the right gross pollutant traps before they fill.</div>
</td></tr>
<tr><td style="background:${C.yellow};padding:8px 24px;font-family:${FONT};font-size:13px;line-height:1.4;color:${C.ink}"><strong>Demo with sample data.</strong> The GPTs below are invented, not council assets.</td></tr>
<tr><td style="padding:24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-family:${FONT};font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${C.inkMute};padding:0 0 4px 0">${esc(dateLabel)}</td></tr>
<tr><td style="font-family:${FONT};font-size:26px;font-weight:bold;color:${C.ink};padding:0 0 4px 0">Run plan</td></tr>
<tr><td style="font-family:${FONT};font-size:20px;font-weight:bold;color:#C4551A;padding:0 0 12px 0">${n} stop${n === 1 ? "" : "s"} to clean</td></tr>
<tr><td style="font-family:${FONT};font-size:14px;line-height:1.5;color:${C.inkMute};padding:0 0 16px 0"><strong>Truck:</strong> ${capacity.toFixed(1)} m&sup3; (assumption).${loadLine} Stops are in the order to visit them.</td></tr>
${stops.map((s, i) => stopCard(s, i)).join("")}
<tr><td style="padding:0 0 16px 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.ink}"><strong>This plan is read-only.</strong> It is a suggestion for the contractor, who picks the day and the people. Open the Crew page and sign in to accept the run and close each job.</td></tr>
</table>
</td></tr>
<tr><td style="border-top:1px solid #C9D9E4;padding:16px 24px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.inkMute}">
Risk scores are estimates from a model trained on simulated data. They are not observed blockages. Load sizes are sample estimates.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
