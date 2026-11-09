// Deleting a stored crew photo (ticket 27). Pure rules plus an orchestrator that talks to an injected
// store, so the "never leave an orphan" behaviour is tested with a mock and no real Supabase.
//
// A job is one stop of one run. Its photos are the job_photos rows with the same run_id and stop_id:
// kind "before" (training candidate) and kind "after" (evidence only). The Storage object path is stored
// in the row, so a row and its file always pair up; an orphan is a file with no row or a row with no file.

export type PairRow = { id: string; run_id: string; stop_id: string; kind: "before" | "after"; path: string };

export type PhotoStore = {
  getRow(id: string): Promise<PairRow | null>;
  // every photo (before and after) of the same run and stop; null if the lookup failed
  findJob(runId: string, stopId: string): Promise<PairRow[] | null>;
  removeObjects(paths: string[]): Promise<boolean>;
  removeRows(ids: string[]): Promise<boolean>;
};

export type DeleteResult =
  | { ok: true; before: number; after: number; afterKept: number }
  | { ok: false; reason: "not_found" | "storage_failed" | "lookup_failed" | "rows_failed" };

// Deletes the photo `id`. The after photos of the job go too only when withAfter is true AND this is the
// last before photo of the job (a stop can have several before photos after a retry; while another one
// remains, the evidence stays with it). Order: look up everything first, then remove files, then rows. A
// failed step stops the run; a retry finishes the job (removing an already-missing file is a no-op).
export async function deleteJobPhotos(store: PhotoStore, id: string, withAfter: boolean): Promise<DeleteResult> {
  const row = await store.getRow(id);
  if (!row) return { ok: false, reason: "not_found" };

  const targets: PairRow[] = [row];
  let afterKept = 0;
  if (row.kind === "before") {
    const job = await store.findJob(row.run_id, row.stop_id);
    if (!job) return { ok: false, reason: "lookup_failed" };
    const afters = job.filter((r) => r.kind === "after");
    const otherBefores = job.filter((r) => r.kind === "before" && r.id !== id);
    if (withAfter && otherBefores.length === 0) targets.push(...afters);
    else afterKept = afters.length;
  }

  if (!(await store.removeObjects(targets.map((t) => t.path)))) return { ok: false, reason: "storage_failed" };
  if (!(await store.removeRows(targets.map((t) => t.id)))) return { ok: false, reason: "rows_failed" };
  return {
    ok: true,
    before: targets.filter((t) => t.kind === "before").length,
    after: targets.filter((t) => t.kind === "after").length,
    afterKept,
  };
}

// How many after photos each job has, keyed "runId|stopId", for the review list and the dialog text.
export function afterCounts(afters: { run_id: string; stop_id: string }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of afters) {
    const k = jobKey(a.run_id, a.stop_id);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export const jobKey = (runId: string, stopId: string) => `${runId}|${stopId}`;
