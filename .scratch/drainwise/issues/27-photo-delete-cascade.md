# 27: Deleting a before photo should handle the after photo of the same job

Type: task
Status: ready-for-agent
Blocked by: None
Spec: ticket 16 ("Known gap")

## What to build

On local `/review`, "Delete photo" removes one before photo; the after photo of the same job stays in Storage and the table. Decide and implement one clear rule: deleting a before photo offers to delete the paired after photo too (default both, `ConfirmDialog` with `tone="danger"` saying exactly what is removed and what stays), and never leaves an orphan.

## Acceptance criteria

- [ ] `deletePhoto` (see `web/lib/photoStore.ts`, route `web/app/api/review/photos/delete/route.ts`) can remove the job's pair; orphan check in a test with a mocked store.
- [ ] Dialog text names the job and says whether the after photo is removed; focus starts on Cancel.
- [ ] Records and run history stay (only photos go).
- [ ] No real Supabase deletes in tests.
