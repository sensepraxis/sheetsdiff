export type PlanId = "free" | "starter" | "pro";

export type PlanLimits = {
  id: PlanId;
  name: string;
  priceMonth: number | null;
  priceYear: number | null;
  /** Lifetime complete runs for free; monthly for paid. */
  runsPerMonth: number | null;
  lifetimeRuns: number | null;
  maxRowsPerSide: number;
  previewRows: number | null;
  fullExport: boolean;
  /** Reserved: saved mapping UI not shipped yet — do not advertise. */
  maxRuleSets: number;
  aiSuggestions: boolean;
  auditExport: boolean;
  /** Reserved: run-history UI / retention not shipped yet — do not advertise. */
  historyDays: number;
  tagline: string;
  features: string[];
};

export const PLANS: Record<PlanId, PlanLimits> = {
  free: {
    id: "free",
    name: "Free",
    priceMonth: 0,
    priceYear: 0,
    runsPerMonth: null,
    lifetimeRuns: 1,
    maxRowsPerSide: 5_000,
    previewRows: 20,
    fullExport: false,
    maxRuleSets: 0,
    aiSuggestions: false,
    auditExport: false,
    historyDays: 0,
    tagline: "One free SheetDiff run to see your three lists.",
    features: [
      "1 lifetime complete run",
      "Summary + 20-row result preview",
      "No full XLSX export",
      "Column mapping + manual review",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonth: 9.9,
    priceYear: 99,
    runsPerMonth: 5,
    lifetimeRuns: null,
    maxRowsPerSide: 5_000,
    previewRows: null,
    fullExport: true,
    maxRuleSets: 1,
    aiSuggestions: false,
    auditExport: false,
    historyDays: 30,
    tagline: "Month-end for one book. Full export. Higher run quota.",
    features: [
      "5 runs / month",
      "Up to 5,000 rows per side",
      "Full matched / only-A / only-B export",
      "Manual review for ambiguous matches",
      "Date tolerance & flip-sign options",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonth: 29.9,
    priceYear: 299,
    runsPerMonth: 40,
    lifetimeRuns: null,
    maxRowsPerSide: 25_000,
    previewRows: null,
    fullExport: true,
    maxRuleSets: Number.POSITIVE_INFINITY,
    aiSuggestions: true,
    auditExport: true,
    historyDays: 365,
    tagline: "More runs, bigger files, AI column mapping, audit export.",
    features: [
      "40 runs / month",
      "Up to 25,000 rows per side",
      "AI column-mapping suggestions (DeepSeek)",
      "Audit sheet on export",
      "Manual review for ambiguous matches",
      "Date tolerance & flip-sign options",
    ],
  },
};

export function planFromPriceId(priceId: string): PlanId {
  const starter = [
    process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_MONTH,
    process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_YEAR,
  ].filter(Boolean);
  const pro = [
    process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH,
    process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR,
  ].filter(Boolean);

  if (starter.includes(priceId)) return "starter";
  if (pro.includes(priceId)) return "pro";
  return "free";
}
