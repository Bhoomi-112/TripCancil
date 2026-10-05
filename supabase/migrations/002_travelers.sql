-- 002_travellers.sql — one person, many trips.
--
-- Until now a member row belonged to exactly one trip, so nothing tied the owner
-- of one trip to the owner of the next. This adds a `travelers` table and points
-- `members.traveler_id` at it, which is what lets the app show "your trips" and
-- reopen one of them on a device you have already proved yourself on.
--
-- Re-runnable on purpose: the Supabase SQL editor has no transaction rollback for
-- a half-pasted script, so every statement is guarded and this file can be pasted
-- more than without failing. 001 is single-run by design; this one is not.

create table if not exists public.travelers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.members
  add column if not exists traveler_id uuid references public.travelers(id) on delete set null;

-- Listing "my trips" is a scan over one traveller's member rows.
create index if not exists members_traveler_id_idx on public.members (traveler_id);

-- One membership per traveller per trip, so the same person cannot end up with two
-- rows (two display names) in a single trip. Nulls are excluded, so trips whose
-- members have never claimed an account are unaffected.
create unique index if not exists members_trip_traveler_key
  on public.members (trip_id, traveler_id)
  where traveler_id is not null;

alter table public.travelers enable row level security;

revoke create on schema public from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.travelers from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on table public.travelers from authenticated';
  end if;
end $$;

-- PostgREST caches its schema. Without this the new table and column can be
-- invisible to the service-role client for a few seconds after the script runs.
notify pgrst, 'reload schema';