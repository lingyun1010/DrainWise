import { describe, expect, it } from "vitest";
import { buildReport, type ReportRow } from "./reportBuilder";
import { renderReportHtml } from "./reportHtml";

const rows: ReportRow[] = [
  {
    id: "GPT-014",
    p: 0.82,
    day: 2,
    reasons: ["Heavy tree cover nearby", "Last cleaned 160 days ago"],
    hasCamera: false,
  },
  { id: "GPT-007", p: 0.64, day: 0, reasons: ["Heavy rain forecast"], hasCamera: true },
];
const weekly = buildReport("weekly_7day", rows, "Monday, 9 November 2026", "Monday, so the weekly report is due.");
const storm = buildReport("storm_1day", rows, "Sunday, 8 November 2026", "Storm forecast for tomorrow.");

describe("renderReportHtml", () => {
  it("uses tables and inline styles only, with the logo as the given src", () => {
    const html = renderReportHtml(weekly, { logoSrc: "cid:logo" });
    expect(html).toMatch(/<table/);
    expect(html).not.toMatch(/<style|<script|class=/);
    expect(html).toContain('src="cid:logo"');
    expect(html).toContain('alt="DrainWise"');
  });
  it("lists every GPT with its percent, a text label (not colour alone), and reasons", () => {
    const html = renderReportHtml(weekly, { logoSrc: "x" });
    expect(html).toContain("GPT-014");
    expect(html).toContain("High 82%");
    expect(html).toContain("Heavy tree cover nearby");
    expect(html).toContain("Camera site");
    expect(html).toContain("2 GPTs to check");
  });
  it("shows the first day at risk for the weekly view only", () => {
    expect(renderReportHtml(weekly, { logoSrc: "x" })).toContain("First at risk");
    expect(renderReportHtml(storm, { logoSrc: "x" })).not.toContain("First at risk");
  });
  it("always carries the sample-data notice and the suggestion wording", () => {
    const html = renderReportHtml(weekly, { logoSrc: "x" });
    expect(html).toMatch(/sample data/i);
    expect(html).toMatch(/not an instruction/);
    expect(html).toMatch(/simulated data/);
  });
  it("an empty weekly report says so and has no table of GPTs", () => {
    const empty = buildReport("weekly_7day", [], "d", "w");
    const html = renderReportHtml(empty, { logoSrc: "x" });
    expect(html).toContain("No GPT is predicted to be High");
    expect(html).not.toContain("First at risk");
  });
  it("renders the button only when a link is given, and escapes text", () => {
    expect(renderReportHtml(weekly, { logoSrc: "x" })).not.toContain("Review the run");
    expect(renderReportHtml(weekly, { logoSrc: "x", reviewUrl: "https://example.com/?role=manager" })).toContain(
      'href="https://example.com/?role=manager"',
    );
    const evil = buildReport("weekly_7day", [{ ...rows[0], id: "<b>x</b>" }], "d", "w");
    const html = renderReportHtml(evil, { logoSrc: "x" });
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
