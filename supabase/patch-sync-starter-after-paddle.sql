-- One-shot: apply sandbox Starter after Paddle checkout when webhook
-- cannot reach localhost. Run in Supabase SQL Editor (sheetdiff-dev).

update public.profiles
set
  plan = 'starter',
  paddle_customer_id = 'ctm_01m4f817jexa5y88s2h5jbe87n',
  monthly_runs_used = 0
where lower(email) = 'weiweiw404@gmail.com';

insert into public.subscriptions (
  subscription_id,
  user_id,
  paddle_customer_id,
  status,
  price_id,
  product_id,
  plan,
  updated_at
)
select
  'sub_01m4stgmqsh2x04cygzxpjkqta',
  p.id,
  'ctm_01m4f817jexa5y88s2h5jbe87n',
  'active',
  'pri_01m4shn3dkma9qg3rxq9j4rdq4',
  '',
  'starter',
  now()
from public.profiles p
where lower(p.email) = 'weiweiw404@gmail.com'
on conflict (subscription_id) do update
set
  user_id = excluded.user_id,
  status = excluded.status,
  plan = excluded.plan,
  price_id = excluded.price_id,
  updated_at = now();
