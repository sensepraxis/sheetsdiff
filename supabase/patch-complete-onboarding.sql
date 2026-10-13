-- Run this once in Supabase SQL Editor (sheetdiff-dev).
-- Fixes: new row violates row-level security policy for table "profiles"

-- 1) Allow users to insert their own profile (if missing)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_insert_own'
  ) then
    create policy "profiles_insert_own"
      on public.profiles for insert
      with check (auth.uid() = id);
  end if;
end $$;

-- 2) Security-definer helper: works even when trigger didn't create the row
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
