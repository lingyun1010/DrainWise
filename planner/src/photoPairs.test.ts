import { describe, expect, it } from "vitest";
import { afterCounts, deleteJobPhotos, type PairRow, type PhotoStore } from "./photoPairs";

const row = (id: string, run: string, stop: string, kind: "before" | "after"): PairRow => ({
  id,
  run_id: run,
  stop_id: stop,
  kind,
  path: `${run}/${stop}/${kind}-${id}.jpg`,
});

// In-memory stand-in for Supabase: a table and a bucket that can be made to fail.
function mockStore(rows: PairRow[], fail: { objects?: boolean; rows?: boolean; lookup?: boolean } = {}) {
  const table = new Map(rows.map((r) => [r.id, r]));
  const files = new Set(rows.map((r) => r.path));
  const store: PhotoStore = {
    getRow: async (id) => table.get(id) ?? null,
    findJob: async (run, stop) =>
      fail.lookup ? null : [...table.values()].filter((r) => r.run_id === run && r.stop_id === stop),
    removeObjects: async (paths) => {
      if (fail.objects) return false;
      for (const p of paths) files.delete(p);
      return true;
    },
    removeRows: async (ids) => {
      if (fail.rows) return false;
      for (const i of ids) table.delete(i);
      return true;
    },
  };
  // an orphan is a file with no row, a row with no file, or an after photo whose job has no before photo
  const orphans = () => [
    ...[...table.values()]
      .filter(
        (r) =>
          r.kind === "after" &&
          ![...table.values()].some((b) => b.kind === "before" && b.run_id === r.run_id && b.stop_id === r.stop_id),
      )
      .map((r) => `after without before: ${r.path}`),
    ...[...files].filter((p) => ![...table.values()].some((r) => r.path === p)),
    ...[...table.values()].filter((r) => !files.has(r.path)).map((r) => r.path),
  ];
  return { store, table, files, orphans };
}

const seed = [
  row("b1", "r1", "GPT-001", "before"),
  row("a1", "r1", "GPT-001", "after"),
  row("b2", "r1", "GPT-002", "before"),
  row("a2", "r1", "GPT-002", "after"),
  row("b3", "r2", "GPT-001", "before"), // same stop in another run
  row("a3", "r2", "GPT-001", "after"),
];

describe("deleteJobPhotos", () => {
  it("deletes the before photo and the after photo of the same job, nothing else, no orphans", async () => {
    const m = mockStore(seed);
    const res = await deleteJobPhotos(m.store, "b1", true);
    expect(res).toEqual({ ok: true, before: 1, after: 1, afterKept: 0 });
    expect([...m.table.keys()].sort()).toEqual(["a2", "a3", "b2", "b3"]);
    expect(m.orphans()).toEqual([]);
  });

  it("keeps the after photo when withAfter is false (evidence stays, files and rows still pair)", async () => {
    const m = mockStore(seed);
    expect(await deleteJobPhotos(m.store, "b1", false)).toEqual({ ok: true, before: 1, after: 0, afterKept: 1 });
    expect(m.table.has("a1")).toBe(true);
    // chosen on purpose: file and row still pair, the after photo is kept as evidence
    expect(m.orphans()).toEqual(["after without before: r1/GPT-001/after-a1.jpg"]);
  });

  it("deleting an after photo removes only that photo", async () => {
    const m = mockStore(seed);
    expect(await deleteJobPhotos(m.store, "a1", true)).toEqual({ ok: true, before: 0, after: 1, afterKept: 0 });
    expect(m.table.has("b1")).toBe(true);
  });

  it("removes every after photo of the job if there are several", async () => {
    const m = mockStore([...seed, row("a1b", "r1", "GPT-001", "after")]);
    expect(await deleteJobPhotos(m.store, "b1", true)).toEqual({ ok: true, before: 1, after: 2, afterKept: 0 });
    expect(m.orphans()).toEqual([]);
  });

  it("works for a job with no after photo", async () => {
    const m = mockStore([row("b9", "r9", "GPT-009", "before")]);
    expect(await deleteJobPhotos(m.store, "b9", true)).toEqual({ ok: true, before: 1, after: 0, afterKept: 0 });
    expect(m.table.size).toBe(0);
  });

  it("returns not_found for an unknown id and changes nothing", async () => {
    const m = mockStore(seed);
    expect(await deleteJobPhotos(m.store, "zzz", true)).toEqual({ ok: false, reason: "not_found" });
    expect(m.table.size).toBe(6);
  });

  it("deletes nothing if the pair lookup fails", async () => {
    const m = mockStore(seed, { lookup: true });
    expect(await deleteJobPhotos(m.store, "b1", true)).toEqual({ ok: false, reason: "lookup_failed" });
    expect(m.table.size).toBe(6);
    expect(m.files.size).toBe(6);
  });

  it("deletes no rows if the files could not be removed", async () => {
    const m = mockStore(seed, { objects: true });
    expect(await deleteJobPhotos(m.store, "b1", true)).toEqual({ ok: false, reason: "storage_failed" });
    expect(m.table.size).toBe(6);
    expect(m.orphans()).toEqual([]);
  });

  it("a retry after a row failure finishes the job (files are already gone)", async () => {
    const fail = { rows: true };
    const m = mockStore(seed, fail);
    expect(await deleteJobPhotos(m.store, "b1", true)).toEqual({ ok: false, reason: "rows_failed" });
    expect(m.files.has("r1/GPT-001/before-b1.jpg")).toBe(false); // files removed, rows kept
    fail.rows = false;
    expect(await deleteJobPhotos(m.store, "b1", true)).toMatchObject({ ok: true, before: 1, after: 1 });
    expect(m.orphans()).toEqual([]);
  });

  it("keeps the after photos while another before photo of the job remains", async () => {
    const m = mockStore([...seed, row("b1b", "r1", "GPT-001", "before")]);
    expect(await deleteJobPhotos(m.store, "b1", true)).toEqual({ ok: true, before: 1, after: 0, afterKept: 1 });
    expect(m.table.has("a1")).toBe(true);
    expect(m.orphans()).toEqual([]);
    // deleting the last before photo now takes the after photo with it
    expect(await deleteJobPhotos(m.store, "b1b", true)).toEqual({ ok: true, before: 1, after: 1, afterKept: 0 });
    expect(m.orphans()).toEqual([]);
  });
});

describe("afterCounts", () => {
  it("counts after photos per job", () => {
    const c = afterCounts([
      { run_id: "r1", stop_id: "s1" },
      { run_id: "r1", stop_id: "s1" },
      { run_id: "r2", stop_id: "s1" },
    ]);
    expect(c.get("r1|s1")).toBe(2);
    expect(c.get("r2|s1")).toBe(1);
    expect(c.get("r3|s1")).toBeUndefined();
  });
});
