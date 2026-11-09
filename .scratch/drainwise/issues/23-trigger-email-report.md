# 23: Risk trigger email / report for the contractor

Type: task
Status: done (built 2026-11-09; PR stacked on #37). Open: Gmail daily limit, owner creates the app password, council storm level
Blocked by: None (uses the existing Forecast day scoring in `planner/src/horizon.ts`: 1-day = Tomorrow, 7-day = any day from Today to In 6 days over the threshold); owner creates the Gmail app password herself
Spec: `.scratch/drainwise/map.md` ("Trigger email" decision)

## What to build

A risk trigger that decides **when** to send and **what** to put in the email, then sends it over Gmail SMTP from the owner's account. The email is a report of the GPTs the model predicts will reach the 70% full band, with images for camera sites (ticket 22 when ready). Admin area with **Preview** and **Send** for the demo. Recipient typed at send time, editable, not stored.

## The rule (owner, 2026-11-09)

The check runs once a day, using the BoM rain forecast for the next day.

- **Storm in the forecast** (heavy rain expected tomorrow): send a **1-day** report the day before. It lists the GPTs predicted to reach 70% within 1 day.
- **No storm in the forecast**: do not send daily. Send **one report per week** with the **7-day** prediction. It lists the GPTs predicted to reach 70% within 7 days.
- If nothing is predicted to reach 70%, say so in a short report (weekly) or send nothing (storm check), see Open.

## Decisions

- One shared pure function `decideReport(today, forecast, lastSent)` returns `none`, `storm_1day` or `weekly_7day`, with the reason in words. The cron job, the Preview and the tests all use it.
- Storm threshold is an **assumption** (a constant, labelled in the UI and mail), based on the BoM precis rain range and chance (`planner/src/bomPrecis.ts`). Council has not told us their trigger level (ask on 13 Nov).
- At most one storm report per 24 hours (a long storm does not send every day). Weekly report goes on a fixed weekday; if a storm report went out the same day, the weekly one is skipped that day.
- The threshold is High (60%+) from the existing model; the "70% full" wording is not claimed until the label is redefined (ticket 20, dropped). Say "predicted" and "sample data", never "will".
- Automatic sending needs a scheduler and the earlier decision is "no cron in the demo": build `decideReport` and the manual Preview and Send, and state honestly in the pitch that automatic sending is for production. If a scheduler is added later it only calls the same function once a day.
- Fixed template; "Demo with sample data" in every mail. The planner part is worded as a suggestion for the contractor.
- Every send is written to the activity log with a masked address only (`a***@gmail.com`).
- Rate limits (per hour per client) and a kill-switch env var. Secrets in env vars only (`.env.local`, Vercel), never in repo or chat.

## Open

- Gmail daily sending limit, and whether it is fine for a public demo.
- Storm threshold (mm and chance): need council's level, otherwise keep the labelled assumption.
- Empty storm report: send "nothing predicted" or stay silent? Recommended: silent for storm, short note for weekly.
- Weekday for the weekly report (recommended Monday, before the crews plan the week).

## Acceptance criteria

- [x] `decideReport` in `planner/` with vitest tests: storm gives `storm_1day`; no storm and week due gives `weekly_7day`; no storm and not due gives `none`; second storm report within 24 h gives `none`; storm and weekly on the same day gives the storm report only.
- [x] Report builder lists GPTs by predicted risk for the chosen horizon, with the reason lines, and the horizon and threshold stated.
- [x] Preview shows which rule fired and why, plus subject, body and recipient before sending; Send uses `ConfirmDialog`. The demo can force "storm" or "no storm" to show both paths.
- [x] `/api/send-report` (server only): validates address, rate limit, kill switch returns 503 when off, no address stored.
- [x] Activity log entry with masked address and which rule fired.
- [ ] Test send to the owner's own address; no key in the client bundle.
- [ ] Smoke run on the PR (flow change): see PR body.

## Built (2026-11-09)

- `planner/src/reportRule.ts` (`decideReport`, storm constants), `reportBuilder.ts`, `sendReport.ts` (address check, mask, limiter, kill switch, transport seam) with vitest tests.
- `web/app/report/` admin page, `web/app/api/report-preview`, `web/app/api/send-report`, `web/lib/reportJob.ts` (server rebuilds the report; the client cannot choose the text), `web/lib/bomForecast.ts` (shared BoM fetch).
- Decisions where the ticket was open: empty storm report sends nothing, empty weekly sends a short note; weekly on Monday, not twice in 6 days; "calm" demo override pretends it is Monday; forced demo runs ignore the send history. A real send to the owner's own address is still to do once she has the app password (checkbox left open).
- Review finding left open: send history and rate limits are in memory per server instance (serverless resets them). Persist `LastSent` in a Supabase table before relying on the 24 h and weekly rules in production.
