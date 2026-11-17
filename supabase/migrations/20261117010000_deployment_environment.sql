-- Which environment this database is: set once by an operator, read by operator scripts.
--
-- Used so scripts that must never touch production (the staging demo data in supabase/demo/) can refuse
-- to run anywhere else. Nothing in the app reads it, and app users cannot read or change it.
--
-- Set once per environment in its SQL editor, e.g. on staging:
--   insert into public.deployment_environment (name) values ('staging');

create table public.deployment_environment (
  -- Exactly one row.
  singleton boolean primary key default true check (singleton),
  name text not null check (name in ('local', 'staging', 'production')),
  set_at timestamptz not null default now()
);

comment on table public.deployment_environment is
  'Which environment this database is (one row). Set by operators; not visible to app users.';

alter table public.deployment_environment enable row level security;
-- No policies: app users (anon, authenticated) have no access at all.
revoke all on public.deployment_environment from public, anon, authenticated;
