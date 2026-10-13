import { NextResponse } from "next/server";
import type { PlanId } from "@/constants/plans";
import {
  applyDuePlanAccess,
  changePlanForUser,
} from "@/lib/paddle/change-plan";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRouteUser } from "@/lib/supabase/route-user";

/**
 * Change paid plan on an existing Paddle subscription (prorated upgrade /
 * end-of-cycle downgrade). Returns { action: "checkout" } when the user
 * still needs a first Checkout.
 */
export async function POST(request: Request) {
  const { user } = await getRouteUser(request);
  if (!user?.email) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const body = (await request.json()) as { priceId?: string };
  const priceId = body.priceId?.trim();
  if (!priceId?.startsWith("pri_")) {
    return NextResponse.json({ error: "priceId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const [, profileResult] = await Promise.all([
    applyDuePlanAccess(user.id),
    admin
      .from("profiles")
      .select("plan, paddle_customer_id")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  const profile = profileResult.data;

  try {
    const result = await changePlanForUser({
      userId: user.id,
      email: user.email,
      priceId,
      currentPlan: (profile?.plan as PlanId) ?? "free",
      paddleCustomerId: profile?.paddle_customer_id ?? null,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to change plan";
    console.error("[change-plan]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
