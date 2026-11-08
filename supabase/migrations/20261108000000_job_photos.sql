-- Ticket 16: crew photos for the review queue.
-- Photos live in a PRIVATE bucket and rows are readable only with the service role key, used by
-- Next.js server routes. No policies are created on purpose: the anon and authenticated roles get nothing.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 3145728, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table public.job_photos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  run_id text not null,
  stop_id text not null,
  asset_id text not null,
  crew_id text not null,
  kind text not null check (kind in ('before', 'after')),
  path text not null unique,
  bytes integer not null check (bytes > 0 and bytes <= 3145728),
  -- Set on uploads from the public demo; a cleanup job deletes the file and row after this time.
  expires_at timestamptz,
  -- Filled in on /review (local only). A suggestion alone is never a label; only confirmed_level counts.
  suggested_level smallint check (suggested_level between 0 and 3),
  confirmed_level smallint check (confirmed_level between 0 and 3),
  confirmed_at timestamptz,
  -- The face and number-plate check is NOT built. Stays false, so no photo may enter training.
  privacy_checked boolean not null default false
);

create index job_photos_created_idx on public.job_photos (created_at desc);
create index job_photos_expiry_idx on public.job_photos (expires_at) where expires_at is not null;

alter table public.job_photos enable row level security;
