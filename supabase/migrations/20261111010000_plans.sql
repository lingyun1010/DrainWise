-- Ticket 30: run suggestions and the final plan the admin confirmed, with a reason for each change.
-- Evidence for later learning (ticket 32). SAMPLE DATA only. Same access pattern as rooms and job_photos:
-- RLS stays on, no policies, only the server (service role key) reads or writes.

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  team text check (team ~ '^[A-HJKMNP-Z]{4}$'),
  source text not null check (source in ('manual', 'email link')),
  status text not null check (status in ('pending', 'confirmed')),
  proposed jsonb not null check (jsonb_typeof(proposed) = 'array'),
  final jsonb not null check (jsonb_typeof(final) = 'array'),
  edits jsonb not null default '[]'::jsonb check (jsonb_typeof(edits) = 'array'),
  context jsonb not null check (jsonb_typeof(context) = 'object'),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index plans_team_idx on public.plans (team, created_at desc);

alter table public.plans enable row level security;
