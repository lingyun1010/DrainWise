# 12: Public deploy

Type: task
Status: ready-for-human (code merged in PR #18; leftovers: private-window run with screenshots, /crew and full crew flow on the live URL)
Blocked by: 10
Spec: `.scratch/drainwise/spec.md` (ticket 07)

## What to build

A public Vercel link a judge can open with no setup. It reads the baked scores file, shows SAMPLE DATA, tells the visitor that the what-if sliders need the local build, and contains no key. Vision is off there. If the submission form turns out not to need a URL, this ticket can be dropped.

## Acceptance criteria

- [ ] The public URL loads the role screen and the manager page with ranked queue, truck run, crew phone and compliance records.
- [ ] SAMPLE DATA is visible on every screen; the scores show their source and generation time.
- [ ] The what-if sliders are disabled with a short "run locally to try what-if" note.
- [ ] No secret in the repo or in the client bundle; no vision key is set on the deployment.
- [ ] Smoke test in a private browser window with evidence (screenshots) in the PR.
