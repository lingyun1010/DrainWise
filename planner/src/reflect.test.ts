import { describe, it, expect } from "vitest";
import { parseLessons, buildReflectPrompt, MIN_SUPPORT, type EvidenceEdit } from "./reflect";

const edits: EvidenceEdit[] = Array.from({ length: 6 }, (_, i) => ({
  id: `e${i + 1}`,
  action: i % 2 ? "add" : "remove",
  assetId: `GPT-00${i + 1}`,
  reason: "Creek-side GPT should go first",
}));
const ids = new Set(edits.map((e) => e.id));

describe("parseLessons", () => {
  it("keeps a lesson with at least k known supporting edits and marks it proposed", () => {
    const raw = JSON.stringify({
      lessons: [{ statement: "Creek-side GPTs go first", kind: "creek_first", editIds: ["e1", "e2", "e3"] }],
    });
    const out = parseLessons(raw, ids);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      statement: "Creek-side GPTs go first",
      kind: "creek_first",
      count: 3,
      status: "proposed",
    });
  });

  it("drops a lesson with fewer than k supporting edits", () => {
    expect(MIN_SUPPORT).toBe(3);
    const raw = JSON.stringify({ lessons: [{ statement: "x", kind: "creek_first", editIds: ["e1", "e2"] }] });
    expect(parseLessons(raw, ids)).toEqual([]);
  });

  it("ignores edit ids that do not exist and duplicates when counting", () => {
    const raw = JSON.stringify({
      lessons: [{ statement: "x", kind: "creek_first", editIds: ["e1", "e1", "e2", "zzz"] }],
    });
    expect(parseLessons(raw, ids)).toEqual([]);
  });

  it("drops lessons with an unknown kind or an empty statement", () => {
    const raw = JSON.stringify({
      lessons: [
        { statement: "x", kind: "make_coffee", editIds: ["e1", "e2", "e3"] },
        { statement: "  ", kind: "creek_first", editIds: ["e1", "e2", "e3"] },
      ],
    });
    expect(parseLessons(raw, ids)).toEqual([]);
  });

  it("returns nothing for text that is not the expected JSON, and tolerates a code fence", () => {
    expect(parseLessons("sorry, no", ids)).toEqual([]);
    expect(parseLessons("{}", ids)).toEqual([]);
    const fenced =
      "```json\n" +
      JSON.stringify({ lessons: [{ statement: "s", kind: "drop_far_after_rain", editIds: ["e1", "e2", "e3"] }] }) +
      "\n```";
    expect(parseLessons(fenced, ids)).toHaveLength(1);
  });
});

describe("buildReflectPrompt", () => {
  it("lists each edit with its id and reason and asks for JSON only", () => {
    const p = buildReflectPrompt(edits, { weeks: 6 });
    expect(p).toContain("e1");
    expect(p).toContain("Creek-side GPT should go first");
    expect(p).toContain("JSON");
    expect(p).toContain("at least 3");
  });
});

describe("evidenceFromWeeks", () => {
  it("numbers edits per week so lessons can cite them", async () => {
    const { evidenceFromWeeks } = await import("./reflect");
    const ev = evidenceFromWeeks([
      {
        simulation: "Simulation, not a real council officer",
        week: 2,
        context: { heavyRain: false, capacity: 3 },
        proposed: [],
        final: [],
        finalLoad: 0,
        rulesUsed: [],
        edits: [
          { action: "add", assetId: "A", reason: "r" },
          { action: "remove", assetId: "B", reason: "r" },
        ],
      },
    ]);
    expect(ev.map((e) => e.id)).toEqual(["w2-1", "w2-2"]);
  });
});
