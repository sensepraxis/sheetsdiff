import { PLANS, type PlanId } from "@/constants/plans";

export type BillingFrequency = "month" | "year";

export type Tier = {
  id: Exclude<PlanId, "free"> | "free";
  name: string;
  description: string;
  features: string[];
  featured?: boolean;
  /** null = free CTA, no Paddle checkout */
  priceId: { month: string | null; year: string | null };
  displayPrice: { month: string; year: string };
};

export const PricingTier: Tier[] = [
  {
    id: "free",
    name: PLANS.free.name,
    description: PLANS.free.tagline,
    features: PLANS.free.features,
    priceId: { month: null, year: null },
    displayPrice: { month: "$0", year: "$0" },
  },
  {
    id: "starter",
    name: PLANS.starter.name,
    description: PLANS.starter.tagline,
    features: PLANS.starter.features,
    priceId: {
      month: process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_MONTH ?? null,
      year: process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_YEAR ?? null,
    },
    displayPrice: { month: "$9.9", year: "$99" },
  },
  {
    id: "pro",
    name: PLANS.pro.name,
    description: PLANS.pro.tagline,
    features: PLANS.pro.features,
    featured: true,
    priceId: {
      month: process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH ?? null,
      year: process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR ?? null,
    },
    displayPrice: { month: "$29.9", year: "$299" },
  },
];
