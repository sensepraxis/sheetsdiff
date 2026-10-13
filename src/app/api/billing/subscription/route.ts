import { NextResponse } from "next/server";
import type { PlanId } from "@/constants/plans";
import { getBillingSnapshot } from "@/lib/paddle/subscription-lifecycle";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRouteUser } from "@/lib/supabase/route-user";

export async function GET(request: Request) {
  const { user } = await getRouteUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, paddle_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const snapshot = await getBillingSnapshot({
    userId: user.id,
    profilePlan: (profile?.plan as PlanId) ?? "free",
    paddleCustomerId: profile?.paddle_customer_id ?? null,
  });

  return NextResponse.json(snapshot);
}
