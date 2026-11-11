# 26: 3D view parity with the 2D map

Type: task
Status: done (merged, PR #40)
Blocked by: None
Spec: `.scratch/drainwise/map.md` ("Known gaps after #12")

> Update 2026-11-11 (owner): 3D parity is cosmetic; do only if time is left.

## What to build

First check what the 3D view (`web/app/Map3D.tsx`) shows today, then close the gaps against the 2D map: crew colours (`HATS` from `web/lib/runStore.ts`, with the crew letter, never colour alone), the camera icon for camera GPTs, and planned run stops highlighted. Keep it SAMPLE terrain and say so; the water level stays an illustration.

## Acceptance criteria

- [x] Crew ring/badge colour and letter match the 2D map; camera GPTs show the same camera icon.
- [x] Hover or focus card uses `Tip` rules where applicable; reduced-motion respected.
- [x] No new accent colours; checked at desktop and 375px; console clean; 2D/3D toggle still works.
- [x] tsc, eslint, prettier pass.

## Done (2026-11-09)

Already in 3D before this ticket: crew sprites (hat colour + letter badge), risk faces, busy/done badges. Added in `Map3D.tsx` only (props already carried `hasCamera`, `crewColor`, `crewLetter`, `planN`): camera icon on camera GPTs (read from data), crew-coloured ring + letter badge on assigned stops, stop number badge and a larger sprite drawn above other GPTs for the proposed run, the same `.fr-tip` hover card as the 2D map (mouse only; the canvas has no per-GPT keyboard focus, so keyboard users still use the queue), and a taller canvas under 520px so the stat tiles do not cover the markers. No new colours; no animation added. Not done: dashed route line in 3D, per-GPT keyboard focus.
