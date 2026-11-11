import { describe, expect, it } from "vitest";
import { MAX_PLAN_STOPS, buildPlanEmail, checkStopIds, clampCapacity } from "./planEmail";

const known = new Set(["GPT-001", "GPT-002", "GPT-003"]);

describe("checkStopIds", () => {
  it("accepts known, unique ids", () => {
    expect(checkStopIds(["GPT-002", "GPT-001"], known)).toEqual(["GPT-002", "GPT-001"]);
  });
  it("rejects empty, unknown, duplicate, non-string and too many", () => {
    expect(checkStopIds([], known)).toBeNull();
    expect(checkStopIds(["GPT-999"], known)).toBeNull();
    expect(checkStopIds(["GPT-001", "GPT-001"], known)).toBeNull();
    expect(checkStopIds([1], known)).toBeNull();
    expect(checkStopIds("GPT-001", known)).toBeNull();
    const many = new Set(Array.from({ length: MAX_PLAN_STOPS + 1 }, (_, i) => `G${i}`));
    expect(checkStopIds([...many], many)).toBeNull();
  });
});

describe("clampCapacity", () => {
  it("keeps 1 to 4 in half steps and defaults to 3", () => {
    expect(clampCapacity(9)).toBe(4);
    expect(clampCapacity(0)).toBe(1);
    expect(clampCapacity(2.6)).toBe(2.5);
    expect(clampCapacity("x")).toBe(3);
  });
});

describe("buildPlanEmail", () => {
  const mail = buildPlanEmail(
    [
      { id: "GPT-001", hasCamera: true },
      { id: "GPT-002", hasCamera: false },
    ],
    3,
    "Wednesday, 11 November 2026",
  );
  it("numbers the stops in order and says which need photos", () => {
    expect(mail.subject).toBe("[Sample data] Run plan: 2 stops");
    expect(mail.body).toContain("1. GPT-001  camera site, no photos needed");
    expect(mail.body).toContain("2. GPT-002  photos needed (before and after)");
  });
  it("says it is sample data, a suggestion, and the capacity is an assumption", () => {
    expect(mail.body).toMatch(/sample data/i);
    expect(mail.body).toContain("3.0 m³ (assumption)");
    expect(mail.body).toMatch(/suggestion for the contractor/);
  });
});
