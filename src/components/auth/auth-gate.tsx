"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { createAuthClient } from "@/lib/supabase/browser-auth";
import type { User } from "@supabase/supabase-js";

export function AuthGate({
  children,
  redirectTo = "/login",
}: {
  children: (user: User) => ReactNode;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createAuthClient();

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!data.session?.user) {
        router.replace(redirectTo);
        return;
      }
      setUser(data.session.user);
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.replace(redirectTo);
        return;
      }
      setUser(session.user);
      setReady(true);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [redirectTo, router]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[#64748b]">
        Checking session…
      </div>
    );
  }

  return <>{children(user)}</>;
}
