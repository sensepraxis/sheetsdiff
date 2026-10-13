"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, FileSpreadsheet } from "lucide-react";
import { createAuthClient } from "@/lib/supabase/browser-auth";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/app";
  return raw;
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() => {
    const q = searchParams.get("error");
    if (!q) return null;
    if (q === "auth") return "Google sign-in failed. Please try again.";
    const decoded = decodeURIComponent(q);
    if (/fetch failed|ECONNRESET|Failed to fetch|NetworkError/i.test(decoded)) {
      return "Cannot reach Supabase (network reset). Check VPN / access to *.supabase.co, then try again.";
    }
    if (/PKCE code verifier/i.test(decoded)) {
      return "Sign-in credentials expired. Click Continue with Google again (do not reuse an old tab).";
    }
    return decoded;
  });

  async function continueWithGoogle() {
    setBusy(true);
    setError(null);
    try {
      try {
        Object.keys(window.localStorage)
          .filter((k) => k.includes("code-verifier"))
          .forEach((k) => window.localStorage.removeItem(k));
      } catch {
        /* ignore */
      }

      const supabase = createAuthClient();
      const origin = window.location.origin;
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
          skipBrowserRedirect: false,
        },
      });
      if (authError) {
        setError(authError.message);
        setBusy(false);
        return;
      }
      if (data?.url) {
        window.location.assign(data.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  async function continueWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createAuthClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      setBusy(false);
      if (authError) {
        setError(authError.message);
        return;
      }
      setMessage("Check your email for the magic link.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  const canContinueEmail = email.trim().length > 3 && email.includes("@");

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 lg:py-16">
      <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold tracking-wide text-[var(--accent)]">
            Sign in to reconcile
          </p>
          <h1 className="mt-5 max-w-xl font-[family-name:var(--font-display)] text-4xl leading-[1.08] font-semibold tracking-tight text-[var(--ink)] sm:text-5xl">
            Two sheets in. Three lists out —{" "}
            <span className="text-[var(--gold)]">matched, missing, and the dollars that do not tie.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-[var(--muted)]">
            Use the same account for runs, exports, and billing. Source files
            stay on your machine.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-[var(--muted)]">
            {[
              "Drop any two CSV / Excel exports",
              "Hard match first, review the collisions",
              "Upgrade anytime — prorated, no new subscription",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div
            aria-hidden
            className="absolute inset-6 rounded-[2rem]"
            style={{ backgroundColor: "#16352a" }}
          />
          <div className="relative rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_30px_80px_-40px_rgba(11,27,51,0.55)] sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <FileSpreadsheet className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-[var(--ink)]">
                  Welcome back
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  Match two spreadsheets. See what&apos;s left.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={continueWithGoogle}
              className="mt-7 flex w-full items-center justify-center gap-3 rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)]">
              <span className="h-px flex-1 bg-[var(--border)]" />
              OR
              <span className="h-px flex-1 bg-[var(--border)]" />
            </div>

            <form onSubmit={continueWithEmail} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your work email…"
                className="w-full rounded-full border border-[var(--border)] bg-[var(--accent-soft)]/40 px-5 py-3 text-sm text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:bg-white"
              />
              <button
                type="submit"
                disabled={busy || !canContinueEmail}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition disabled:opacity-50 ${
                  canContinueEmail
                    ? "bg-[var(--accent)] text-white hover:brightness-110"
                    : "cursor-not-allowed border border-[var(--border)] bg-white/70 text-[var(--muted)]"
                }`}
              >
                Continue with email
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {message ? (
              <p className="mt-4 text-center text-sm text-[var(--ok)]">{message}</p>
            ) : null}
            {error ? (
              <p className="mt-4 text-center text-sm text-red-600">{error}</p>
            ) : null}

            <p className="mt-6 text-center text-sm text-[var(--muted)]">
              <Link
                href="/"
                className="font-medium text-[var(--ink)] hover:underline"
              >
                ← Back to home
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.1 4 9.2 8.5 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.1 39.5 16 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l.1.1 6.3 5.2C39.3 36.9 44 31.5 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}
