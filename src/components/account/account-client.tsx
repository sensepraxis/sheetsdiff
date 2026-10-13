"use client";

import Link from "next/link";
import { BillingPanel } from "@/components/account/billing-panel";
import { PLANS, type PlanId } from "@/constants/plans";
import { createAuthClient } from "@/lib/supabase/browser-auth";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

type Profile = {
  email: string | null;
  full_name: string | null;
  plan: PlanId;
  lifetime_runs_used: number;
  monthly_runs_used: number;
  paddle_customer_id: string | null;
};

export function AccountClient({ user }: { user: User }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createAuthClient();
    supabase
      .from("profiles")
      .select(
        "email, full_name, plan, lifetime_runs_used, monthly_runs_used, paddle_customer_id",
      )
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile({
          email: data?.email ?? user.email ?? null,
          full_name: data?.full_name ?? null,
          plan: (data?.plan as PlanId) || "free",
          lifetime_runs_used: data?.lifetime_runs_used ?? 0,
          monthly_runs_used: data?.monthly_runs_used ?? 0,
          paddle_customer_id: data?.paddle_customer_id ?? null,
        });
      });
  }, [user.id, user.email]);

  async function onSignOut() {
    setSigningOut(true);
    const supabase = createAuthClient();
    await supabase.auth.signOut();
    window.location.assign("/");
  }

  if (!profile) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--muted)]">
        Loading account…
      </div>
    );
  }

  const plan = PLANS[profile.plan];

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12 sm:px-8">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--ink)]">
        Account
      </h1>
      <div className="mt-8 space-y-4 rounded-3xl border border-[var(--border)] bg-white p-6 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-[var(--muted)]">Name</span>
          <span className="font-medium">{profile.full_name || "—"}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[var(--muted)]">Email</span>
          <span className="font-medium">{profile.email || user.email}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[var(--muted)]">Plan</span>
          <span className="font-medium">{plan.name}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[var(--muted)]">Usage</span>
          <span className="font-medium">
            {profile.plan === "free"
              ? `${profile.lifetime_runs_used} / ${plan.lifetimeRuns} lifetime`
              : `${profile.monthly_runs_used} / ${plan.runsPerMonth} this month`}
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
        <button
          type="button"
          disabled={signingOut}
          onClick={() => void onSignOut()}
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-50"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>

      <BillingPanel
        paddleCustomerId={profile.paddle_customer_id}
        isPaidPlan={profile.plan === "starter" || profile.plan === "pro"}
      />
    </div>
  );
}
