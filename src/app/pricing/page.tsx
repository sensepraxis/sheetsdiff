import { headers } from "next/headers";
import { Pricing } from "@/components/pricing/pricing";
import type { PlanId } from "@/constants/plans";
import { resolveCountryFromHeaders } from "@/lib/country";
import { createClient } from "@/lib/supabase/server";

export default async function PricingPage() {
  const headerStore = await headers();
  const country = resolveCountryFromHeaders(
    headerStore.get("x-vercel-ip-country"),
  );

  let userEmail: string | undefined;
  let currentPlan: PlanId | undefined;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userEmail = user?.email ?? undefined;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .maybeSingle();
      currentPlan = (profile?.plan as PlanId) ?? undefined;
    }
  } catch {
    userEmail = undefined;
  }

  return (
    <Pricing
      country={country}
      userEmail={userEmail}
      currentPlan={currentPlan}
    />
  );
}
