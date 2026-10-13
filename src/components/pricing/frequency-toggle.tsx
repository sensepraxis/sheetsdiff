"use client";

import type { BillingFrequency } from "@/constants/pricing-tier";

export type { BillingFrequency };

export function FrequencyToggle({
  value,
  onChange,
}: {
  value: BillingFrequency;
  onChange: (value: BillingFrequency) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-[var(--border)] bg-white p-1 text-sm">
      {(["month", "year"] as const).map((freq) => (
        <button
          key={freq}
          type="button"
          onClick={() => onChange(freq)}
          className={`rounded-full px-4 py-1.5 font-medium ${
            value === freq
              ? "bg-[var(--ink)] text-white"
              : "text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
        >
          {freq === "month" ? "Monthly" : "Yearly"}
        </button>
      ))}
    </div>
  );
}
