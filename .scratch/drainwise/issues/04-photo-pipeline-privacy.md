# 04 Photo pipeline and privacy

Type: grilling
Status: open
Blocked by: 02

## Question

How far does the photo pipeline go in the MVP? Decide: real upload to Supabase Storage vs mocked thumbnails; metadata kept (timestamp, GPS, crew id, run id); the blocked-level 0-3 labelling queue; face / number-plate handling before any training use; and what we honestly claim to judges about "photos become training data" when no real model is retrained.

Context: CLAUDE.md section 8 already fixes photo classification as a server-side hosted vision model returning level 0-3 + confidence + rationale, human-confirmed before it becomes a label, with only 7 unlabelled sample images. This ticket decides the rest (storage, metadata, queue, privacy checks, claims).
