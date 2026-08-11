-- Countryball Arena: run in Supabase SQL Editor if MCP migration fails
-- Project: trtoyhdwawgrfafrvygj

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  constraint profiles_username_len check (char_length(username) >= 3 and char_length(username) <= 24),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]+$')
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

create table if not exists public.player_saves (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  roster jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.player_saves enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "saves_select_own" on public.player_saves;
create policy "saves_select_own"
  on public.player_saves for select
  using (auth.uid() = user_id);

drop policy if exists "saves_insert_own" on public.player_saves;
create policy "saves_insert_own"
  on public.player_saves for insert
  with check (auth.uid() = user_id);

drop policy if exists "saves_update_own" on public.player_saves;
create policy "saves_update_own"
  on public.player_saves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
