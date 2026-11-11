-- Ticket 29: admin review of crew photos. The admin marks the net by hand; no AI model is called.
-- Same access pattern as job_photos: RLS stays on, no policies, only the server (service role key) reads or writes.

alter table public.job_photos
  -- Fullness band in 10% steps and damage, as set or accepted by the admin.
  add column admin_band smallint check (admin_band between 0 and 100 and admin_band % 10 = 0),
  add column admin_damage text check (admin_damage in ('none', 'net_full', 'net_broken', 'net_fallen')),
  add column admin_note text check (char_length(admin_note) <= 300),
  -- Where each value came from before the admin touched it: mock, reference-diff or admin.
  add column band_source text check (band_source in ('mock', 'reference-diff', 'admin')),
  add column damage_source text check (damage_source in ('mock', 'reference-diff', 'admin')),
  -- Circles and arrows with captions, coordinates normalised 0..1 (see planner/src/annotations.ts).
  add column annotations jsonb not null default '[]'::jsonb check (jsonb_typeof(annotations) = 'array'),
  -- Null = nobody has reviewed this photo yet; drives the bell and the Records badge.
  add column reviewed_at timestamptz,
  -- Stays false until the face and number-plate gate (ticket 25) exists and passes.
  add column ready_for_training boolean not null default false;

create index job_photos_unreviewed_idx on public.job_photos (created_at desc) where reviewed_at is null;
