"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaddleInstance } from "@/lib/paddle/server";

export async function createPortalSession(): Promise<
  { url: string } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("paddle_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  let customerId = profile?.paddle_customer_id;
  if (!customerId) {
    return { error: "No Paddle customer yet. Subscribe first." };
  }

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("subscriptions")
    .select("subscription_id")
    .eq("paddle_customer_id", customerId);

  const paddle = getPaddleInstance();
  const session = await paddle.customerPortalSessions.create(
    customerId,
    (subs ?? []).map((s) => s.subscription_id),
  );

  return { url: session.urls.general.overview };
}
