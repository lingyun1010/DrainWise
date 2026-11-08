# 04 Photo pipeline and privacy

Type: grilling
Status: resolved
Blocked by: 02

## Question

How far does the photo pipeline go in the MVP? Decide: real upload to Supabase Storage vs mocked thumbnails; metadata kept (timestamp, GPS, crew id, run id); the blocked-level 0-3 labelling queue; face / number-plate handling before any training use; and what we honestly claim to judges about "photos become training data" when no real model is retrained.

Context: CLAUDE.md section 8 already fixes photo classification as a server-side hosted vision model returning level 0-3 + confidence + rationale, human-confirmed before it becomes a label, with only 7 unlabelled sample images. This ticket decides the rest (storage, metadata, queue, privacy checks, claims).

## Decision (2026-11-08, grilled with owner)

- Storage: photos stay in memory only in the MVP; README says "photos are not persisted in this prototype". Real upload to Supabase Storage waits for the council's evidence rules (questions 6 and 8 on 9 Nov).
- Metadata: timestamp, crew id, run id, stop id, asset id, written to the Job record only. No real GPS yet (use the asset's coordinates); no EXIF device data kept.
- Labelling queue: minimal manager-side review page over the 7 sample images. The server-side vision model suggests level 0-3 + confidence + rationale; a human must confirm or change it before it counts as a label. Marked "prototype, human review". No accuracy is reported.
- Privacy: the crew app tells crews to avoid faces and number plates. A face / number-plate check is a mandatory gate before any photo enters training; it is not built in the MVP, and the README states that no photo enters training until it exists. Retention and consent rules wait for the experts.
- Claim to judges: "photos taken before cleaning are designed to become labelled training data; in this prototype nothing is retrained."
