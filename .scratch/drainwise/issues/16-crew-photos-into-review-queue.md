# 16: Crew photos into the review queue

Type: task
Status: ready-for-human
Blocked by: None for the build (done on branch `feat/16-crew-photo-storage`); council evidence rules (questions 6 and 8, 9 Nov) still decide retention
Spec: `.scratch/drainwise/spec.md` (tickets 04, 06 and 13)

Lower priority than the 9 and 13 Nov expert sessions and the README (14). Cut first if time is short.

## Why

Ticket 13 built the review step (model suggests a level 0-3, a person confirms) but only over 7 fixed local sample images. The real use is reviewing the BEFORE photos that crews submit. Today those photos live in memory only (ticket 04) and vanish on refresh, so nothing reaches the review page.

## What to build

1. When a crew submits a job at a site without a camera, store the BEFORE photo (and the AFTER photo as work evidence) with run id, stop id, asset id, crew id and timestamp.
2. `/review` lists stored BEFORE photos that have no confirmed level yet. Same flow as ticket 13: suggestion, then a person confirms or changes. Only the confirmed level is a label.
3. A face and number-plate check runs before a photo is allowed into any training set. Until it exists, no photo is exported for training and the page says so.

## Decisions needed from the owner (these change ticket 04)

- DECIDED (owner, 2026-11-08): store the photos; this reverses ticket 04's "memory only". The owner will run the OpenAI vision review later with their own key (server-only, in local `web/.env.local`). Public build may accept uploads (owner, 2026-11-08), with the safeguards in the acceptance criteria. Still open: retention rules from the council, which photos.
- Storage: ticket 04 said "photos in memory only; real upload waits for the council's evidence rules". Do we reverse that for the demo? (Decided above: yes.) Supabase project `DrainWise` (ref `agbaveozfhsxqywkjdiw`, Sydney, free plan: 1 GB Storage, 500 MB database) exists and is empty. Keys go only in local `web/.env.local` and Vercel env vars, never in chat or git.
- Public demo: the public Vercel build must not accept real uploads (anyone could upload photos, including faces). Likely: upload and `/review` are local-only, as in ticket 13; the public build keeps photos in memory.
- Retention and consent: how long are photos kept, who can see them? Ask the council experts; until answered, keep the stored set small and delete-able.
- Sample photos only, or real crew photos? The demo can seed the queue with the 7 sample images instead of storing anything new.

## Acceptance criteria

- [ ] A crew submit at a non-camera site stores the before and after photos with the metadata above; camera sites store none.
- [ ] `/review` shows unlabelled stored before photos; confirming a level saves `{photo, confirmed level, suggested level, time}`; the suggestion alone never counts.
- [ ] The vision call stays server-only; the key never reaches client code or the repo.
- [ ] No photo is exported for training; the page states that the face and number-plate gate is not built.
- [ ] DECIDED (owner): the public build MAY accept uploads. Because anyone can then upload, all of these are required: private bucket (no public URLs, no listing); uploads only through a server route that checks file type (JPEG/PNG) and size (for example 5 MB) and rate-limits per IP; the crew screen warns "no faces or number plates"; photos on the public build are stored as sample session data and auto-deleted after a short time (for example 24 hours); no vision call on public uploads.
- [ ] `/review` and every OpenAI call stay local-only (key in `web/.env.local`, never on Vercel). The public build has no `/review`.
- [ ] Storage rules: bucket is private, access only through the server; a way to delete a photo and its label.
- [ ] A real vision call is tested once with a real key, and the result is reported as a prototype with no accuracy claim.
- [ ] Smoke test with evidence in the PR, covering the crew flow (accept, photos, submit, next stop, return to depot).

## Not in scope

- Retraining the risk model from labelled photos.
- Building the face and number-plate detector (separate ticket; required before any training use).
- Real GPS or EXIF data.
