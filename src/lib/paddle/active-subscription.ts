import type { Subscription } from "@paddle/paddle-node-sdk";
import { subscriptionGrantsAccess } from "@/lib/billing/access";
import { getPaddleInstance } from "@/lib/paddle/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Prefer our mirrored subscription id (1 GET) over listing every sub. */
export async function findActiveSubscriptionForUser(input: {
  userId: string;
  customerId: string | null;
}): Promise<Subscription | null> {
  const paddle = getPaddleInstance();
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("subscriptions")
    .select("subscription_id")
    .eq("user_id", input.userId)
    .in("status", ["active", "trialing", "past_due"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (row?.subscription_id) {
    try {
      const sub = await paddle.subscriptions.get(row.subscription_id);
      if (subscriptionGrantsAccess(sub.status) && sub.items?.[0]?.price?.id) {
        return sub;
      }
    } catch {
      /* fall through to list */
    }
  }

  if (!input.customerId) return null;
  return findActiveSubscriptionForCustomer(input.customerId);
}

export async function findActiveSubscriptionForCustomer(
  customerId: string,
): Promise<Subscription | null> {
  const paddle = getPaddleInstance();
  const subs = paddle.subscriptions.list({
    customerId: [customerId],
    status: ["active", "trialing", "past_due"],
  });

  for await (const sub of subs) {
    if (!subscriptionGrantsAccess(sub.status)) continue;
    if (sub.items?.[0]?.price?.id) return sub;
  }
  return null;
}

export function subscriptionPeriodEnd(sub: Subscription): string | null {
  return sub.currentBillingPeriod?.endsAt ?? sub.nextBilledAt ?? null;
}
