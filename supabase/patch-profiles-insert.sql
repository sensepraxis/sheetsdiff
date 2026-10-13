-- Run once if you already applied schema.sql before profiles_insert_own existed.
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);
