-- Shared demo room: lets the manager screen on one device and the crew phone on another share one
-- sample session (runs, records, log). No sign-in. RLS is on with no policies, so only the server
-- routes (service role key) can read or write. SAMPLE DATA only; rooms expire after 24 hours of no writes.

create table public.rooms (
  code text primary key check (code ~ '^[A-HJKMNP-Z]{4}$'),
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index rooms_expiry_idx on public.rooms (expires_at);

alter table public.rooms enable row level security;
