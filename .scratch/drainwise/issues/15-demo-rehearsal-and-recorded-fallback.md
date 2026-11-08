# 15: Demo rehearsal and recorded fallback

Type: task
Status: ready-for-human
Blocked by: 10, 12
Spec: `.scratch/drainwise/spec.md` (ticket 05)

Needs the owner: a real phone and a screen recording cannot be done by an agent.

## What to build

Prove the demo works end to end and keep a safety net. Run the whole crew flow once on a real phone (camera capture has not been tested on a real device), rehearse the three-minute path with a timer, and record a 60-90 second screen recording of the live steps on the same sample data.

## Acceptance criteria

- [ ] Crew flow on a real phone: accept the run, take a BEFORE and an AFTER photo with the phone camera, submit, move to the next stop, finish the run. Problems are written down as new tickets.
- [ ] Rehearsal of the three-minute path from ticket 05 finishes in time, starting from "Reset sample session".
- [ ] A 60-90 second screen recording of the manager queue, truck run, crew stops and compliance records exists on the owner's machine (not committed to git).
- [ ] The switch rule is clear: if live stalls for more than 10 seconds, play the recording.
- [ ] The public link was opened once on a different device, and it works.
