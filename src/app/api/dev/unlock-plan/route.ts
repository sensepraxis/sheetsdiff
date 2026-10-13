import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRouteUser } from "@/lib/supabase/route-user";

const ALLOWED = new Set(["starter", "pro", "free"]);

/**
 * Local/dev only: set the signed-in user's plan without Paddle.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { user } = await getRouteUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    plan?: string;
  } | null;
  const plan = body?.plan ?? "starter";
  if (!ALLOWED.has(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const patch: Record<string, string | number> = {
    plan,
    monthly_runs_used: 0,
  };
  if (plan === "free") {
    patch.lifetime_runs_used = 0;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update(patch).eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, plan, email: user.email });
}
