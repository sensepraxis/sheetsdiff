import { NextResponse } from "next/server";
import { scheduleCancelAtPeriodEnd } from "@/lib/paddle/subscription-lifecycle";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRouteUser } from "@/lib/supabase/route-user";

/**
 * Cancel at period end (Notion / GitHub style).
 * Access stays until cancelAt; no immediate refund of the current period.
 */
export async function POST(request: Request) {
  const { user } = await getRouteUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    confirm?: boolean;
  } | null;
  if (!body?.confirm) {
    return NextResponse.json(
      { error: "Pass confirm: true to schedule cancellation." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("paddle_customer_id, plan")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.paddle_customer_id && profile?.plan === "free") {
    return NextResponse.json(
      { error: "No paid subscription to cancel." },
      { status: 400 },
    );
  }

  try {
    const result = await scheduleCancelAtPeriodEnd({
      userId: user.id,
      paddleCustomerId: profile?.paddle_customer_id ?? null,
    });

    const when = result.cancelAt
      ? new Date(result.cancelAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "the end of your billing period";

    return NextResponse.json({
      ok: true,
      ...result,
      message: `Cancellation scheduled. You keep your current plan until ${when}. You will not be charged again.`,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to cancel subscription";
    console.error("[billing/cancel]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
