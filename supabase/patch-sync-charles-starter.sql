-- One-off: charles_wang888@126.com paid Starter in Paddle Sandbox,
-- but webhooks failed (secret placeholder / localhost), so profile stayed Free.
-- Run in Supabase SQL Editor, then refresh /account.

update public.profiles
set
  plan = 'starter',
  paddle_customer_id = 'ctm_01m4t5zc3pk81yxmwxkyrdpfzx',
  updated_at = now()
where lower(email) = lower('charles_wang888@126.com');

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
  'sub_01m4t602d90zwr1yxpx26mf1n2',
  p.id,
  'ctm_01m4t5zc3pk81yxmwxkyrdpfzx',
  'active',
  'pri_01m4shn3dkma9qg3rxq9j4rdq4',
  'pro_01m4shdxq14qk6q0j0n7xyskcw',
  'starter',
  now()
from public.profiles p
where lower(p.email) = lower('charles_wang888@126.com')
on conflict (subscription_id) do update set
  user_id = excluded.user_id,
  paddle_customer_id = excluded.paddle_customer_id,
  status = excluded.status,
  price_id = excluded.price_id,
  product_id = excluded.product_id,
  plan = excluded.plan,
  updated_at = now();

select id, email, plan, paddle_customer_id
from public.profiles
where lower(email) = lower('charles_wang888@126.com');
