"use client";

import { useEffect, useState } from "react";

const STAGES = [
  "Looking up your subscription…",
  "Calculating the prorated difference…",
  "Charging your saved card…",
  "Unlocking your new plan…",
] as const;

/** Indeterminate-but-staged progress while Paddle collects a prorated charge. */
export function PlanChangeProgress({ active }: { active: boolean }) {
  const [stage, setStage] = useState(0);
  const [pct, setPct] = useState(8);

  useEffect(() => {
    if (!active) {
      setStage(0);
      setPct(8);
      return;
    }

    const stageTimer = window.setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1));
    }, 3500);

    const pctTimer = window.setInterval(() => {
      setPct((p) => {
        if (p >= 92) return p;
        // Ease toward ~90% while waiting on Paddle payment collection.
        return Math.min(92, p + Math.max(1, (92 - p) * 0.08));
      });
    }, 400);

    return () => {
      window.clearInterval(stageTimer);
      window.clearInterval(pctTimer);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="mt-6 w-full max-w-lg rounded-2xl border border-[var(--border)] bg-white/90 px-5 py-4 text-left shadow-[0_16px_40px_-28px_rgba(11,27,51,0.45)]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-medium text-[var(--ink)]">{STAGES[stage]}</p>
        <span className="tabular-nums text-[var(--muted)]">{Math.round(pct)}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--accent-soft)]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Card charges can take a few seconds — no new checkout window will open.
      </p>
    </div>
  );
}
