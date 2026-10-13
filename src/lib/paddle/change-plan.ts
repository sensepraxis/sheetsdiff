import type { Subscription } from "@paddle/paddle-node-sdk";
import { planFromPriceId, type PlanId } from "@/constants/plans";
import { isDowngrade, isUpgrade } from "@/lib/billing/plan-rank";
import { subscriptionGrantsAccess } from "@/lib/billing/access";
import {
  findActiveSubscriptionForCustomer,
  findActiveSubscriptionForUser,
  subscriptionPeriodEnd,
} from "@/lib/paddle/active-subscription";
import { getPaddleInstance } from "@/lib/paddle/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ChangePlanResult =
  | { action: "checkout" }
  | { action: "noop"; plan: PlanId; message: string }
  | {
      action: "upgraded";
      plan: PlanId;
      subscriptionId: string;
      message: string;
    }
  | {
      action: "scheduled_downgrade";
      plan: PlanId;
      effectiveAt: string;
      subscriptionId: string;
      message: string;
    }
  | {
      action: "switched";
      plan: PlanId;
      subscriptionId: string;
      message: string;
    };

function clearedDeferCustomData(existing: Subscription) {
  const base =
    typeof existing.customData === "object" && existing.customData
      ? { ...existing.customData }
      : {};
  return {
    ...base,
    sheetdiff_defer_access_plan: null,
    sheetdiff_defer_until: null,
  };
}

async function mirrorSubscription(
  userId: string,
  customerId: string,
  sub: Subscription,
  accessPlan: PlanId,
  scheduled?: { action: string; at: string } | null,
) {
  const admin = createAdminClient();
  const item = sub.items?.[0];
  const priceId = item?.price?.id ?? "";
  const productId = item?.price?.productId ?? item?.product?.id ?? "";
  const mirrorPlan = subscriptionGrantsAccess(sub.status)
    ? planFromPriceId(priceId)
    : "free";

  await Promise.all([
    admin.from("subscriptions").upsert({
      subscription_id: sub.id,
      user_id: userId,
      paddle_customer_id: customerId,
      status: sub.status,
      price_id: priceId,
      product_id: productId,
      plan: mirrorPlan,
      scheduled_change_action: scheduled?.action ?? null,
      scheduled_change_at: scheduled?.at ?? null,
      updated_at: new Date().toISOString(),
    }),
    admin
      .from("profiles")
      .update({
        plan: accessPlan,
        paddle_customer_id: customerId,
      })
      .eq("id", userId),
  ]);
}

/**
 * Mainstream SaaS plan change:
 * - No active sub → client should open Checkout
 * - Upgrade → same subscription, prorated_immediately
 * - Downgrade → change price with do_not_bill; keep current access until period end
 * - Same tier, different billing interval → prorated_immediately
 */
export async function changePlanForUser(input: {
  userId: string;
  email: string;
  priceId: string;
  currentPlan: PlanId;
  paddleCustomerId: string | null;
}): Promise<ChangePlanResult> {
  const targetPlan = planFromPriceId(input.priceId);
  if (targetPlan === "free") {
    return {
      action: "noop",
      plan: input.currentPlan,
      message: "Pick Starter or Pro to subscribe.",
    };
  }

  let customerId = input.paddleCustomerId;
  const paddle = getPaddleInstance();

  let existing = await findActiveSubscriptionForUser({
    userId: input.userId,
    customerId,
  });

  if (!existing && !customerId) {
    const customers = paddle.customers.list({
      email: [input.email.trim().toLowerCase()],
    });
    for await (const customer of customers) {
      if (customer.email?.toLowerCase() === input.email.trim().toLowerCase()) {
        customerId = customer.id;
        break;
      }
    }
    if (customerId) {
      existing = await findActiveSubscriptionForCustomer(customerId);
    }
  }

  if (!existing) return { action: "checkout" };

  customerId = existing.customerId || customerId;
  if (!customerId) return { action: "checkout" };

  const currentPriceId = existing.items?.[0]?.price?.id ?? "";
  const currentSubPlan = planFromPriceId(currentPriceId);

  if (currentPriceId === input.priceId) {
    await mirrorSubscription(
      input.userId,
      customerId,
      existing,
      currentSubPlan,
      null,
    );
    return {
      action: "noop",
      plan: currentSubPlan,
      message: `You're already on ${currentSubPlan}.`,
    };
  }

  // Single Paddle round-trip: clear scheduled cancel/pause + change price.
  const clearSchedule = existing.scheduledChange
    ? { scheduledChange: null as null }
    : {};

  if (isUpgrade(currentSubPlan, targetPlan)) {
    const updated = await paddle.subscriptions.update(existing.id, {
      items: [{ priceId: input.priceId, quantity: 1 }],
      prorationBillingMode: "prorated_immediately",
      onPaymentFailure: "prevent_change",
      customData: clearedDeferCustomData(existing),
      ...clearSchedule,
    });
    await mirrorSubscription(input.userId, customerId, updated, targetPlan, null);
    return {
      action: "upgraded",
      plan: targetPlan,
      subscriptionId: updated.id,
      message: `Upgraded to ${targetPlan}. You're charged the prorated difference for the rest of this billing period.`,
    };
  }

  if (isDowngrade(currentSubPlan, targetPlan)) {
    const periodEnd = subscriptionPeriodEnd(existing);
    if (!periodEnd) {
      const updated = await paddle.subscriptions.update(existing.id, {
        items: [{ priceId: input.priceId, quantity: 1 }],
        prorationBillingMode: "prorated_immediately",
        onPaymentFailure: "prevent_change",
        ...clearSchedule,
      });
      await mirrorSubscription(
        input.userId,
        customerId,
        updated,
        targetPlan,
        null,
      );
      return {
        action: "switched",
        plan: targetPlan,
        subscriptionId: updated.id,
        message: `Switched to ${targetPlan}.`,
      };
    }

    const updated = await paddle.subscriptions.update(existing.id, {
      items: [{ priceId: input.priceId, quantity: 1 }],
      prorationBillingMode: "do_not_bill",
      onPaymentFailure: "prevent_change",
      customData: {
        ...(typeof existing.customData === "object" && existing.customData
          ? existing.customData
          : {}),
        sheetdiff_defer_access_plan: currentSubPlan,
        sheetdiff_defer_until: periodEnd,
      },
      ...clearSchedule,
    });

    await mirrorSubscription(input.userId, customerId, updated, currentSubPlan, {
      action: "downgrade",
      at: periodEnd,
    });

    const when = new Date(periodEnd).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    return {
      action: "scheduled_downgrade",
      plan: currentSubPlan,
      effectiveAt: periodEnd,
      subscriptionId: updated.id,
      message: `Downgrade to ${targetPlan} is scheduled for ${when}. You keep ${currentSubPlan} until then; the next invoice bills ${targetPlan}.`,
    };
  }

  const updated = await paddle.subscriptions.update(existing.id, {
    items: [{ priceId: input.priceId, quantity: 1 }],
    prorationBillingMode: "prorated_immediately",
    onPaymentFailure: "prevent_change",
    customData: clearedDeferCustomData(existing),
    ...clearSchedule,
  });
  await mirrorSubscription(input.userId, customerId, updated, targetPlan, null);
  return {
    action: "switched",
    plan: targetPlan,
    subscriptionId: updated.id,
    message: `Billing updated to ${targetPlan}. Prorated for the rest of this period.`,
  };
}

/** Apply deferred downgrade access once the period has ended. */
export async function applyDuePlanAccess(userId: string): Promise<PlanId | null> {
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select(
      "subscription_id, plan, price_id, scheduled_change_action, scheduled_change_at, status",
    )
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) return null;
  if (sub.scheduled_change_action !== "downgrade" || !sub.scheduled_change_at) {
    return null;
  }
  if (new Date(sub.scheduled_change_at).getTime() > Date.now()) {
    return null;
  }

  const accessPlan = subscriptionGrantsAccess(sub.status)
    ? planFromPriceId(sub.price_id ?? "")
    : "free";

  await Promise.all([
    admin
      .from("subscriptions")
      .update({
        scheduled_change_action: null,
        scheduled_change_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("subscription_id", sub.subscription_id),
    admin.from("profiles").update({ plan: accessPlan }).eq("id", userId),
  ]);

  // Clear Paddle customData asynchronously — do not block the request path.
  void (async () => {
    try {
      const paddle = getPaddleInstance();
      const live = await paddle.subscriptions.get(sub.subscription_id);
      await paddle.subscriptions.update(sub.subscription_id, {
        customData: {
          ...(typeof live.customData === "object" && live.customData
            ? live.customData
            : {}),
          sheetdiff_defer_access_plan: null,
          sheetdiff_defer_until: null,
        },
      });
    } catch {
      /* best-effort */
    }
  })();

  return accessPlan;
}
