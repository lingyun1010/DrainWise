# 23: Trigger email / report for the contractor

Type: task
Status: needs-info
Blocked by: 20 (storm rule needs the 1-day horizon); owner creates the Gmail app password herself
Spec: `.scratch/drainwise/map.md` ("Trigger email" decision)

## What to build

An email listing GPTs to empty (weekly, or after a storm), with images for camera sites. Admin area with **Preview** and **Send**. Sent over Gmail SMTP from the owner's account. Recipient typed at send time, editable, not stored.

## Decisions

- One shared pure rule `shouldSend` (weekly due, or storm: BoM forecast rain over a threshold). Automatic sending needs a scheduler and the earlier decision is "no cron in the demo": build the rule and the manual button, and say honestly in the pitch that automatic sending is for production.
- Fixed template; "Demo with sample data" in every mail. Planner output is worded as a suggestion for the contractor.
- Every send is written to the activity log with a masked address only (`a***@gmail.com`).
- Rate limits (per hour per client) and a kill-switch env var. Gmail daily limit not yet verified.
- Secrets in env vars only (`.env.local`, Vercel). Never in repo or chat.

## Open

- Gmail daily sending limit and whether it is fine for a public demo.
- Whether the admin area needs any protection beyond the kill switch.

## Acceptance criteria

- [ ] `shouldSend` in `planner/` with vitest tests (weekly due, storm threshold, nothing to send).
- [ ] Preview shows subject, body and recipient list before sending; Send uses `ConfirmDialog`.
- [ ] `/api/send-report` (server only): validates address, rate limit, kill switch returns 503 when off, no address stored.
- [ ] Activity log entry with masked address.
- [ ] Test send to the owner's own address; no key in client bundle.
- [ ] Smoke run on the PR (flow change).
