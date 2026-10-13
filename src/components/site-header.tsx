"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createAuthClient } from "@/lib/supabase/browser-auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export function SiteHeader() {
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setReady(true);
      return;
    }

    let cancelled = false;
    try {
      const supabase = createAuthClient();
      supabase.auth.getSession().then(({ data }) => {
        if (cancelled) return;
        setSignedIn(Boolean(data.session?.user));
        setReady(true);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setSignedIn(Boolean(session?.user));
        setReady(true);
      });

      return () => {
        cancelled = true;
        subscription.unsubscribe();
      };
    } catch {
      setReady(true);
    }
  }, []);

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-8">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--ink)] text-sm font-semibold text-white">
          S
        </span>
        <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-[var(--ink)]">
          SheetDiff
        </span>
      </Link>

      <nav className="flex items-center gap-2 text-sm sm:gap-4">
        <Link
          href="/#features"
          className="hidden text-[var(--muted)] hover:text-[var(--ink)] sm:inline"
        >
          Features
        </Link>
        <Link
          href="/pricing"
          className="text-[var(--muted)] hover:text-[var(--ink)]"
        >
          Pricing
        </Link>
        {!ready ? (
          <span className="h-9 w-20 rounded-full bg-[var(--border)]/60" />
        ) : signedIn ? (
          <>
            <Link
              href="/app"
              className="rounded-full bg-[var(--ink)] px-4 py-2 font-medium text-white hover:opacity-90"
            >
              Open app
            </Link>
            <Link
              href="/account"
              className="text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Account
            </Link>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-full bg-[var(--ink)] px-4 py-2 font-medium text-white hover:opacity-90"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
