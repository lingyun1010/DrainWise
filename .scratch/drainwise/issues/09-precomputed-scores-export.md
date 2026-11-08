# 09: Precomputed scores export

Type: task
Status: ready-for-agent
Blocked by: None (can start immediately)
Spec: `.scratch/drainwise/spec.md` (hosting decision, ticket 07)

## What to build

A command that runs the default scenario for all sample assets through the risk service and writes one scores file. The file says where the scores came from: data source (simulated, SAMPLE DATA), generation time and model version. Both the public build and the offline fallback of the local build read this file.

## Acceptance criteria

- [ ] One command regenerates the file from the current model and the sample assets; fixed seed, so two runs give the same scores.
- [ ] Every sample asset has a probability, a level (low, medium, high) and its reasons.
- [ ] The file carries the data source, generation time and model version.
- [ ] A pytest checks the three points above through the command's output, not its internals.
- [ ] The file is small and safe to commit (no photos, no secrets).
