# 31: Floating chatbot (Claude API) replacing the map cloud

Type: task
Status: in-review (code done on feat/31-chatbot, 2026-11-11)
Blocked by: owner creates `ANTHROPIC_API_KEY` and sets a spend limit in the Anthropic console; soft link to 29 and 30 (crew and review data)
Spec: `.scratch/drainwise/map.md` ("AI OS scope update 2026-11-11"); `design/AI_OS_DESIGN.md` section 4

## Decisions (owner, 2026-11-11)

- Provider: **Claude API**, real calls on both local and public builds (the only real AI call in the app; photos stay mock).
- The small cloud shape at the top-left of the map is decorative only. **Move it out of the map** and make it the app's floating chatbot button. Animations: blink, small up and down bob, and a hint bubble ("Ask me about rain, full GPTs or crews"). All off under `prefers-reduced-motion`.
- Not found in `web/app` by text search (2026-11-11): at the start of the ticket, find the element in the browser (2D, 3D and Full screen views); if absent, ask the owner for a screenshot.

## What to build

- Floating button on every Manager page (and Side-by-side), opens a chat panel (shared `Dialog` card style or a docked panel; mobile friendly at 375px).
- Server route `POST /api/chat`: Anthropic Messages API with tool use, key only in env vars, a small model (default `claude-haiku-5-5`, overridable by env). Tools read existing data: rain outlook (BoM route and forecast bars), risk scores and "which GPTs are fullest" (same scoring the page uses), crew progress (team state from `rooms`, needs the team code), the latest suggestion and review items once 29 and 30 exist.
- Answers must come from tool results; show which data was used and say "sample data" where it applies. If a tool has no data, say so. No claims beyond tools.
- Guards: per-hour rate limit per client, total daily cap, max input length, max tokens, kill-switch env var (`CHAT_DISABLED=1`) that shows a clear "chat is off" message. Key never in client code. Reply in the user's language.

## Acceptance criteria

- [ ] Questions work: "what is the rain outlook", "which GPTs are fullest", "how far along is each crew".
- [ ] No key, rate-limit, cap or kill switch states each show a plain message, no stack traces.
- [ ] Key absent from `.next/static` and the repo; `.env.sample` updated.
- [ ] Cloud animations respect reduced motion; chat panel is keyboard accessible (focus in, Esc closes).
- [ ] Browser check at desktop and 375px; hint bubble does not cover the map controls.
