import { redirect } from "next/navigation";
import { AppWorkspace } from "@/components/app/app-workspace";
import { AuthGatedApp } from "@/components/auth/auth-gated-app";
import { createClient } from "@/lib/supabase/server";

export default async function AppPage() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.onboarding_complete) {
        redirect("/login/complete");
      }

      return <AppWorkspace userId={user.id} />;
    }

    if (!error || !/fetch|ECONNRESET|timeout|network/i.test(error.message)) {
      redirect("/login?next=/app");
    }
  } catch {
    /* Node → Supabase failed; use browser session */
  }

  return <AuthGatedApp />;
}
