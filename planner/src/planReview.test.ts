import { describe, expect, it } from "vitest";
import {
  canConfirm,
  checkPlanInput,
  editLogLine,
  editReasonText,
  missingReasons,
  reasonError,
  rememberLines,
  tidyEdits,
  type PlanEdit,
  type PlanStop,
} from "./planReview";

const s = (id: string, load = 1): PlanStop => ({ id, load, photosNeeded: true });
const proposed = [s("GPT-001"), s("GPT-002"), s("GPT-003")];
const rm = (id: string, reason: PlanEdit["reason"] = "access", note?: string): PlanEdit => ({
  id,
  action: "remove",
  reason,
  note,
});

describe("reasonError", () => {
  it("needs a reason", () => expect(reasonError(null, "")).toMatch(/reason/));
  it("needs words for Other", () => {
    expect(reasonError("other", "  ")).toMatch(/why/);
    expect(reasonError("other", "school event")).toBeNull();
  });
  it("accepts a preset with no note", () => expect(reasonError("recent", "")).toBeNull());
  it("caps the note", () => expect(reasonError("access", "x".repeat(201))).toMatch(/200/));
});

describe("canConfirm", () => {
  it("allows an unchanged suggestion", () => {
    expect(canConfirm(proposed, proposed, [], 3).ok).toBe(true);
  });
  it("blocks a removal with no reason", () => {
    const r = canConfirm(proposed, [s("GPT-001"), s("GPT-002")], [], 3);
    expect(r).toEqual({ ok: false, error: expect.stringContaining("GPT-003") });
  });
  it("blocks Other with an empty note", () => {
    const final = [s("GPT-001"), s("GPT-002")];
    expect(canConfirm(proposed, final, [rm("GPT-003", "other", " ")], 3).ok).toBe(false);
  });
  it("allows a removal with a reason", () => {
    const final = [s("GPT-001"), s("GPT-002")];
    expect(canConfirm(proposed, final, [rm("GPT-003")], 3).ok).toBe(true);
  });
  it("blocks an empty run", () => {
    expect(canConfirm(proposed, [], [rm("GPT-001"), rm("GPT-002"), rm("GPT-003")], 3).ok).toBe(false);
  });
  it("keeps the capacity rule when an admin adds a stop", () => {
    const final = [...proposed, s("GPT-009", 2)];
    const add: PlanEdit = { id: "GPT-009", action: "add", reason: "priority" };
    expect(canConfirm(proposed, final, [add], 3).ok).toBe(false);
    expect(canConfirm(proposed, final, [add], 5).ok).toBe(true);
  });
});

describe("missingReasons / tidyEdits", () => {
  it("lists removed stops without a valid edit", () => {
    expect(missingReasons(proposed, [s("GPT-001")], [rm("GPT-002")])).toEqual(["GPT-003"]);
  });
  it("drops edits for stops put back, and duplicates", () => {
    const final = [s("GPT-001"), s("GPT-002")];
    const out = tidyEdits(proposed, final, [rm("GPT-003"), rm("GPT-003", "crew"), rm("GPT-001")]);
    expect(out.map((e) => `${e.id}:${e.reason}`)).toEqual(["GPT-003:access"]);
  });
});

describe("wording", () => {
  it("log line names the stop and the reason", () => {
    expect(editLogLine(rm("GPT-014", "recent"))).toBe(
      "Admin removed GPT-014 from the suggestion: Cleaned or checked recently",
    );
  });
  it("Other shows the typed words", () => {
    expect(editReasonText(rm("GPT-014", "other", "school event"))).toBe("school event");
    expect(editReasonText(rm("GPT-014", "access", "gate locked"))).toBe("Road or site not reachable: gate locked");
  });
  it("remember lines match the edits", () => {
    expect(rememberLines([rm("GPT-014", "crew")])).toEqual(["Removed GPT-014: Not enough crew time"]);
  });
});

describe("checkPlanInput", () => {
  const base = {
    team: "ABCD",
    source: "manual",
    status: "pending",
    proposed,
    final: proposed,
    edits: [],
    context: { day: "Today", capacity: 3 },
  };
  it("accepts a good pending record", () => expect(checkPlanInput(base).ok).toBe(true));
  it("rejects a bad team code", () => expect(checkPlanInput({ ...base, team: "ab" }).ok).toBe(false));
  it("rejects an unknown source", () => expect(checkPlanInput({ ...base, source: "web" }).ok).toBe(false));
  it("rejects a confirmed record with a removal and no reason", () => {
    const r = checkPlanInput({ ...base, status: "confirmed", final: [s("GPT-001")], edits: [] });
    expect(r.ok).toBe(false);
  });
  it("accepts a confirmed record with reasons", () => {
    const r = checkPlanInput({
      ...base,
      status: "confirmed",
      final: [s("GPT-001")],
      edits: [rm("GPT-002"), rm("GPT-003")],
    });
    expect(r.ok).toBe(true);
  });
  it("rejects junk stops", () => {
    expect(checkPlanInput({ ...base, proposed: [{ id: "x y", load: 1, photosNeeded: true }] }).ok).toBe(false);
  });
  it("allows a record with no team (local only)", () => expect(checkPlanInput({ ...base, team: null }).ok).toBe(true));
});
