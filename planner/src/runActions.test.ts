import { describe, expect, it } from "vitest";
import {
  declineRun,
  endRunEarly,
  endsRun,
  isOpen,
  openStops,
  reasonsFor,
  recentReturners,
  skipStop,
  type Returned,
} from "./runActions";

const AT = "2026-11-09T02:00:00.000Z";
type Run = Parameters<typeof openStops>[0];
const mk = (over: Partial<Run> = {}): Run => ({
  runId: "r1",
  crew: "c1",
  stops: [{ id: "A" }, { id: "B" }, { id: "C" }],
  done: [],
  accepted: true,
  ...over,
});
const st = (run?: Run, returns?: Returned[]) => ({ runs: { c1: run } as Record<string, Run | undefined>, returns });

describe("reasons", () => {
  it("offers 'full' only after a stop is cleaned, and never on decline", () => {
    expect(reasonsFor("decline", 0).map((r) => r.id)).not.toContain("full");
    expect(reasonsFor("decline", 2).map((r) => r.id)).not.toContain("full");
    expect(reasonsFor("end", 0).map((r) => r.id)).not.toContain("full");
    expect(reasonsFor("end", 1).map((r) => r.id)).toContain("full");
    expect(reasonsFor("skip", 1).map((r) => r.id)).toContain("full");
  });
  it("full, breakdown and no_time end the run; the rest skip one stop", () => {
    expect(["full", "breakdown", "no_time"].every((r) => endsRun(r as never))).toBe(true);
    expect(["no_access", "unavailable", "other"].some((r) => endsRun(r as never))).toBe(false);
  });
});

describe("declineRun", () => {
  it("clears the run and returns every stop with its reason", () => {
    const s = declineRun(st(mk({ accepted: false })), "c1", "unavailable", AT);
    expect(s.runs.c1).toBeUndefined();
    expect(s.returns?.map((r) => r.stopId).sort()).toEqual(["A", "B", "C"]);
    expect(s.returns?.every((r) => r.kind === "declined" && r.reason === "unavailable")).toBe(true);
  });
  it("does nothing once the run was accepted or when there is no run", () => {
    const a = st(mk());
    expect(declineRun(a, "c1", "other", AT)).toBe(a);
    const none = st();
    expect(declineRun(none, "c1", "other", AT)).toBe(none);
  });
});

describe("endRunEarly", () => {
  it("keeps cleaned stops and sends the rest back", () => {
    const s = endRunEarly(st(mk({ done: ["A"] })), "c1", "full", AT, "bin overflowing");
    expect(s.runs.c1?.stops.map((x) => x.id)).toEqual(["A"]);
    expect(s.runs.c1?.done).toEqual(["A"]);
    expect(s.runs.c1?.ended).toEqual({ reason: "full", note: "bin overflowing", at: AT });
    expect(s.returns?.map((r) => r.stopId).sort()).toEqual(["B", "C"]);
  });
  it("removes the run when nothing was cleaned", () => {
    const s = endRunEarly(st(mk()), "c1", "breakdown", AT);
    expect(s.runs.c1).toBeUndefined();
    expect(s.returns).toHaveLength(3);
  });
  it("does not send back stops that were already skipped a second time", () => {
    const skipped = skipStop(st(mk()), "c1", "A", "no_access", AT);
    const s = endRunEarly(skipped, "c1", "no_time", AT);
    expect(s.returns?.filter((r) => r.stopId === "A")).toHaveLength(1);
    expect(
      s.returns
        ?.filter((r) => r.kind === "ended")
        .map((r) => r.stopId)
        .sort(),
    ).toEqual(["B", "C"]);
  });
  it("ignores a run that was not accepted", () => {
    const a = st(mk({ accepted: false }));
    expect(endRunEarly(a, "c1", "full", AT)).toBe(a);
  });
});

describe("skipStop", () => {
  it("marks one stop skipped and keeps the run going", () => {
    const run = mk({ done: ["A"] });
    const s = skipStop(st(run), "c1", "B", "no_access", AT);
    expect(s.runs.c1?.skipped).toEqual([{ stopId: "B", reason: "no_access", note: undefined, at: AT }]);
    expect(openStops(s.runs.c1!).map((x) => x.id)).toEqual(["C"]);
    expect(isOpen(s.runs.c1!, "B")).toBe(false);
    expect(s.returns?.[0]).toMatchObject({ stopId: "B", kind: "skipped", reason: "no_access", crewId: "c1" });
  });
  it("is not busy after the last stop is skipped", () => {
    let s = st(mk({ done: ["A", "B"] }));
    s = skipStop(s, "c1", "C", "other", AT);
    expect(openStops(s.runs.c1!)).toHaveLength(0);
  });
  it("ends the run when the reason stops the truck", () => {
    const s = skipStop(st(mk({ done: ["A"] })), "c1", "B", "breakdown", AT);
    expect(s.runs.c1?.stops.map((x) => x.id)).toEqual(["A"]);
    expect(s.returns?.every((r) => r.kind === "ended")).toBe(true);
  });
  it("ignores unknown or already cleaned stops", () => {
    const a = st(mk({ done: ["A"] }));
    expect(skipStop(a, "c1", "A", "other", AT)).toBe(a);
    expect(skipStop(a, "c1", "Z", "other", AT)).toBe(a);
  });
});

describe("recentReturners", () => {
  const ret = (crewId: string, stopId: string, at: string): Returned => ({
    stopId,
    crewId,
    runId: "r",
    kind: "skipped",
    reason: "no_access",
    at,
  });
  const now = Date.parse(AT) + 60 * 60 * 1000;
  it("lists crews that returned one of these stops in the last 24 hours", () => {
    const r = [ret("c2", "A", AT), ret("c3", "A", "2026-11-07T00:00:00.000Z"), ret("c1", "Z", AT)];
    expect([...recentReturners(r, ["A", "B"], now)]).toEqual(["c2"]);
  });
  it("is empty with no history", () => {
    expect(recentReturners(undefined, ["A"], now).size).toBe(0);
  });
});
