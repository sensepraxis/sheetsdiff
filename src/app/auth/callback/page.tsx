"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  createAuthClient,
  syncSessionToCookies,
} from "@/lib/supabase/browser-auth";

/**
 * 1) Exchange OAuth code in the browser (localStorage PKCE — reliable).
 * 2) Mirror the session into cookies for SSR / production.
 */
function CallbackInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Finishing sign-in…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const code = searchParams.get("code");
      const err =
        searchParams.get("error_description") || searchParams.get("error");
      let next = searchParams.get("next") ?? "/app";
      if (!next.startsWith("/")) next = "/app";

      if (err) {
        window.location.replace(`/login?error=${encodeURIComponent(err)}`);
        return;
      }

      if (!code) {
        window.location.replace("/login?error=missing_code");
        return;
      }

      try {
        const supabase = createAuthClient();
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;

        if (error) {
          console.error("[auth/callback]", error);
          window.location.replace(
            `/login?error=${encodeURIComponent(error.message)}`,
          );
          return;
        }

        if (!data.session?.user) {
          window.location.replace("/login?error=no_session");
          return;
        }

        setStatus("Saving secure session…");
        try {
          await syncSessionToCookies(data.session);
        } catch (syncErr) {
          // Cookie sync may fail if Node cannot reach Supabase; localStorage
          // session still works for /app via AuthGate.
          console.warn("[auth/callback] cookie sync", syncErr);
        }

        setStatus("Preparing your account…");
        const user = data.session.user;
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_complete")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile) {
          const meta = user.user_metadata ?? {};
          await supabase.from("profiles").upsert({
            id: user.id,
            email: user.email ?? "",
            full_name: String(meta.full_name ?? meta.name ?? ""),
            first_name: String(meta.given_name ?? ""),
            last_name: String(meta.family_name ?? ""),
            avatar_url: (meta.avatar_url ?? meta.picture ?? null) as
              | string
              | null,
            onboarding_complete: false,
          });
          window.location.replace("/login/complete");
          return;
        }

        window.location.replace(
          profile.onboarding_complete ? next : "/login/complete",
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : "sign-in failed";
        console.error("[auth/callback] unexpected", e);
        if (!cancelled) {
          window.location.replace(
            `/login?error=${encodeURIComponent(message)}`,
          );
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0f172a] border-t-transparent" />
      <p className="text-sm text-[#64748b]">{status}</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-[#64748b]">
          Loading…
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
