# 26: 3D view parity with the 2D map

Type: task
Status: ready-for-agent
Blocked by: None
Spec: `.scratch/drainwise/map.md` ("Known gaps after #12")

## What to build

First check what the 3D view (`web/app/Map3D.tsx`) shows today, then close the gaps against the 2D map: crew colours (`HATS` from `web/lib/runStore.ts`, with the crew letter, never colour alone), the camera icon for camera GPTs, and planned run stops highlighted. Keep it SAMPLE terrain and say so; the water level stays an illustration.

## Acceptance criteria

- [ ] Crew ring/badge colour and letter match the 2D map; camera GPTs show the same camera icon.
- [ ] Hover or focus card uses `Tip` rules where applicable; reduced-motion respected.
- [ ] No new accent colours; checked at desktop and 375px; console clean; 2D/3D toggle still works.
- [ ] tsc, eslint, prettier pass.
