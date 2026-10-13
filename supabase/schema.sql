-- SheetDiff schema for Supabase (Postgres)
-- Run in Supabase SQL Editor after creating a project.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  first_name text,
  last_name text,
  avatar_url text,
  onboarding_complete boolean not null default false,
  plan text not null default 'free'
    check (plan in ('free', 'starter', 'pro')),
  lifetime_runs_used integer not null default 0,
  monthly_runs_used integer not null default 0,
  monthly_runs_reset_at timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  paddle_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_paddle_customer_id_idx on public.profiles (paddle_customer_id);

-- ---------------------------------------------------------------------------
-- Subscriptions mirrored from Paddle webhooks
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  subscription_id text primary key,
  user_id uuid references public.profiles (id) on delete set null,
  paddle_customer_id text not null,
  status text not null,
  price_id text not null default '',
  product_id text not null default '',
  plan text not null default 'free'
    check (plan in ('free', 'starter', 'pro')),
  scheduled_change_action text,
  scheduled_change_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_paddle_customer_id_idx on public.subscriptions (paddle_customer_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);

-- ---------------------------------------------------------------------------
-- Recon runs (metadata only — spreadsheet rows stay in the browser)
-- ---------------------------------------------------------------------------
create table if not exists public.recon_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  file_a_name text,
  file_b_name text,
  rows_a integer not null default 0,
  rows_b integer not null default 0,
  matched_count integer not null default 0,
  only_a_count integer not null default 0,
  only_b_count integer not null default 0,
  needs_review_count integer not null default 0,
  delta_amount text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recon_runs_user_id_idx on public.recon_runs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Saved mapping rules (Starter: 1, Pro: unlimited)
-- ---------------------------------------------------------------------------
create table if not exists public.rule_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default 'Default mapping',
  mapping_a jsonb not null default '{}'::jsonb,
  mapping_b jsonb not null default '{}'::jsonb,
  options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rule_sets_user_id_idx on public.rule_sets (user_id);

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, first_name, last_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'given_name', split_part(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), ' ', 1), ''),
    coalesce(new.raw_user_meta_data->>'family_name', nullif(split_part(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), ' ', 2), ''), ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', null)
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists rule_sets_set_updated_at on public.rule_sets;
create trigger rule_sets_set_updated_at
  before update on public.rule_sets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.recon_runs enable row level security;
alter table public.rule_sets enable row level security;

-- Deny-by-default: only explicit policies grant access.

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Block clients from self-upgrading plan / forging usage counters.
create or replace function public.protect_profile_billing_columns()
returns trigger
language plpgsql
as $$
begin
  -- Lock only for direct client writes; security-definer RPCs run as postgres.
  if current_user in ('authenticated', 'anon') then
    new.plan := old.plan;
    new.lifetime_runs_used := old.lifetime_runs_used;
    new.monthly_runs_used := old.monthly_runs_used;
    new.monthly_runs_reset_at := old.monthly_runs_reset_at;
    new.paddle_customer_id := old.paddle_customer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_billing on public.profiles;
create trigger profiles_protect_billing
  before update on public.profiles
  for each row execute function public.protect_profile_billing_columns();

create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "recon_runs_select_own"
  on public.recon_runs for select
  using (auth.uid() = user_id);

create policy "recon_runs_insert_own"
  on public.recon_runs for insert
  with check (auth.uid() = user_id);

create policy "rule_sets_select_own"
  on public.rule_sets for select
  using (auth.uid() = user_id);

create policy "rule_sets_insert_own"
  on public.rule_sets for insert
  with check (auth.uid() = user_id);

create policy "rule_sets_update_own"
  on public.rule_sets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "rule_sets_delete_own"
  on public.rule_sets for delete
  using (auth.uid() = user_id);

-- Onboarding helper (browser can call without insert-policy gaps)
create or replace function public.complete_onboarding(
  p_first_name text,
  p_last_name text,
  p_full_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mail text := coalesce(auth.jwt() ->> 'email', '');
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (
    id, email, first_name, last_name, full_name, onboarding_complete
  )
  values (
    uid, mail, p_first_name, p_last_name, p_full_name, true
  )
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    full_name = excluded.full_name,
    onboarding_complete = true,
    updated_at = now();
end;
$$;

revoke all on function public.complete_onboarding(text, text, text) from public;
grant execute on function public.complete_onboarding(text, text, text) to authenticated;
