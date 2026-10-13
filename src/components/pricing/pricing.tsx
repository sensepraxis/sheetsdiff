"use client";

import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FrequencyToggle,
  type BillingFrequency,
} from "@/components/pricing/frequency-toggle";
import { PlanChangeProgress } from "@/components/pricing/plan-change-progress";
import type { PlanId } from "@/constants/plans";
import { PricingTier, type Tier } from "@/constants/pricing-tier";
import { usePaddlePrices } from "@/hooks/usePaddlePrices";
import { isDowngrade, isUpgrade, planRank } from "@/lib/billing/plan-rank";
import { UNKNOWN_COUNTRY } from "@/lib/country";
import {
  getPaddleClientToken,
  getPaddleEnvironment,
  paddleConfigured,
  paddleReadyForCheckout,
} from "@/lib/paddle-env";
import { authFetch, createAuthClient } from "@/lib/supabase/browser-auth";

interface PricingProps {
  country: string;
  userEmail?: string;
  currentPlan?: PlanId;
}

function getSuccessUrl() {
  return new URL("/welcome", window.location.origin).toString();
}

export function Pricing({
  country,
  userEmail: serverEmail,
  currentPlan: serverPlan,
}: PricingProps) {
  const router = useRouter();
  const [frequency, setFrequency] = useState<BillingFrequency>("month");
  const [selectedId, setSelectedId] = useState<Tier["id"]>("starter");
  const [paddle, setPaddle] = useState<Paddle | undefined>();
  const [initError, setInitError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [progressActive, setProgressActive] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>(serverEmail);
  const [currentPlan, setCurrentPlan] = useState<PlanId>(serverPlan ?? "free");
  const configured = paddleConfigured();
  const checkoutReady = paddleReadyForCheckout();

  useEffect(() => {
    try {
      const supabase = createAuthClient();
      void supabase.auth.getSession().then(async ({ data }) => {
        const sessionUser = data.session?.user;
        if (!serverEmail) {
          setUserEmail(sessionUser?.email ?? undefined);
        }
        if (!serverPlan && sessionUser?.id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("plan")
            .eq("id", sessionUser.id)
            .maybeSingle();
          if (profile?.plan) setCurrentPlan(profile.plan as PlanId);
        }
      });
    } catch {
      // Supabase not configured
    }
  }, [serverEmail, serverPlan]);

  const { prices, loading, error: priceError } = usePaddlePrices(
    checkoutReady ? paddle : undefined,
    country || UNKNOWN_COUNTRY,
  );

  useEffect(() => {
    if (!checkoutReady || paddle?.Initialized) return;
    let cancelled = false;
    try {
      initializePaddle({
        token: getPaddleClientToken(),
        environment: getPaddleEnvironment(),
        checkout: {
          settings: {
            displayMode: "overlay",
            variant: "one-page",
            locale: "en",
            successUrl: getSuccessUrl(),
            allowLogout: !userEmail,
          },
        },
      }).then((instance) => {
        if (!cancelled && instance) setPaddle(instance);
      });
    } catch (err) {
      setInitError(err instanceof Error ? err.message : "Paddle init failed");
    }
    return () => {
      cancelled = true;
    };
  }, [checkoutReady, paddle?.Initialized, userEmail]);

  function loginHref(tierId?: string) {
    const params = new URLSearchParams({ next: "/pricing" });
    if (tierId && tierId !== "free") params.set("plan", tierId);
    return `/login?${params.toString()}`;
  }

  function openCheckout(priceId: string) {
    if (!userEmail) {
      router.push(loginHref());
      return;
    }
    if (!paddle) {
      setInitError("Paddle is still initializing. Try again in a moment.");
      return;
    }
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      settings: {
        displayMode: "overlay",
        variant: "one-page",
        locale: "en",
        successUrl: getSuccessUrl(),
        allowLogout: false,
      },
      customer: {
        email: userEmail,
        ...(country && country !== UNKNOWN_COUNTRY
          ? { address: { countryCode: country } }
          : {}),
      },
    });
  }

  function ctaLabel(tier: Tier): string {
    if (tier.id === "free") return "Start free";
    if (!userEmail) return "Sign in to subscribe";
    if (tier.id === currentPlan) return "Current plan";
    if (isUpgrade(currentPlan, tier.id)) return "Upgrade (prorated)";
    if (isDowngrade(currentPlan, tier.id)) return "Schedule downgrade";
    if (planRank(currentPlan) > 0) return "Switch plan";
    return "Subscribe";
  }

  async function handleSubscribe(tier: Tier) {
    setSelectedId(tier.id);
    if (tier.id === "free") return;

    // Plans unlock on profiles — never checkout as a guest.
    if (!userEmail) {
      router.push(loginHref(tier.id));
      return;
    }

    if (!checkoutReady) {
      setInitError(
        "Paddle is not configured yet: .env.local still has test_… / pri_… placeholders. Add real Sandbox Client Token and Price IDs, then restart the app.",
      );
      return;
    }

    const priceId = tier.priceId[frequency];
    if (!priceId) {
      setInitError(
        `Missing Paddle price id for ${tier.name} (${frequency}). Set NEXT_PUBLIC_PADDLE_PRICE_* in .env.local.`,
      );
      return;
    }

    if (tier.id === currentPlan) {
      setStatusNote(`You're already on ${tier.name}.`);
      return;
    }

    setCheckoutBusy(true);
    setInitError(null);
    setStatusNote(null);
    const showProgress =
      isUpgrade(currentPlan, tier.id) ||
      (planRank(currentPlan) > 0 && tier.id !== currentPlan);
    setProgressActive(showProgress);

    try {
      const res = await authFetch("/api/billing/change-plan", {
        method: "POST",
        body: JSON.stringify({ priceId }),
      });
      const data = (await res.json()) as {
        action?: string;
        plan?: PlanId;
        message?: string;
        error?: string;
      };

      if (res.status === 401) {
        setProgressActive(false);
        router.push(loginHref(tier.id));
        return;
      }

      if (!res.ok) {
        setProgressActive(false);
        setInitError(data.error || "Failed to change plan");
        return;
      }

      // First paid subscription (or no active sub) → open Checkout overlay.
      if (data.action === "checkout") {
        setProgressActive(false);
        openCheckout(priceId);
        return;
      }

      setProgressActive(false);
      if (data.plan) setCurrentPlan(data.plan);
      setStatusNote(data.message || "Plan updated.");
      if (data.action === "upgraded" || data.action === "switched") {
        router.refresh();
      }
    } catch (err) {
      setProgressActive(false);
      setInitError(
        err instanceof Error ? err.message : "Checkout failed to open",
      );
    } finally {
      setCheckoutBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Pricing
        </p>
        <h1 className="max-w-2xl font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--ink)] sm:text-5xl">
          Start free. Pay when month-end repeats.
        </h1>
        <p className="max-w-xl text-[var(--muted)]">
          Free is one lifetime run. Starter and Pro unlock full export and
          monthly runs. Pro adds AI column mapping (DeepSeek) and an audit sheet
          on export. Upgrades charge the prorated difference; downgrades take
          effect at period end.
        </p>
        <FrequencyToggle value={frequency} onChange={setFrequency} />
      </div>

      <div className="mt-6 flex flex-col items-center">
        <PlanChangeProgress active={progressActive} />
        {statusNote && !progressActive ? (
          <p className="w-full max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-900">
            {statusNote}
          </p>
        ) : null}
      </div>

      {!checkoutReady ? (
        <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
          Payments are not connected yet: Paddle token / price IDs in
          `.env.local` are still placeholders, so Subscribe cannot open
          checkout. Add real Paddle Sandbox credentials and restart the app.
        </p>
      ) : null}

      {initError ? (
        <p className="mt-4 text-center text-sm text-red-600">{initError}</p>
      ) : null}
      {checkoutReady && priceError ? (
        <p className="mt-4 text-center text-sm text-amber-700">
          Live Paddle prices unavailable — showing list prices. {priceError}
        </p>
      ) : null}

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {PricingTier.map((tier) => {
          const priceId = tier.priceId[frequency];
          const formatted =
            (priceId && prices[priceId]) || tier.displayPrice[frequency];
          const selected = selectedId === tier.id;

          return (
            <article
              key={tier.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedId(tier.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedId(tier.id);
                }
              }}
              className={`flex cursor-pointer flex-col rounded-3xl border p-8 transition ${
                selected
                  ? "border-[var(--accent)] bg-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.45)] ring-2 ring-[var(--accent)]/30"
                  : "border-[var(--border)] bg-white/80 hover:border-[var(--accent)]/50"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-[var(--ink)]">
                  {tier.name}
                </h2>
                <div className="flex items-center gap-2">
                  {selected ? (
                    <span className="rounded-full border border-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                      Selected
                    </span>
                  ) : null}
                  {tier.featured ? (
                    <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white">
                      Popular
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {tier.description}
              </p>
              <p className="mt-8 flex items-end gap-2">
                <span className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--ink)]">
                  {tier.id !== "free" &&
                  checkoutReady &&
                  loading &&
                  priceId
                    ? "…"
                    : formatted}
                </span>
                {tier.id !== "free" ? (
                  <span className="pb-1 text-sm text-[var(--muted)]">
                    /{frequency === "month" ? "month" : "year"}
                  </span>
                ) : null}
              </p>
              <ul className="mt-8 flex flex-1 flex-col gap-3 text-sm text-[var(--ink)]">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span aria-hidden className="text-[var(--accent)]">
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {tier.id === "free" ? (
                <Link
                  href="/login"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-10 rounded-full bg-[var(--ink)] px-5 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
                >
                  Start free
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={checkoutBusy || tier.id === currentPlan}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleSubscribe(tier);
                  }}
                  className={`mt-10 rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    tier.id === currentPlan
                      ? "border border-[var(--border)] bg-white text-[var(--muted)]"
                      : selected
                        ? "bg-[var(--accent)] text-white hover:brightness-110"
                        : "bg-[var(--ink)] text-white hover:opacity-90"
                  }`}
                >
                  {checkoutBusy && selectedId === tier.id
                    ? "Working…"
                    : ctaLabel(tier)}
                </button>
              )}
            </article>
          );
        })}
      </div>

      {!configured ? (
        <p className="mt-6 text-center text-xs text-[var(--muted)]">
          Set NEXT_PUBLIC_PADDLE_CLIENT_TOKEN and NEXT_PUBLIC_PADDLE_ENV to enable
          checkout.
        </p>
      ) : null}
    </div>
  );
}
