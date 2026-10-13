import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/actions/auth";
import { BillingPanel } from "@/components/account/billing-panel";
import { AuthGatedAccount } from "@/components/auth/auth-gated-account";
import { PLANS, type PlanId } from "@/constants/plans";
import { createClient } from "@/lib/supabase/server";

async function AccountFromServer() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user) {
    if (!error || !/fetch|ECONNRESET|timeout|network/i.test(error.message)) {
      redirect("/login");
    }
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "email, full_name, plan, lifetime_runs_used, monthly_runs_used, paddle_customer_id",
    )
    .eq("id", user.id)
    .maybeSingle();

  const planId = (profile?.plan as PlanId) || "free";
  const plan = PLANS[planId];

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12 sm:px-8">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--ink)]">
        Account
      </h1>
      <div className="mt-8 space-y-4 rounded-3xl border border-[var(--border)] bg-white p-6 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-[var(--muted)]">Name</span>
          <span className="font-medium">{profile?.full_name || "—"}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[var(--muted)]">Email</span>
          <span className="font-medium">{profile?.email || user.email}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[var(--muted)]">Plan</span>
          <span className="font-medium">{plan.name}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[var(--muted)]">Usage</span>
          <span className="font-medium">
            {planId === "free"
              ? `${profile?.lifetime_runs_used ?? 0} / ${plan.lifetimeRuns} lifetime`
              : `${profile?.monthly_runs_used ?? 0} / ${plan.runsPerMonth} this month`}
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/pricing"
          className="rounded-full border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--ink)]"
        >
          Change plan
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Sign out
          </button>
        </form>
      </div>

      <BillingPanel
        paddleCustomerId={profile?.paddle_customer_id ?? null}
        isPaidPlan={planId === "starter" || planId === "pro"}
      />
    </div>
  );
}

export default async function AccountPage() {
  try {
    const view = await AccountFromServer();
    if (view) return view;
  } catch {
    /* fall through */
  }

  return <AuthGatedAccount />;
}
