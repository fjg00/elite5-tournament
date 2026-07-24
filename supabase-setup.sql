-- ===== Elite 5 Tournament — Supabase setup =====
-- Paste this whole file into: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to run more than once.

-- 1) Registrations ----------------------------------------------------------
create table if not exists public.registrations (
  id text primary key,
  created_at timestamptz not null default now(),
  team_name text not null,
  jersey_color text,
  captain_name text not null,
  captain_phone text not null,
  captain_email text not null,
  players jsonb not null
);

alter table public.registrations enable row level security;

drop policy if exists "anon can register" on public.registrations;
create policy "anon can register" on public.registrations
  for insert to anon, authenticated with check (true);

drop policy if exists "admin read" on public.registrations;
create policy "admin read" on public.registrations
  for select to authenticated using (true);

drop policy if exists "admin delete" on public.registrations;
create policy "admin delete" on public.registrations
  for delete to authenticated using (true);

-- one team per jersey color (first come, first served)
create unique index if not exists uniq_jersey
  on public.registrations (jersey_color) where jersey_color is not null;

-- 2) Settings (registration open/closed) ------------------------------------
create table if not exists public.settings (
  id int primary key,
  registration_open boolean not null default true
);
insert into public.settings (id, registration_open) values (1, true)
  on conflict (id) do nothing;

alter table public.settings enable row level security;

drop policy if exists "public read settings" on public.settings;
create policy "public read settings" on public.settings
  for select to anon, authenticated using (true);

drop policy if exists "admin update settings" on public.settings;
create policy "admin update settings" on public.settings
  for update to authenticated using (true);

-- 3) Results (winners) ------------------------------------------------------
create table if not exists public.results (
  id int primary key,
  champion text,
  runner_up text,
  top_scorer text
);
insert into public.results (id) values (1) on conflict (id) do nothing;

alter table public.results enable row level security;

drop policy if exists "public read results" on public.results;
create policy "public read results" on public.results
  for select to anon, authenticated using (true);

drop policy if exists "admin update results" on public.results;
create policy "admin update results" on public.results
  for update to authenticated using (true);

-- 4) Safe public helpers (visitors can see counts, never the data) ----------
create or replace function public.team_count()
returns integer language sql security definer set search_path = public as
$$ select count(*)::int from registrations $$;

create or replace function public.taken_colors()
returns text[] language sql security definer set search_path = public as
$$ select coalesce(array_agg(jersey_color), '{}') from registrations where jersey_color is not null $$;

grant execute on function public.team_count() to anon, authenticated;
grant execute on function public.taken_colors() to anon, authenticated;

-- 5) Server-side guardrails: cap at 8 teams + honor open/closed -------------
create or replace function public.enforce_limits()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  -- 8 main spots + 3 waitlist places = 11 total
  if (select count(*) from public.registrations) >= 11 then
    raise exception 'Registration full';
  end if;
  if coalesce((select registration_open from public.settings where id = 1), true) = false then
    raise exception 'Registration closed';
  end if;
  return new;
end
$$;

drop trigger if exists trg_limits on public.registrations;
create trigger trg_limits before insert on public.registrations
  for each row execute function public.enforce_limits();

-- 6) Private storage bucket for player photos -------------------------------
insert into storage.buckets (id, name, public)
  values ('player-photos', 'player-photos', false)
  on conflict (id) do nothing;

drop policy if exists "anon upload photos" on storage.objects;
create policy "anon upload photos" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'player-photos');

drop policy if exists "admin read photos" on storage.objects;
create policy "admin read photos" on storage.objects
  for select to authenticated using (bucket_id = 'player-photos');
