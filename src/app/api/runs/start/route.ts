import { NextResponse } from "next/server";
import type { PlanId } from "@/constants/plans";
import {
  canStartRun,
  maybeResetMonthlyRuns,
} from "@/lib/billing/access";
import { applyDuePlanAccess } from "@/lib/paddle/change-plan";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRouteUser } from "@/lib/supabase/route-user";

export async function POST(request: Request) {
  const { user } = await getRouteUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, message: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as {
    rowsA?: number;
    rowsB?: number;
    fileAName?: string;
    fileBName?: string;
  };

  await applyDuePlanAccess(user.id);

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select(
      "plan, lifetime_runs_used, monthly_runs_used, monthly_runs_reset_at",
    )
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json(
      { ok: false, message: "Profile missing. Re-run supabase/schema.sql." },
      { status: 500 },
    );
  }

  const normalized = maybeResetMonthlyRuns({
    plan: profile.plan as PlanId,
    lifetime_runs_used: profile.lifetime_runs_used,
    monthly_runs_used: profile.monthly_runs_used,
    monthly_runs_reset_at: profile.monthly_runs_reset_at,
  });

  const gate = canStartRun(
    normalized,
    Number(body.rowsA ?? 0),
    Number(body.rowsB ?? 0),
  );
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, message: gate.message },
      { status: 402 },
    );
  }

  const { data: run, error: runError } = await admin
    .from("recon_runs")
    .insert({
      user_id: user.id,
      file_a_name: body.fileAName ?? null,
      file_b_name: body.fileBName ?? null,
      rows_a: Number(body.rowsA ?? 0),
      rows_b: Number(body.rowsB ?? 0),
    })
    .select("id")
    .single();

  if (runError || !run) {
    return NextResponse.json(
      { ok: false, message: runError?.message || "Could not create run" },
      { status: 500 },
    );
  }

  const patch =
    normalized.plan === "free"
      ? {
          lifetime_runs_used: normalized.lifetime_runs_used + 1,
          monthly_runs_used: normalized.monthly_runs_used,
          monthly_runs_reset_at: normalized.monthly_runs_reset_at,
        }
      : {
          monthly_runs_used: normalized.monthly_runs_used + 1,
          monthly_runs_reset_at: normalized.monthly_runs_reset_at,
        };

  await admin.from("profiles").update(patch).eq("id", user.id);

  return NextResponse.json({ ok: true, runId: run.id, remaining: gate.remaining });
}
