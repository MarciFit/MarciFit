-- MarciFit · Supabase MVP schema
-- Crea:
-- 1. profiles
-- 2. app_state
-- 3. barcode_catalog
-- 3. trigger aggiornamento updated_at
-- 4. policy RLS minime per utente autenticato

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  name text not null default '',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state_json jsonb not null default '{}'::jsonb,
  state_version integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.barcode_catalog (
  barcode text primary key,
  name text not null default '',
  brand text not null default '',
  quantity text not null default '',
  kcal100 integer not null default 0,
  p100 numeric(8,1) not null default 0,
  c100 numeric(8,1) not null default 0,
  f100 numeric(8,1) not null default 0,
  source text not null default 'user_manual',
  completeness_score integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_app_state_updated_at on public.app_state;
create trigger trg_app_state_updated_at
before update on public.app_state
for each row
execute function public.set_updated_at();

drop trigger if exists trg_barcode_catalog_updated_at on public.barcode_catalog;
create trigger trg_barcode_catalog_updated_at
before update on public.barcode_catalog
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.app_state enable row level security;
alter table public.barcode_catalog enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
on public.profiles
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "app_state_select_own" on public.app_state;
create policy "app_state_select_own"
on public.app_state
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "app_state_insert_own" on public.app_state;
create policy "app_state_insert_own"
on public.app_state
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "app_state_update_own" on public.app_state;
create policy "app_state_update_own"
on public.app_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "app_state_delete_own" on public.app_state;
create policy "app_state_delete_own"
on public.app_state
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "barcode_catalog_select_authenticated" on public.barcode_catalog;
create policy "barcode_catalog_select_authenticated"
on public.barcode_catalog
for select
to authenticated
using (true);

drop policy if exists "barcode_catalog_insert_authenticated" on public.barcode_catalog;
create policy "barcode_catalog_insert_authenticated"
on public.barcode_catalog
for insert
to authenticated
with check (created_by is null or created_by = auth.uid());

drop policy if exists "barcode_catalog_update_authenticated" on public.barcode_catalog;
create policy "barcode_catalog_update_authenticated"
on public.barcode_catalog
for update
to authenticated
using (true)
with check (created_by is null or created_by = auth.uid());

comment on table public.profiles is 'Profilo base utente MarciFit';
comment on table public.app_state is 'Snapshot JSON dello stato app per sync MVP';
comment on table public.barcode_catalog is 'Catalogo barcode condiviso tra utenti autenticati';
