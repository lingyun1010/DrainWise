import { describe, expect, it } from "vitest";
import { parseSuggestion } from "./parseSuggestion";

describe("parseSuggestion", () => {
  it("accepts a valid reply", () => {
    const r = parseSuggestion('{"level":2,"confidence":0.7,"rationale":" Leaves cover half the grate. "}');
    expect(r).toEqual({
      ok: true,
      suggestion: { level: 2, confidence: 0.7, rationale: "Leaves cover half the grate." },
    });
  });

  it("clamps confidence to 0-1", () => {
    const hi = parseSuggestion('{"level":1,"confidence":4,"rationale":"x"}');
    const lo = parseSuggestion('{"level":1,"confidence":-1,"rationale":"x"}');
    expect(hi.ok && hi.suggestion.confidence).toBe(1);
    expect(lo.ok && lo.suggestion.confidence).toBe(0);
  });

  it("rejects a level outside 0-3, including a string or a decimal", () => {
    for (const level of ["2", 4, -1, 1.5, null]) {
      expect(parseSuggestion(JSON.stringify({ level, confidence: 0.5, rationale: "x" })).ok).toBe(false);
    }
  });

  it("rejects text that is not a JSON object", () => {
    expect(parseSuggestion("not json").ok).toBe(false);
    expect(parseSuggestion("null").ok).toBe(false);
    expect(parseSuggestion("[1,2]").ok).toBe(false);
  });

  it("rejects a missing or non-numeric confidence", () => {
    expect(parseSuggestion('{"level":1,"rationale":"x"}').ok).toBe(false);
    expect(parseSuggestion('{"level":1,"confidence":"high","rationale":"x"}').ok).toBe(false);
  });

  it("caps a very long rationale", () => {
    const r = parseSuggestion(JSON.stringify({ level: 0, confidence: 0.5, rationale: "a".repeat(1000) }));
    expect(r.ok && r.suggestion.rationale.length).toBe(280);
  });
});
