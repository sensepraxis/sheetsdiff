import { NextResponse } from "next/server";
import { clearScheduledCancel } from "@/lib/paddle/subscription-lifecycle";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRouteUser } from "@/lib/supabase/route-user";

/** Remove a scheduled period-end cancellation. */
export async function POST(request: Request) {
  const { user } = await getRouteUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("paddle_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  try {
    const result = await clearScheduledCancel({
      userId: user.id,
      paddleCustomerId: profile?.paddle_customer_id ?? null,
    });
    return NextResponse.json({
      ok: true,
      ...result,
      message: "Scheduled cancellation removed. Your plan will renew as usual.",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to keep subscription";
    console.error("[billing/keep]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
