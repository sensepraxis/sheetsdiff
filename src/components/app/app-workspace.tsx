"use client";

import { Workspace } from "@/components/app/workspace";
import { useEffect, useState } from "react";
import { createAuthClient } from "@/lib/supabase/browser-auth";
import type { PlanId } from "@/constants/plans";

export function AppWorkspace({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<{
    plan: PlanId;
    lifetime_runs_used: number;
    monthly_runs_used: number;
    full_name: string | null;
  } | null>(null);

  useEffect(() => {
    const supabase = createAuthClient();
    supabase
      .from("profiles")
      .select(
        "plan, lifetime_runs_used, monthly_runs_used, full_name, onboarding_complete",
      )
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.onboarding_complete) {
          window.location.assign("/login/complete");
          return;
        }
        setProfile({
          plan: (data.plan as PlanId) || "free",
          lifetime_runs_used: data.lifetime_runs_used ?? 0,
          monthly_runs_used: data.monthly_runs_used ?? 0,
          full_name: data.full_name ?? null,
        });
      });
  }, [userId]);

  if (!profile) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[#64748b]">
        Loading workspace…
      </div>
    );
  }

  return <Workspace profile={profile} />;
}
