# 29: Admin review of uploaded photos: manual annotation, correction, notification

Type: task
Status: in progress (branch feat/29-admin-review, code done and browser-checked 2026-11-11, not committed; needs smoke, PR, prefill from 22)
Blocked by: soft link to 22 (reading output shape); builds on 13 and 16 (`/review`, `job_photos`)
Spec: `.scratch/drainwise/map.md` ("AI OS scope update 2026-11-11"); `design/AI_OS_DESIGN.md` sections 2, 3, 7

## Decision (owner, 2026-11-11)

No AI model is called for photos, locally or on the public build: readings stay MOCK or come from the deterministic reference diff (ticket 22). Photos are large and the net is hard to see, so the **admin marks the problem by hand**. The admin can also delete a drawn mark and redo it.

## What to build

1. **Annotation editor** in the admin review view (reuse `/review` and the shared `Dialog`): draw a circle on the photo, place an arrow, add a short caption. Edit, move, delete and redraw. Touch and mouse. Zoom on the photo so the net can be seen.
2. **Correction form** per photo: fullness band (10% steps), damage (`none`, `net_full`, `net_broken`, `net_fallen`), note. Pre-filled from the mock or reference-diff reading; admin accepts or changes. Show who set each value: `mock`, `reference-diff`, `admin`.
3. **Storage**: save the admin's band, damage, note and annotation shapes (normalised 0..1 coordinates, so they scale) in Supabase (new migration, RLS on, server key only, same pattern as `job_photos`). Never store AI output as a label until the admin confirms.
4. **Training feedback (honest wording)**: confirmed items form an example library with a "ready for training" flag that stays off until the face and number-plate gate (ticket 25) passes. Say: reading is mock, nothing is trained on these yet, no accuracy claim.
5. **Notification** when a new photo arrives (camera or crew upload): a bell in the Manager header with an unread count and a short list ("New before photo, GPT-014, Crew B, 10:42"), each row opens the review item. A badge on the Records panel with the same count and a link. Not sent by email. Marking reviewed clears the count. Works through the shared team (polling like `rooms`).

## Acceptance criteria

- [ ] Draw, move, delete and redraw an annotation; saved shapes reload on the same photo.
- [ ] Admin can override band and damage; `source` of each value is shown.
- [ ] New upload raises the header bell count and the Records badge; opening an item and confirming clears it.
- [ ] No model call anywhere; copy says "Mock reading" or "Reference comparison", "Marked by admin", "No accuracy claim".
- [ ] Destructive actions (delete annotation set, delete photo) use `ConfirmDialog` with `tone="danger"`.
- [ ] UI follows the CLAUDE.md consistency list. Browser check at desktop and 375px; every dialog opened.
- [ ] Smoke test with evidence in the PR (flow change).
