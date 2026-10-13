import { PLANS, type PlanId } from "@/constants/plans";

export type ProfileBilling = {
  plan: PlanId;
  lifetime_runs_used: number;
  monthly_runs_used: number;
  monthly_runs_reset_at: string;
};

export function subscriptionGrantsAccess(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

export function maybeResetMonthlyRuns(profile: ProfileBilling): ProfileBilling {
  const resetAt = new Date(profile.monthly_runs_reset_at);
  if (Number.isNaN(resetAt.getTime()) || Date.now() < resetAt.getTime()) {
    return profile;
  }
  const next = new Date();
  next.setUTCMonth(next.getUTCMonth() + 1, 1);
  next.setUTCHours(0, 0, 0, 0);
  return {
    ...profile,
    monthly_runs_used: 0,
    monthly_runs_reset_at: next.toISOString(),
  };
}

export type RunGate =
  | { ok: true; plan: PlanId; remaining: number | null }
  | { ok: false; reason: "limit"; plan: PlanId; message: string };

export function canStartRun(profile: ProfileBilling, rowsA: number, rowsB: number): RunGate {
  const normalized = maybeResetMonthlyRuns(profile);
  const plan = PLANS[normalized.plan] ?? PLANS.free;

  if (rowsA > plan.maxRowsPerSide || rowsB > plan.maxRowsPerSide) {
    return {
      ok: false,
      reason: "limit",
      plan: plan.id,
      message: `${plan.name} allows up to ${plan.maxRowsPerSide.toLocaleString()} rows per side.`,
    };
  }

  if (plan.id === "free") {
    const used = normalized.lifetime_runs_used;
    const limit = plan.lifetimeRuns ?? 1;
    if (used >= limit) {
      return {
        ok: false,
        reason: "limit",
        plan: "free",
        message: "Free includes 1 lifetime run. Upgrade to Starter for monthly runs.",
      };
    }
    return { ok: true, plan: "free", remaining: limit - used };
  }

  const used = normalized.monthly_runs_used;
  const limit = plan.runsPerMonth ?? 0;
  if (used >= limit) {
    return {
      ok: false,
      reason: "limit",
      plan: plan.id,
      message: `${plan.name} includes ${limit} runs this month. Upgrade or wait for reset.`,
    };
  }
  return { ok: true, plan: plan.id, remaining: limit - used };
}
