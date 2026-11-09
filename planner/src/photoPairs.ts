// Deleting a stored crew photo (ticket 27). Pure rules plus an orchestrator that talks to an injected
// store, so the "never leave an orphan" behaviour is tested with a mock and no real Supabase.
//
// A job is one stop of one run. Its photos are the job_photos rows with the same run_id and stop_id:
// kind "before" (training candidate) and kind "after" (evidence only). The Storage object path is stored
// in the row, so a row and its file always pair up; an orphan is a file with no row or a row with no file.

export type PairRow = { id: string; run_id: string; stop_id: string; kind: "before" | "after"; path: string };

export type PhotoStore = {
  getRow(id: string): Promise<PairRow | null>;
  // after photos of the same run and stop
  findAfters(runId: string, stopId: string): Promise<PairRow[] | null>;
  removeObjects(paths: string[]): Promise<boolean>;
  removeRows(ids: string[]): Promise<boolean>;
};

export type DeleteResult =
  | { ok: true; before: number; after: number }
  | { ok: false; reason: "not_found" | "storage_failed" | "lookup_failed" | "rows_failed" };

// Deletes the photo `id`. For a before photo with withAfter true, the after photo(s) of the same job go too.
// Order: look up everything first, then remove files, then rows. A failed step stops the run, so a file is
// never removed while its row is kept without the caller knowing, and a retry finishes the job (removing
// an already-missing file is a no-op).
export async function deleteJobPhotos(store: PhotoStore, id: string, withAfter: boolean): Promise<DeleteResult> {
  const row = await store.getRow(id);
  if (!row) return { ok: false, reason: "not_found" };

  const targets: PairRow[] = [row];
  if (withAfter && row.kind === "before") {
    const afters = await store.findAfters(row.run_id, row.stop_id);
    if (!afters) return { ok: false, reason: "lookup_failed" };
    for (const a of afters) if (a.kind === "after" && !targets.some((t) => t.id === a.id)) targets.push(a);
  }

  if (!(await store.removeObjects(targets.map((t) => t.path)))) return { ok: false, reason: "storage_failed" };
  if (!(await store.removeRows(targets.map((t) => t.id)))) return { ok: false, reason: "rows_failed" };
  return {
    ok: true,
    before: targets.filter((t) => t.kind === "before").length,
    after: targets.filter((t) => t.kind === "after").length,
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
