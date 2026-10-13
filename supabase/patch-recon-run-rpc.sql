-- Run once in Supabase SQL Editor.
-- Lets the browser start/complete recon runs without Next.js admin API
-- (Node → supabase.co often fails with ECONNRESET in some networks).

-- Allow security-definer RPCs (running as postgres) to update billing counters.
create or replace function public.protect_profile_billing_columns()
returns trigger
language plpgsql
as $$
begin
  -- Only lock fields for direct client role updates, not definer/service writes.
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

create or replace function public.start_recon_run(
  p_file_a_name text,
  p_file_b_name text,
  p_rows_a integer,
  p_rows_b integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mail text := coalesce(auth.jwt() ->> 'email', '');
  v_plan text;
  v_life int;
  v_month int;
  v_reset timestamptz;
  v_max_rows int;
  v_run_id uuid;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'message', 'Not signed in');
  end if;

  select plan, lifetime_runs_used, monthly_runs_used, monthly_runs_reset_at
    into v_plan, v_life, v_month, v_reset
  from public.profiles
  where id = uid;

  if not found then
    insert into public.profiles (id, email, onboarding_complete, plan)
    values (uid, mail, true, 'free')
    returning plan, lifetime_runs_used, monthly_runs_used, monthly_runs_reset_at
    into v_plan, v_life, v_month, v_reset;
  end if;

  -- monthly reset
  if v_reset is null or now() >= v_reset then
    v_month := 0;
    v_reset := date_trunc('month', now()) + interval '1 month';
  end if;

  v_max_rows := case
    when v_plan = 'pro' then 25000
    else 5000
  end;

  if coalesce(p_rows_a, 0) > v_max_rows or coalesce(p_rows_b, 0) > v_max_rows then
    return jsonb_build_object(
      'ok', false,
      'message', format('Plan allows up to %s rows per side.', v_max_rows)
    );
  end if;

  if v_plan = 'free' then
    if v_life >= 1 then
      return jsonb_build_object(
        'ok', false,
        'message', 'Free includes 1 lifetime run. Upgrade to Starter for monthly runs.'
      );
    end if;
  elsif v_plan = 'starter' then
    if v_month >= 5 then
      return jsonb_build_object(
        'ok', false,
        'message', 'Starter includes 5 runs this month. Upgrade or wait for reset.'
      );
    end if;
  elsif v_plan = 'pro' then
    if v_month >= 40 then
      return jsonb_build_object(
        'ok', false,
        'message', 'Pro includes 40 runs this month. Wait for reset.'
      );
    end if;
  end if;

  insert into public.recon_runs (user_id, file_a_name, file_b_name, rows_a, rows_b)
  values (uid, p_file_a_name, p_file_b_name, coalesce(p_rows_a, 0), coalesce(p_rows_b, 0))
  returning id into v_run_id;

  if v_plan = 'free' then
    update public.profiles
    set lifetime_runs_used = v_life + 1,
        monthly_runs_reset_at = v_reset,
        updated_at = now()
    where id = uid;
  else
    update public.profiles
    set monthly_runs_used = v_month + 1,
        monthly_runs_reset_at = v_reset,
        updated_at = now()
    where id = uid;
  end if;

  return jsonb_build_object('ok', true, 'runId', v_run_id);
end;
$$;

create or replace function public.complete_recon_run(
  p_run_id uuid,
  p_matched integer,
  p_only_a integer,
  p_only_b integer,
  p_needs_review integer,
  p_delta text,
  p_summary jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'message', 'Not signed in');
  end if;

  update public.recon_runs
  set matched_count = coalesce(p_matched, 0),
      only_a_count = coalesce(p_only_a, 0),
      only_b_count = coalesce(p_only_b, 0),
      needs_review_count = coalesce(p_needs_review, 0),
      delta_amount = p_delta,
      summary = coalesce(p_summary, '{}'::jsonb)
  where id = p_run_id
    and user_id = uid;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Run not found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.start_recon_run(text, text, integer, integer) from public;
revoke all on function public.complete_recon_run(uuid, integer, integer, integer, integer, text, jsonb) from public;
grant execute on function public.start_recon_run(text, text, integer, integer) to authenticated;
grant execute on function public.complete_recon_run(uuid, integer, integer, integer, integer, text, jsonb) to authenticated;
