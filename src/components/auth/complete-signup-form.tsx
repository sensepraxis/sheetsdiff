"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createAuthClient } from "@/lib/supabase/browser-auth";

type Props = {
  email: string;
  firstName: string;
  lastName: string;
};

export function CompleteSignupForm({ email, firstName, lastName }: Props) {
  const router = useRouter();
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const [subscribe, setSubscribe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onContinue(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createAuthClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Session expired. Please sign in again.");
      setBusy(false);
      return;
    }

    const fullName = `${first.trim()} ${last.trim()}`.trim();

    // Prefer security-definer RPC (bypasses RLS insert gaps).
    const { error: rpcError } = await supabase.rpc("complete_onboarding", {
      p_first_name: first.trim(),
      p_last_name: last.trim(),
      p_full_name: fullName,
    });

    if (rpcError) {
      // Fallback: update existing row, then insert if needed
      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update({
          first_name: first.trim(),
          last_name: last.trim(),
          full_name: fullName,
          onboarding_complete: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
        .select("id");

      if (!updateError && updated && updated.length > 0) {
        // ok
      } else {
        const { error: insertError } = await supabase.from("profiles").insert({
          id: user.id,
          email: user.email ?? email,
          first_name: first.trim(),
          last_name: last.trim(),
          full_name: fullName,
          onboarding_complete: true,
        });

        if (insertError) {
          setBusy(false);
          setError(
            insertError.message.includes("row-level security")
              ? "Database permissions are missing. Run supabase/patch-complete-onboarding.sql in the Supabase SQL Editor, then try again."
              : insertError.message || rpcError.message,
          );
          return;
        }
      }
    }

    setBusy(false);

    void subscribe;
    window.location.assign("/app");
  }

  return (
    <div className="relative flex min-h-[calc(100vh-5.5rem)] flex-col items-center justify-center px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 420px at 50% -10%, rgba(31,75,153,0.10), transparent 60%), linear-gradient(180deg, #f7f8fb 0%, #eef1f6 100%)",
        }}
      />

      <div className="w-full max-w-[400px] rounded-[28px] border border-black/[0.06] bg-white/90 p-8 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.55)] backdrop-blur-sm sm:p-10">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f172a] text-[15px] font-semibold text-white">
            S
          </div>
          <h1 className="mt-5 text-[1.75rem] font-semibold tracking-[-0.03em] text-[#0f172a]">
            Complete your account
          </h1>
          <p className="mt-2 text-[15px] text-[#64748b]">
            Confirm your name, then enter SheetDiff.
          </p>
        </div>

        <form onSubmit={onContinue} className="mt-8 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              placeholder="First name"
              className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3.5 text-[15px] outline-none focus:border-[#94a3b8] focus:bg-white"
            />
            <input
              required
              value={last}
              onChange={(e) => setLast(e.target.value)}
              placeholder="Last name"
              className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3.5 text-[15px] outline-none focus:border-[#94a3b8] focus:bg-white"
            />
          </div>
          <input
            disabled
            value={email}
            className="w-full rounded-2xl border border-[#e2e8f0] bg-[#f1f5f9] px-4 py-3.5 text-[15px] text-[#64748b]"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-[#0f172a] px-4 py-3.5 text-[15px] font-semibold text-white hover:bg-[#1e293b] disabled:opacity-50"
          >
            Continue
          </button>
          <label className="flex items-center gap-2 pt-1 text-sm text-[#64748b]">
            <input
              type="checkbox"
              checked={subscribe}
              onChange={(e) => setSubscribe(e.target.checked)}
              className="accent-[#0f172a]"
            />
            Subscribe to get email updates
          </label>
        </form>
        {error ? (
          <p className="mt-4 text-center text-sm text-[#dc2626]">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
