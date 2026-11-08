import { describe, expect, it } from "vitest";
import { mockSuggestion } from "./mockSuggestion";

describe("mockSuggestion", () => {
  it("gives the same answer for the same input", () => {
    expect(mockSuggestion(70, 1234)).toEqual(mockSuggestion(70, 1234));
  });
  it("follows the stop risk: high risk is blocked, low risk is light", () => {
    expect(mockSuggestion(80, 1).level).toBe(3);
    expect(mockSuggestion(45, 1).level).toBe(2);
    expect(mockSuggestion(10, 1).level).toBe(1);
  });
  it("can come out one level lower, never below 0 and never above 3", () => {
    for (const pct of [undefined, 5, 40, 90]) {
      for (let seed = 0; seed < 50; seed++) {
        const s = mockSuggestion(pct, seed);
        expect(s.level).toBeGreaterThanOrEqual(0);
        expect(s.level).toBeLessThanOrEqual(3);
        expect(s.confidence).toBeGreaterThanOrEqual(0.55);
        expect(s.confidence).toBeLessThanOrEqual(0.9);
      }
    }
  });
  it("always says it is a mock", () => {
    expect(mockSuggestion(50, 7).rationale.startsWith("Mock:")).toBe(true);
  });
});
