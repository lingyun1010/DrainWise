# 13: Photo review page (local only)

Type: task
Status: ready-for-agent
Blocked by: None (can start immediately)
Spec: `.scratch/drainwise/spec.md` (tickets 04 and 07)

Lowest priority: cut this first if time is short.

## What to build

A small local-only page where a reviewer goes through the 7 sample images. For each, the server asks a hosted vision model for a blockage level (0-3), a confidence and a short rationale. A human confirms or changes the level; only the confirmed value counts as a label. The key lives only in a local gitignored env file. The page does not exist on the public build.

## Acceptance criteria

- [ ] For each of the 7 images the page shows the suggestion (level, confidence, rationale) and lets the reviewer confirm or override it.
- [ ] The vision call happens on the server only; the key is read from the environment and never reaches client code or the repo.
- [ ] Images are not stored anywhere new and not committed; metadata only is kept.
- [ ] The page is absent when no key is configured (so the public build has no vision).
- [ ] The page says "prototype, human review required, no accuracy claim" and the face and number-plate check is noted as a required gate before any training use (not built).
- [ ] Smoke test with evidence in the PR.
