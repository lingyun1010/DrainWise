# Review gates (UI / UX smoke)

Agreed 2026-11-08. The three review agents in `.claude/agents/` follow this file. Change the rules here, not in the agents.

## Blocker rule

A finding is a **blocker** (do not merge) only if it is one of:

1. The main flow cannot be completed (see "Main flow" below).
2. A console error on `/` or `/crew` during the flow.
3. A hard rule from `CLAUDE.md` is broken:
   - Simulated data or numbers are not labelled "sample data" / "Simulation".
   - The demo formula or simulated results are presented as an AI model or observed council data.
   - A photo-site stop can be submitted without both BEFORE and AFTER photos.
   - Severity relies on colour alone (needs face and label too).
   - `prefers-reduced-motion` is ignored by an animation.
   - Photos are persisted anywhere other than memory.

Everything else is a **note**: record it, do not block the merge. Notes still go in the PR body under "Known issues".

## Gates and agents

| Gate   | Agent             | Covers                                                               |
| ------ | ----------------- | -------------------------------------------------------------------- |
| Smoke  | `smoke-tester`    | Main flow below                                                      |
| UI     | `ui-reviewer`     | Accessibility and function: focus, contrast, console, reduced motion |
| UX     | `ux-reviewer`     | Flow clarity, states, honest labelling                               |
| Design | `design-reviewer` | Visual layout: page length, hierarchy, spacing, consistency          |

Order: smoke first, then UI, UX and Design one after another (they share the built-in browser). The pre-PR hook reminds you to dispatch all of them for any change under `web/`. Design findings are notes unless the layout blocks the main flow.

## Main flow

1. Open `/`, pick Manager, open the Crews tab, click "Reset sample session".
2. Move the capacity slider (1 / 2 / 4 m3): the plan never exceeds capacity.
3. "Send a crew on this run".
4. Open `/crew` at 375x812: Accept task, no horizontal scroll.
5. Camera stop: only "Mark as cleaned".
6. Photo stop: BEFORE photo, AFTER photo, only then "Submit and mark cleaned".
7. Back on Manager: compliance records, crew status and activity log reflect the job.
8. Toggle 2D / 3D; the 3D view still says it is not a flood forecast.

## Scope and environment

- Run the full flow on every PR that touches `web/`, `planner/` or `risk-api/`. Docs-only PRs skip it.
- Viewports: 375x812 (crew) and desktop (manager). Chromium only (built-in browser).
- Always click "Reset sample session" before starting.
- Servers: `.venv/bin/uvicorn risk_api.main:app --port 8000` and `cd web && npm run dev -- -p 3000`. Reuse them if the ports are already listening.

## Evidence for the PR body

A section headed **Smoke** with: date, viewports, the flow steps with pass/fail, console errors (none or the text), screenshots or key text read back, blockers, notes.

## Known issues (not blockers)

- The simulated shift clock wraps every 72 real seconds (`web/lib/runStore.ts`), so activity log times can look out of order and risk counts can jump. Fix pending.
- Re-scoring after a slider change has no loading indicator.
