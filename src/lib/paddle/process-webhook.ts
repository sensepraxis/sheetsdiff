import {
  EventName,
  type CustomerCreatedEvent,
  type CustomerUpdatedEvent,
  type EventEntity,
  type SubscriptionCanceledEvent,
  type SubscriptionCreatedEvent,
  type SubscriptionUpdatedEvent,
  type TransactionCompletedEvent,
} from "@paddle/paddle-node-sdk";
import { planFromPriceId, type PlanId } from "@/constants/plans";
import { planRank } from "@/lib/billing/plan-rank";
import { subscriptionGrantsAccess } from "@/lib/billing/access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function processEvent(event: EventEntity) {
  switch (event.eventType) {
    case EventName.SubscriptionCreated:
    case EventName.SubscriptionUpdated:
    case EventName.SubscriptionCanceled:
      return handleSubscription(event);
    case EventName.CustomerCreated:
    case EventName.CustomerUpdated:
      return handleCustomer(event);
    case EventName.TransactionCompleted:
      return handleTransactionCompleted(event);
    default:
      return;
  }
}

async function handleCustomer(
  event: CustomerCreatedEvent | CustomerUpdatedEvent,
) {
  const admin = createAdminClient();
  const customerId = event.data.id;
  const email = event.data.email?.trim().toLowerCase();
  if (!email) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (profile?.id) {
    await admin
      .from("profiles")
      .update({ paddle_customer_id: customerId })
      .eq("id", profile.id);
  }
}

async function handleSubscription(
  event:
    | SubscriptionCreatedEvent
    | SubscriptionUpdatedEvent
    | SubscriptionCanceledEvent,
) {
  const admin = createAdminClient();
  const sub = event.data;
  const item = sub.items?.[0];
  const priceId = item?.price?.id ?? "";
  const productId = item?.price?.productId ?? item?.product?.id ?? "";
  const plan: PlanId = subscriptionGrantsAccess(sub.status)
    ? planFromPriceId(priceId)
    : "free";

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("paddle_customer_id", sub.customerId)
    .maybeSingle();

  let userId = profile?.id ?? null;
  if (!userId) {
    const nested = sub as { customer?: { email?: string | null } | null };
    const email = nested.customer?.email?.trim().toLowerCase();
    if (email) {
      const { data: byEmail } = await admin
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      userId = byEmail?.id ?? null;
      if (userId) {
        await admin
          .from("profiles")
          .update({ paddle_customer_id: sub.customerId })
          .eq("id", userId);
      }
    }
  }

  // Preserve an in-app deferred downgrade: Paddle price is already lower,
  // but profiles.plan stays higher until sheetdiff_defer_until.
  // Period-end cancel keeps paid access while status is still active.
  const custom = (sub.customData ?? {}) as {
    sheetdiff_defer_access_plan?: string | null;
    sheetdiff_defer_until?: string | null;
  };
  const deferUntil = custom.sheetdiff_defer_until ?? null;
  const deferPlan = custom.sheetdiff_defer_access_plan as PlanId | null;
  const deferActive =
    Boolean(deferUntil) &&
    Boolean(deferPlan) &&
    new Date(deferUntil!).getTime() > Date.now() &&
    planRank(deferPlan!) > planRank(plan);

  let scheduledAction: string | null = sub.scheduledChange?.action ?? null;
  let scheduledAt: string | null = sub.scheduledChange?.effectiveAt ?? null;
  let accessPlan: PlanId = plan;

  const isTerminal =
    sub.status === "canceled" || sub.status === "expired";

  // Canceled subscriptions always drop to Free once status flips.
  if (isTerminal) {
    accessPlan = "free";
    scheduledAction = null;
    scheduledAt = null;
  } else if (deferActive && deferPlan && deferUntil) {
    scheduledAction = "downgrade";
    scheduledAt = deferUntil;
    accessPlan = deferPlan;
  } else if (userId) {
    const { data: existing } = await admin
      .from("subscriptions")
      .select("scheduled_change_action, scheduled_change_at")
      .eq("subscription_id", sub.id)
      .maybeSingle();

    const { data: profile } = await admin
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .maybeSingle();

    const deferred =
      existing?.scheduled_change_action === "downgrade" &&
      existing.scheduled_change_at &&
      new Date(existing.scheduled_change_at).getTime() > Date.now();

    if (deferred) {
      scheduledAction = "downgrade";
      scheduledAt = existing.scheduled_change_at;
      const currentAccess = (profile?.plan as PlanId) ?? plan;
      accessPlan =
        planRank(currentAccess) > planRank(plan) ? currentAccess : plan;
    } else if (existing?.scheduled_change_action === "downgrade") {
      scheduledAction = null;
      scheduledAt = null;
      accessPlan = plan;
    }
  }

  await admin.from("subscriptions").upsert({
    subscription_id: sub.id,
    user_id: userId,
    paddle_customer_id: sub.customerId,
    status: sub.status,
    price_id: priceId,
    product_id: productId,
    plan,
    scheduled_change_action: scheduledAction,
    scheduled_change_at: scheduledAt,
    updated_at: new Date().toISOString(),
  });

  if (userId) {
    await admin
      .from("profiles")
      .update({
        plan: accessPlan,
        paddle_customer_id: sub.customerId,
      })
      .eq("id", userId);
  }
}

async function handleTransactionCompleted(event: TransactionCompletedEvent) {
  const admin = createAdminClient();
  const txn = event.data;
  const customerId = txn.customerId;
  if (!customerId) return;

  const nested = txn as {
    customer?: { email?: string | null } | null;
  };
  const email = nested.customer?.email?.trim().toLowerCase();
  if (!email) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (profile?.id) {
    await admin
      .from("profiles")
      .update({ paddle_customer_id: customerId })
      .eq("id", profile.id);
  }
}
