"use client";

import { useCallback, useEffect, useState } from "react";
import { ManageSubscriptionButton } from "@/components/account/manage-subscription-button";
import { authFetch } from "@/lib/supabase/browser-auth";

type BillingSnapshot = {
  plan: string;
  status: string | null;
  subscriptionId: string | null;
  periodEndsAt: string | null;
  cancelAt: string | null;
  scheduledAction: "cancel" | "downgrade" | "pause" | null;
  canCancel: boolean;
  canKeep: boolean;
};

function formatDate(iso: string | null): string {
  if (!iso) return "the end of your billing period";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function BillingPanel({
  paddleCustomerId,
  isPaidPlan,
}: {
  paddleCustomerId: string | null;
  isPaidPlan: boolean;
}) {
  const [billing, setBilling] = useState<BillingSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!isPaidPlan && !paddleCustomerId) {
      setBilling(null);
      return;
    }
    try {
      const res = await authFetch("/api/billing/subscription");
      if (!res.ok) return;
      const data = (await res.json()) as BillingSnapshot;
      setBilling(data);
    } catch {
      /* ignore */
    }
  }, [isPaidPlan, paddleCustomerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function cancelAtPeriodEnd() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await authFetch("/api/billing/cancel", {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      });
      const data = (await res.json()) as {
        message?: string;
        error?: string;
        cancelAt?: string | null;
      };
      if (!res.ok) {
        setError(data.error || "Could not schedule cancellation");
        return;
      }
      setConfirmOpen(false);
      setNote(data.message || "Cancellation scheduled.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  }

  async function keepPlan() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await authFetch("/api/billing/keep-subscription", {
        method: "POST",
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(data.error || "Could not keep subscription");
        return;
      }
      setNote(data.message || "Your plan will renew as usual.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (!isPaidPlan && !paddleCustomerId) return null;

  const cancelScheduled = billing?.scheduledAction === "cancel";

  return (
    <section className="mt-8 rounded-3xl border border-[var(--border)] bg-white p-6">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-[var(--ink)]">
        Billing
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Cancel anytime. Access continues until the end of the period you already
        paid for — no prorated refund for the current cycle.
      </p>

      {cancelScheduled ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Cancellation scheduled for{" "}
          <span className="font-semibold">{formatDate(billing?.cancelAt)}</span>.
          You keep {billing?.plan ?? "your plan"} until then.
        </div>
      ) : null}

      {note ? (
        <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {note}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {paddleCustomerId ? (
          <ManageSubscriptionButton paddleCustomerId={paddleCustomerId} />
        ) : null}

        {billing?.canKeep ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void keepPlan()}
            className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Working…" : "Keep my plan"}
          </button>
        ) : null}

        {billing?.canCancel ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmOpen(true)}
            className="rounded-full border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--muted)] hover:border-red-300 hover:text-red-700 disabled:opacity-50"
          >
            Cancel plan
          </button>
        ) : null}
      </div>

      {confirmOpen ? (
        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--accent-soft)]/40 p-4 text-sm">
          <p className="font-semibold text-[var(--ink)]">
            Cancel at period end?
          </p>
          <p className="mt-2 text-[var(--muted)]">
            Your plan stays active until{" "}
            <span className="font-medium text-[var(--ink)]">
              {formatDate(billing?.periodEndsAt ?? billing?.cancelAt ?? null)}
            </span>
            . After that you return to Free and won&apos;t be charged again.
            The current period is not refunded.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void cancelAtPeriodEnd()}
              className="rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
            >
              {busy ? "Scheduling…" : "Confirm cancellation"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmOpen(false)}
              className="rounded-full px-4 py-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Never mind
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
