import { NextResponse } from "next/server";
import { planFromPriceId } from "@/constants/plans";
import { subscriptionGrantsAccess } from "@/lib/billing/access";
import { getPaddleInstance } from "@/lib/paddle/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRouteUser } from "@/lib/supabase/route-user";

/**
 * Dev helper: pull the signed-in user's active Paddle subscription into profiles.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { user } = await getRouteUser(request);
  if (!user?.email) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const email = user.email.trim().toLowerCase();
  const paddle = getPaddleInstance();
  const admin = createAdminClient();

  const customers = paddle.customers.list({ email: [email] });
  let customerId: string | null = null;
  for await (const customer of customers) {
    if (customer.email?.toLowerCase() === email) {
      customerId = customer.id;
      break;
    }
  }

  if (!customerId) {
    return NextResponse.json(
      { error: `No Paddle customer for ${email}` },
      { status: 404 },
    );
  }

  const subs = paddle.subscriptions.list({
    customerId: [customerId],
    status: ["active", "trialing", "past_due"],
  });

  let matched: {
    id: string;
    status: string;
    priceId: string;
    productId: string;
  } | null = null;

  for await (const sub of subs) {
    const item = sub.items?.[0];
    const priceId = item?.price?.id ?? "";
    if (!priceId) continue;
    matched = {
      id: sub.id,
      status: sub.status,
      priceId,
      productId: item?.price?.productId ?? item?.product?.id ?? "",
    };
    break;
  }

  if (!matched) {
    return NextResponse.json(
      { error: "No active subscription found in Paddle" },
      { status: 404 },
    );
  }

  const plan = subscriptionGrantsAccess(matched.status)
    ? planFromPriceId(matched.priceId)
    : "free";

  await admin.from("subscriptions").upsert({
    subscription_id: matched.id,
    user_id: user.id,
    paddle_customer_id: customerId,
    status: matched.status,
    price_id: matched.priceId,
    product_id: matched.productId,
    plan,
    updated_at: new Date().toISOString(),
  });

  const { error } = await admin
    .from("profiles")
    .update({
      plan,
      paddle_customer_id: customerId,
      monthly_runs_used: 0,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    plan,
    subscriptionId: matched.id,
    customerId,
    priceId: matched.priceId,
  });
}
