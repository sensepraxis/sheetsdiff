import { NextResponse } from "next/server";
import { getPaddleInstance } from "@/lib/paddle/server";
import { getRouteUser } from "@/lib/supabase/route-user";

/**
 * Open Paddle customer portal.
 * Auth: cookie session and/or Bearer. Customer id from the account page.
 */
export async function POST(request: Request) {
  const { user } = await getRouteUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    paddleCustomerId?: string;
  } | null;
  const customerId = body?.paddleCustomerId?.trim();
  if (!customerId) {
    return NextResponse.json(
      { error: "No Paddle customer yet. Subscribe first." },
      { status: 400 },
    );
  }

  try {
    const paddle = getPaddleInstance();

    // Ensure this customer belongs to the signed-in email when possible.
    if (user.email) {
      try {
        const customer = await paddle.customers.get(customerId);
        const customerEmail = customer.email?.trim().toLowerCase();
        if (
          customerEmail &&
          customerEmail !== user.email.trim().toLowerCase()
        ) {
          return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }
      } catch {
        // If lookup fails, still try portal with the id from the profile.
      }
    }

    const subscriptionIds: string[] = [];
    const subs = paddle.subscriptions.list({
      customerId: [customerId],
      status: ["active", "trialing", "past_due", "paused", "canceled"],
    });
    for await (const sub of subs) {
      subscriptionIds.push(sub.id);
    }

    const session = await paddle.customerPortalSessions.create(
      customerId,
      subscriptionIds,
    );

    return NextResponse.json({ url: session.urls.general.overview });
  } catch (err) {
    console.error("Portal session error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to open customer portal",
      },
      { status: 500 },
    );
  }
}
