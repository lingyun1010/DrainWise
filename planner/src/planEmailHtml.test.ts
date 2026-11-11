import { describe, expect, it } from "vitest";
import { renderPlanHtml } from "./planEmailHtml";

const stops = [
  {
    id: "GPT-009",
    hasCamera: false,
    load: 0.9,
    level: "high" as const,
    pct: 72,
    reasons: ["Heavy tree cover nearby <b>"],
  },
  { id: "GPT-014", hasCamera: true, load: 0.5, level: "medium" as const, pct: 41 },
];

describe("renderPlanHtml", () => {
  const html = renderPlanHtml(stops, 3, "Wednesday 11 November 2026", { logoSrc: "cid:drainwise-logo" });
  it("has the same structure as the report email and no admin link", () => {
    expect(html).toContain("cid:drainwise-logo");
    expect(html).toContain("Demo with sample data");
    expect(html).toContain("Run plan");
    expect(html).toContain("2 stops to clean");
    expect(html).not.toMatch(/href=/i);
    expect(html).not.toContain("Review the run");
  });
  it("shows each stop with a text label, not colour alone, and the photo rule", () => {
    expect(html).toContain("High 72%");
    expect(html).toContain("Medium 41%");
    expect(html).toContain("Photos needed: before and after");
    expect(html).toContain("Camera site: no photos needed");
  });
  it("escapes text and says the plan is read-only", () => {
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("read-only");
  });
});
