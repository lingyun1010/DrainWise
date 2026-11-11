# 27: Deleting a before photo should handle the after photo of the same job

Type: task
Status: done
Blocked by: None
Spec: ticket 16 ("Known gap")

## What to build

On local `/review`, "Delete photo" removes one before photo; the after photo of the same job stays in Storage and the table. Decide and implement one clear rule: deleting a before photo offers to delete the paired after photo too (default both, `ConfirmDialog` with `tone="danger"` saying exactly what is removed and what stays), and never leaves an orphan.

## Acceptance criteria

- [x] `deletePhoto` (see `web/lib/photoStore.ts`, route `web/app/api/review/photos/delete/route.ts`) can remove the job's pair; orphan check in a test with a mocked store.
- [x] Dialog text names the job and says whether the after photo is removed; focus starts on Cancel.
- [x] Records and run history stay (only photos go).
- [x] No real Supabase deletes in tests.

## Done (2026-11-09)

Rule: a job is one run and stop; its photos are the `job_photos` rows with the same `run_id` and `stop_id` (kind before and after; the Storage path is stored in each row, so file and row always pair). Deleting a before photo also deletes the after photo(s) of that job by default; the dialog has a checkbox to keep the after photo as work evidence. Orphan = a file with no row or a row with no file; the order is look up, remove files, remove rows, and a failure stops the run so a retry finishes it. Logic in `planner/src/photoPairs.ts` (tests with an in-memory mock store); `deletePhoto(id, withAfter = true)` in `web/lib/photoStore.ts`; `/api/review/photos` now returns `afterCount`. Assumption: if the owner unticks the box, the after photo stays and is not shown in review (evidence only).
