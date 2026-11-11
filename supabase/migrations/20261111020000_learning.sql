-- Ticket 32: memory for the AI OS. SIMULATION data only (a made-up scheduler persona), never real council behaviour.
-- What "learns" is the rules table. The Claude model's weights never change.
-- Same access pattern as plans: RLS on, no policies, only the server (service role key) reads or writes.

create table public.sim_weeks (
  week int primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  statement text not null check (char_length(statement) between 1 and 200),
  kind text not null check (kind in ('creek_first', 'drop_far_after_rain')),
  edit_ids jsonb not null check (jsonb_typeof(edit_ids) = 'array'),
  count int not null check (count >= 3),
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.preferences (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  kind text not null check (kind in ('creek_first', 'drop_far_after_rain')),
  text text not null check (char_length(text) between 1 and 200),
  enabled boolean not null default true,
  version int not null default 1,
  approved_at_week int, -- simulated weeks before this are "without the rule"
  created_at timestamptz not null default now()
);

alter table public.sim_weeks enable row level security;
alter table public.lessons enable row level security;
alter table public.preferences enable row level security;
