import { describe, expect, it } from "vitest";
import { parseBand, parseDamage, parseNote, parseShapes, sourceOf } from "./annotations";

describe("parseShapes", () => {
  it("accepts a circle and an arrow and trims the caption", () => {
    const out = parseShapes([
      { id: "a1", kind: "circle", x: 0.5, y: 0.4, r: 0.1, caption: "  torn net  " },
      { id: "a2", kind: "arrow", x: 0.1, y: 0.1, x2: 0.4, y2: 0.4, caption: "" },
    ]);
    expect(out).toHaveLength(2);
    expect(out?.[0].caption).toBe("torn net");
  });
  it("rejects out of range, unknown kinds, bad ids and too many shapes", () => {
    expect(parseShapes([{ id: "a", kind: "circle", x: 1.2, y: 0.4, r: 0.1 }])).toBeNull();
    expect(parseShapes([{ id: "a", kind: "circle", x: 0.5, y: 0.4, r: 0 }])).toBeNull();
    expect(parseShapes([{ id: "a", kind: "star", x: 0.5, y: 0.4 }])).toBeNull();
    expect(parseShapes([{ id: "a b", kind: "arrow", x: 0, y: 0, x2: 1, y2: 1 }])).toBeNull();
    expect(
      parseShapes(Array.from({ length: 21 }, (_, i) => ({ id: `s${i}`, kind: "arrow", x: 0, y: 0, x2: 1, y2: 1 }))),
    ).toBeNull();
    expect(parseShapes("nope")).toBeNull();
  });
  it("accepts an empty list (delete all marks)", () => {
    expect(parseShapes([])).toEqual([]);
  });
});

describe("band, damage, note", () => {
  it("band is a 10% step from 0 to 100", () => {
    expect(parseBand(40)).toBe(40);
    expect(parseBand(45)).toBeNull();
    expect(parseBand(110)).toBeNull();
    expect(parseBand("40")).toBeNull();
  });
  it("damage must be one of the four values", () => {
    expect(parseDamage("net_broken")).toBe("net_broken");
    expect(parseDamage("rust")).toBeNull();
  });
  it("note is cut and stripped of control characters", () => {
    expect(parseNote("a\nb")).toBe("a b");
    expect(parseNote("x".repeat(500))).toHaveLength(300);
    expect(parseNote(5)).toBe("");
  });
});

describe("sourceOf", () => {
  it("keeps the prefill source until the admin changes the value", () => {
    expect(sourceOf({ value: 40, source: "mock" }, 40)).toBe("mock");
    expect(sourceOf({ value: 40, source: "mock" }, 50)).toBe("admin");
  });
});
