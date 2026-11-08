# DrainWise MVP spec

Status: ready-for-agent
Source: Think decisions in tickets 01-08 and `map.md`; project brief in `CLAUDE.md`; schema design in `docs/schema.md`.

This spec is partly retrospective: the manager view, crew view, planner, risk API and 3D view already exist. Sections say what is built and what is still to do. Everything shown is **sample data**.

## Problem Statement

Council crews clean hundreds of stormwater drain inlets and gross pollutant traps (GPTs) that fill with leaves and block. Inspection is manual and only some sites have cameras, so crews clean by routine or after a complaint, not by risk. A manager cannot easily say "which drains should the truck clean today, within what the truck can carry", and a crew leaves no consistent proof that a job was done. Real-time flood warning already exists (FloodSmart/FLASH); the gap is operational action on blockage.

## Solution

DrainWise ranks drains and GPTs by how likely they are to block soon, with plain reasons for every score. A manager picks the truck's capacity and gets a run: numbered stops, never over capacity, riskiest and nearby first. The run goes to a crew phone. At each stop the crew either marks a camera site as cleaned, or takes a BEFORE photo, cleans, takes an AFTER photo and submits. A compliance panel lists every finished job. The before photos are designed to become training data later; the after photos are evidence of work. All numbers and records are sample data, and the product says so everywhere.

## User Stories

1. As a manager, I want a map of all drain inlets and GPTs with a clear severity mark, so that I see the network state at a glance.
2. As a manager, I want severity shown by face and label as well as colour, so that I can read it without relying on colour.
3. As a manager, I want GPTs visually distinct from inlets, so that I can tell their larger debris load apart.
4. As a manager, I want sites with a camera marked, so that I know which stops will not need photos.
5. As a manager, I want a "Check next" queue ranked by risk, so that I know what to look at first.
6. As a manager, I want each queue entry to show its reasons (for example heavy tree cover nearby, last cleaned N days ago), so that I can trust and explain the ranking.
7. As a manager, I want to open an asset and see its risk level, probability, reasons and cleaning history, so that I can decide with context.
8. As a manager, I want to set the truck capacity from 1 to 4 m3, so that the run fits the truck we really have.
9. As a manager, I want a planned run with numbered stops and a dashed route on the map, so that I can see where the truck goes.
10. As a manager, I want the plan to never exceed the capacity, so that the truck is never overloaded.
11. As a manager, I want the plan to take the riskiest assets first and prefer nearby ones, so that cleaning has the most effect per trip.
12. As a manager, I want very low-risk assets left out of the run even when capacity remains, so that the truck is not filled with pointless stops.
13. As a manager, I want each stop to show its estimated load and whether photos are needed, so that I can brief the crew.
14. As a manager, I want to send the run to a crew, so that they can start without a phone call.
15. As a manager, I want leaf fall and extra rain sliders, so that I can ask what-if questions (local build only).
16. As a manager, I want the ranking to recompute after a what-if change, so that I see the effect (local build only).
17. As a manager, I want a compliance panel listing each finished job with run, crew, time and which photos exist, so that I can show proof of work.
18. As a manager, I want the before photos marked as training candidates and the after photos as evidence, so that the two purposes stay clear.
19. As a manager, I want an activity log, so that I can follow what happened during a run.
20. As a manager, I want a 3D water view whose water level is clearly labelled an illustration, so that nobody mistakes it for a flood forecast.
21. As a manager, I want a visible SAMPLE DATA label on every screen, so that nobody mistakes demo numbers for council records.
22. As a manager, I want a clear banner when scores are precomputed because the risk service is offline, so that I never think stale scores are live.
23. As a crew member, I want to open the app on my phone and accept a run, so that I know I am responsible for it.
24. As a crew member, I want "Stop n of m", a load bar and the next stops, so that I know where I am in the run.
25. As a crew member, I want a camera site to need only "Mark as cleaned", so that I do not waste time on photos that are not needed.
26. As a crew member, I want a non-camera stop to ask for a BEFORE photo, then clearing, then an AFTER photo, so that the job leaves proof.
27. As a crew member, I want "Submit and mark cleaned" disabled until both photos exist, so that I cannot submit incomplete proof.
28. As a crew member, I want to be told which photo is missing, so that I know what to do next.
29. As a crew member, I want the phone camera to open directly from the photo button, so that taking a photo is one tap.
30. As a crew member, I want to move to the next stop after submitting and see "run complete" at the end, so that I know when to return to the depot.
31. As a manager, I want a "Reset sample session" button, so that I can start every demo from a clean state.
32. As a hackathon judge, I want a public link that works without any setup, so that I can try the product myself.
33. As a hackathon judge, I want the product to state that data is sample and the model is trained on simulated history, so that I can judge the claims fairly.
34. As a presenter, I want a role entry screen with Manager, Crew and side-by-side, so that I can show both sides on one screen.
35. As a presenter, I want the local build to keep working with no network, so that the live demo cannot fail on Wi-Fi.
36. As a presenter, I want a recorded fallback of the main path on the same sample data, so that I can switch if the live demo stalls.
37. As a data owner at the council, I want the risk API contract to stay the same when real records replace the simulated ones, so that nothing else has to change.
38. As a data owner, I want every record to carry where it came from (sample, council or crew), so that sample and real data are never mixed up.
39. As an engineer, I want an evaluation script that checks the training pipeline recovers the simulator's rules, so that training bugs are caught.
40. As an engineer, I want the monotonic rules (more canopy, leaf fall, rain, days since clean never lowers risk) checked automatically, so that the model stays explainable.
41. As a privacy-minded reviewer, I want photos kept in memory and never persisted, so that no faces or number plates are stored.
42. As a privacy-minded reviewer, I want a face and number-plate check required before any photo is used for training, so that training use is safe.
43. As a reviewer, I want a small page where a human confirms a blockage level (0-3) for each of the 7 sample images, so that any vision suggestion is reviewed before it is a label.
44. As a reviewer, I want the vision model called only from the server with its key in an environment variable, so that no key reaches the browser or the repo.
45. As a reviewer, I want the vision feature off on the public build, so that the public link has no key and no cost risk.

## Implementation Decisions

**Already built (keep, do not rebuild)**

- Planner: knapsack for the load plus nearest-neighbour ordering from the depot, with a minimum-risk cutoff, and a rule for when a crew may submit a stop. The app recomputes the plan live with the capacity slider.
- Risk service: gradient boosting with monotonic constraints, trained on simulated data, served by a small API that returns probability, level and reasons.
- Web app: role screen, manager page (map, queue, run planner, sliders, compliance panel, activity log, asset modal), crew phone page shared with the side-by-side view, 3D water view on procedural sample terrain, run and record handoff through browser storage.

**Decisions from Think**

- Story and demo: Action story; three-minute path queue, run, crew, records (ticket 05). Data honesty is said at the start and the end; no accuracy numbers.
- Data: council sample if given, otherwise 36 fictional assets in real Parramatta places; every feature simulated; SAMPLE DATA label always visible (ticket 02).
- Photos: in memory only; job record holds metadata and two booleans, no image; face and number-plate check is a gate before any training use and is not built; claim is "designed to become training data, nothing retrained" (ticket 04).
- Database: none in the MVP. The schema is a design document with a source column (sample, council, crew) on every table and a PostGIS point for location (ticket 06).
- Hosting: live demo runs locally; the web app is also deployed publicly. The public build reads a precomputed scores file baked into the build, with data source, generation time and model version shown; the what-if sliders do not recompute there. The local build calls the risk API live and falls back to the same file when the API is offline, with a banner and greyed sliders. One code path, two sources (ticket 07).
- Vision key lives only in a local gitignored env file and server-side deploy variables; the public build has none, so vision is off there (ticket 07).
- Risk evaluation: a pipeline recovery check on held-out simulated data (AUC, Brier, comparison with the demo formula, monotonic check), documented as not an accuracy claim and never shown in the UI or pitch. With real records: time-split evaluation, and a real result means beating both the demo formula and a days-since-clean-only rule on the most recent period (ticket 08).

**New modules to build**

- Score source resolver: a pure function that, given a live fetch and the precomputed file, returns the scores plus a status (live or precomputed) that the UI turns into the banner. Lives next to the planner so the existing test runner covers it.
- Precomputed scores export: a script that runs the default scenario through the risk service and writes the file, stamped with source, time and model version.
- Evaluation script for the model, with a short note in the model README.
- Photo review page and server-side vision call (local only), for the 7 sample images.
- Public deployment with SAMPLE DATA label and no secrets.

**Not changed**

- The risk API contract stays as in the project brief.
- The demo formula stays only as a baseline for comparison, never presented as an AI model.

## Testing Decisions

- A good test checks external behaviour through a seam (inputs and outputs), not implementation details. Fixed seeds keep results reproducible.
- Seams, all reusing existing runners and CI jobs:
  1. Planner seam (run planning and the submit rule), vitest, existing tests are the prior art.
  2. Risk API seam (the predict endpoint), pytest, existing predict tests are the prior art.
  3. New: the score source resolver, in the planner package under vitest. Cases: live works gives status live; live fails gives the file and status precomputed; both unavailable gives an explicit error state.
  4. New: the evaluation script, in the model tests under pytest: it returns the expected metrics with a fixed seed and flags a broken monotonic rule.
- The browser flow (accept run, photos or camera, submit, next stop, return to depot) and the public build stay as manual smoke tests with evidence in the PR, as the project workflow requires. No new web test framework in this spec.
- Test of the export script: the produced file has every asset, a valid level for each, and the stamp fields.

## Out of Scope

- Roads, sandbags, resident notices, SES, and real-time flood warning.
- A real database, authentication and multi-user roles (design only for now; Supabase Auth is a stretch item).
- Training or claiming accuracy on real data; photo storage; automatic retraining.
- Multi-truck planning, real road distances, crew travel animation, and more than one crew run.
- A real LiDAR terrain (planned later as a small downsampled heightmap, never raw LiDAR in the repo).
- Renaming the demo page from FloodReady (pending the owner's confirmation).

## Further Notes

- Open items for the council experts on 9 and 13 Nov: asset locations, GPT meaning (Gross Pollutant Trap is assumed, unconfirmed), cleaning history, truck and bin sizes, existing systems, and whether judges prefer depth or breadth. Answers may change tickets, not this structure.
- Deadline: final submission around 18-20 Nov 2026. Core path (queue, run, crew, records) comes first; the score fallback, evaluation script, photo review page and deployment follow in that order of value to the demo.
- Remaining deliverables outside code: README with the honesty statements, the pitch slides, and the 60-90 second recorded fallback (not committed).
