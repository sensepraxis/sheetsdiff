import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRouteUser } from "@/lib/supabase/route-user";

export async function POST(request: Request) {
  const { user } = await getRouteUser(request);
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await request.json()) as {
    runId?: string;
    matched?: number;
    onlyA?: number;
    onlyB?: number;
    needsReview?: number;
    delta?: string;
    summary?: Record<string, unknown>;
  };

  if (!body.runId) {
    return NextResponse.json({ ok: false, message: "runId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("recon_runs")
    .update({
      matched_count: body.matched ?? 0,
      only_a_count: body.onlyA ?? 0,
      only_b_count: body.onlyB ?? 0,
      needs_review_count: body.needsReview ?? 0,
      delta_amount: body.delta ?? null,
      summary: body.summary ?? {},
    })
    .eq("id", body.runId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
