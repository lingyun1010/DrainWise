# 10: Score fallback with banner

Type: task
Status: ready-for-agent
Blocked by: 09
Spec: `.scratch/drainwise/spec.md` (ticket 07)

## What to build

When the risk service is offline, the manager page keeps working. It shows the precomputed scores, a clear banner "Showing precomputed sample scores (risk-api offline)", and the what-if sliders are greyed out. When the risk service is up, behaviour is unchanged. One code path, two data sources.

The decision "which source do I use" is a pure function with its own unit tests, next to the planner so the existing test runner and CI job cover it.

## Acceptance criteria

- [ ] Resolver tests: live works gives the live scores and status live; live fails gives the precomputed scores and status precomputed; both unavailable gives an explicit error state.
- [ ] The manager page uses the resolver; stopping the risk service and reloading shows the banner, the ranked queue, and greyed sliders instead of an error screen.
- [ ] Starting the risk service again and reloading removes the banner and re-enables the sliders.
- [ ] Smoke test with evidence (screenshots of both states) in the PR.
- [ ] The banner is readable without relying on colour.
