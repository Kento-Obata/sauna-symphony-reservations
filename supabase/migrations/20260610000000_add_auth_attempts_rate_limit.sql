-- Rate-limiting / brute-force protection for public reservation endpoints.
-- Records failed authorization attempts (reservation lookup, cancellation) so
-- that edge functions can lock out repeated guessing of reservation codes and
-- phone last-4 digits.

create table if not exists public.auth_attempts (
  id bigint generated always as identity primary key,
  action text not null,
  identifier text not null,
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_attempts_lookup
  on public.auth_attempts (action, identifier, created_at);

-- Edge functions reach this table via the direct postgres connection (POSTGRES_URL),
-- which bypasses RLS. Enable RLS with no policies so anon/authenticated PostgREST
-- callers are denied access entirely.
alter table public.auth_attempts enable row level security;

-- Housekeeping: drop attempt rows older than 24h to keep the table small.
-- (Safe to run from a scheduled job; included here as a helper function.)
create or replace function public.prune_auth_attempts()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.auth_attempts where created_at < now() - interval '24 hours';
$$;

revoke all on function public.prune_auth_attempts() from anon, authenticated;
