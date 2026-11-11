import { describe, expect, it } from "vitest";
import { MAX_INPUT_CHARS, MAX_TURNS, allowToday, checkMessages } from "./chatGuards";
import { crewProgress, rainOutlook, rankedTop } from "./chatTools";

describe("checkMessages", () => {
  it("accepts a question", () => {
    expect(checkMessages([{ role: "user", content: "rain?" }])).toMatchObject({ ok: true });
  });
  it("rejects a non-list, an empty list and a bad role", () => {
    expect(checkMessages("hi")).toMatchObject({ ok: false });
    expect(checkMessages([])).toMatchObject({ ok: false });
    expect(checkMessages([{ role: "system", content: "x" }])).toMatchObject({ ok: false });
  });
  it("rejects a long or empty question", () => {
    expect(checkMessages([{ role: "user", content: "a".repeat(MAX_INPUT_CHARS + 1) }])).toMatchObject({ ok: false });
    expect(checkMessages([{ role: "user", content: "   " }])).toMatchObject({ ok: false });
  });
  it("needs the last message to be from the user", () => {
    expect(checkMessages([{ role: "assistant", content: "hi" }])).toMatchObject({ ok: false });
  });
  it("keeps only the last turns and starts with a user message", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
    many.push({ role: "user", content: "last" });
    const r = checkMessages(many);
    expect(r.ok && r.messages.length <= MAX_TURNS && r.messages[0].role === "user").toBe(true);
  });
});

describe("allowToday", () => {
  it("stops at the cap and resets the next day", () => {
    const c = { day: "", n: 0 };
    const day1 = Date.UTC(2026, 10, 11, 5);
    expect(allowToday(c, day1, 2)).toBe(true);
    expect(allowToday(c, day1, 2)).toBe(true);
    expect(allowToday(c, day1, 2)).toBe(false);
    expect(allowToday(c, day1 + 24 * 3600_000, 2)).toBe(true);
  });
});

describe("tool results", () => {
  it("ranks the highest probability first and caps at 99%", () => {
    const top = rankedTop(
      [
        { asset_id: "GPT-001", p_block: 0.2, level: "low", reasons: [] },
        { asset_id: "GPT-002", p_block: 0.999, level: "high", reasons: ["Heavy tree cover nearby"] },
      ],
      1,
    );
    expect(top).toEqual([{ gpt: "GPT-002", blockage_pct: 99, level: "high", reasons: ["Heavy tree cover nearby"] }]);
  });
  it("shapes the BoM outlook", () => {
    const r = rainOutlook({
      issuedAt: "x",
      source: "BoM",
      days: [{ date: "2026-11-12", precis: "Showers", popPct: 70, lowMm: 2, highMm: 6 }],
    });
    expect(r.days[0]).toMatchObject({ chance_of_rain_pct: 70, rain_mm_likely: 4 });
  });
  it("summarises crews, including a missing run and junk input", () => {
    const out = crewProgress({
      crews: [
        { id: "c1", name: "Crew A" },
        { id: "c2", name: "Crew B" },
      ],
      runs: { c1: { accepted: true, stops: [{ id: "a" }, { id: "b" }], done: ["a"] } },
    });
    expect(out).toEqual([
      { crew: "Crew A", status: "working", stops_done: 1, stops_total: 2, stops_skipped: 0 },
      { crew: "Crew B", status: "no run" },
    ]);
    expect(crewProgress(null)).toEqual([]);
  });
});

describe("rulesSummary", () => {
  it("lists only approved rules and counts the proposed ones", async () => {
    const { rulesSummary } = await import("./chatTools");
    const out = rulesSummary(
      [
        { id: "a", status: "approved", count: 4 },
        { id: "b", status: "rejected", count: 3 },
        { id: "c", status: "proposed", count: 3 },
      ],
      [
        { lesson_id: "a", text: "Creek-side GPTs first", enabled: true, version: 2 },
        { lesson_id: "b", text: "Rejected rule", enabled: true, version: 1 },
      ],
    );
    expect(out.rules).toEqual([{ text: "Creek-side GPTs first", on: true, version: 2, supporting_edits: 4 }]);
    expect(out.proposed_waiting_for_approval).toBe(1);
    expect(out.data).toContain("SIMULATION");
  });
});
