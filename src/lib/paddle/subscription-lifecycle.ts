import type { Subscription } from "@paddle/paddle-node-sdk";
import { planFromPriceId, type PlanId } from "@/constants/plans";
import { subscriptionGrantsAccess } from "@/lib/billing/access";
import { findActiveSubscriptionForUser } from "@/lib/paddle/active-subscription";
import { getPaddleInstance } from "@/lib/paddle/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type BillingSnapshot = {
  plan: PlanId;
  status: string | null;
  subscriptionId: string | null;
  priceId: string | null;
  /** Current period end (when a new cancel would take effect) */
  periodEndsAt: string | null;
  /** ISO date when access ends if cancel is scheduled */
  cancelAt: string | null;
  scheduledAction: "cancel" | "downgrade" | "pause" | null;
  canCancel: boolean;
  canKeep: boolean;
};

function scheduledActionOf(
  action: string | null | undefined,
): BillingSnapshot["scheduledAction"] {
  if (action === "cancel" || action === "downgrade" || action === "pause") {
    return action;
  }
  return null;
}

export async function getBillingSnapshot(input: {
  userId: string;
  profilePlan: PlanId;
  paddleCustomerId: string | null;
}): Promise<BillingSnapshot> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("subscriptions")
    .select(
      "subscription_id, status, price_id, plan, scheduled_change_action, scheduled_change_at",
    )
    .eq("user_id", input.userId)
    .in("status", ["active", "trialing", "past_due", "paused"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let sub: Subscription | null = null;
  try {
    sub = await findActiveSubscriptionForUser({
      userId: input.userId,
      customerId: input.paddleCustomerId,
    });
  } catch {
    sub = null;
  }

  const paddleAction = scheduledActionOf(sub?.scheduledChange?.action);
  const dbAction = scheduledActionOf(row?.scheduled_change_action);
  const scheduledAction = paddleAction ?? dbAction;
  const cancelAt =
    (paddleAction === "cancel"
      ? sub?.scheduledChange?.effectiveAt
      : null) ??
    (dbAction === "cancel" ? row?.scheduled_change_at : null) ??
    null;

  const periodEndsAt =
    sub?.currentBillingPeriod?.endsAt ??
    sub?.nextBilledAt ??
    row?.scheduled_change_at ??
    null;

  const status = sub?.status ?? row?.status ?? null;
  const subscriptionId = sub?.id ?? row?.subscription_id ?? null;
  const priceId = sub?.items?.[0]?.price?.id ?? row?.price_id ?? null;
  const paddlePlan =
    status && subscriptionGrantsAccess(status) && priceId
      ? planFromPriceId(priceId)
      : "free";

  const plan =
    scheduledAction === "cancel" && input.profilePlan !== "free"
      ? input.profilePlan
      : paddlePlan !== "free"
        ? paddlePlan
        : input.profilePlan;

  const activePaid =
    Boolean(subscriptionId) &&
    Boolean(status) &&
    subscriptionGrantsAccess(status) &&
    plan !== "free";

  return {
    plan,
    status,
    subscriptionId,
    priceId,
    periodEndsAt,
    cancelAt,
    scheduledAction,
    canCancel: activePaid && scheduledAction !== "cancel",
    canKeep: activePaid && scheduledAction === "cancel",
  };
}

/** Mainstream: cancel at end of billing period; keep access until then. */
export async function scheduleCancelAtPeriodEnd(input: {
  userId: string;
  paddleCustomerId: string | null;
}): Promise<{ cancelAt: string | null; subscriptionId: string }> {
  const paddle = getPaddleInstance();
  const sub = await findActiveSubscriptionForUser({
    userId: input.userId,
    customerId: input.paddleCustomerId,
  });
  if (!sub) {
    throw new Error("No active subscription to cancel.");
  }

  const updated = await paddle.subscriptions.cancel(sub.id, {
    effectiveFrom: "next_billing_period",
  });

  const cancelAt =
    updated.scheduledChange?.effectiveAt ??
    updated.currentBillingPeriod?.endsAt ??
    updated.nextBilledAt ??
    null;

  const admin = createAdminClient();
  await admin.from("subscriptions").upsert({
    subscription_id: updated.id,
    user_id: input.userId,
    paddle_customer_id: updated.customerId,
    status: updated.status,
    price_id: updated.items?.[0]?.price?.id ?? "",
    product_id:
      updated.items?.[0]?.price?.productId ??
      updated.items?.[0]?.product?.id ??
      "",
    plan: planFromPriceId(updated.items?.[0]?.price?.id ?? ""),
    scheduled_change_action: updated.scheduledChange?.action ?? "cancel",
    scheduled_change_at: cancelAt,
    updated_at: new Date().toISOString(),
  });

  return { cancelAt, subscriptionId: updated.id };
}

/** Undo a scheduled period-end cancel (Keep my plan). */
export async function clearScheduledCancel(input: {
  userId: string;
  paddleCustomerId: string | null;
}): Promise<{ subscriptionId: string }> {
  const paddle = getPaddleInstance();
  const sub = await findActiveSubscriptionForUser({
    userId: input.userId,
    customerId: input.paddleCustomerId,
  });
  if (!sub) {
    throw new Error("No active subscription found.");
  }
  if (sub.scheduledChange?.action !== "cancel") {
    throw new Error("No scheduled cancellation to remove.");
  }

  const updated = await paddle.subscriptions.update(sub.id, {
    scheduledChange: null,
  });

  const admin = createAdminClient();
  await admin
    .from("subscriptions")
    .update({
      scheduled_change_action: null,
      scheduled_change_at: null,
      status: updated.status,
      updated_at: new Date().toISOString(),
    })
    .eq("subscription_id", updated.id);

  return { subscriptionId: updated.id };
}
