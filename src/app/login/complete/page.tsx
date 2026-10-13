"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CompleteSignupForm } from "@/components/auth/complete-signup-form";
import { createAuthClient } from "@/lib/supabase/browser-auth";

export default function CompleteSignupPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [props, setProps] = useState<{
    email: string;
    firstName: string;
    lastName: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createAuthClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const user = session.user;
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_complete, first_name, last_name, email")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profile?.onboarding_complete) {
        router.replace("/app");
        return;
      }

      const meta = user.user_metadata ?? {};
      setProps({
        email: profile?.email || user.email || "",
        firstName:
          profile?.first_name ||
          meta.given_name ||
          String(meta.full_name ?? meta.name ?? "").split(" ")[0] ||
          "",
        lastName:
          profile?.last_name ||
          meta.family_name ||
          String(meta.full_name ?? meta.name ?? "")
            .split(" ")
            .slice(1)
            .join(" ") ||
          "",
      });
      setReady(true);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready || !props) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[#64748b]">
        Loading…
      </div>
    );
  }

  return <CompleteSignupForm {...props} />;
}
