"use client";

import {
  type Paddle,
  type PricePreviewParams,
  type PricePreviewResponse,
} from "@paddle/paddle-js";
import { useEffect, useRef, useState } from "react";
import { PricingTier } from "@/constants/pricing-tier";
import { UNKNOWN_COUNTRY } from "@/lib/country";

export type PaddlePrices = Record<string, string>;

function getLineItems(): PricePreviewParams["items"] {
  return PricingTier.flatMap((tier) =>
    [tier.priceId.month, tier.priceId.year]
      .filter((id): id is string => Boolean(id))
      .map((priceId) => ({ priceId, quantity: 1 })),
  );
}

function getPriceAmounts(prices: PricePreviewResponse): PaddlePrices {
  return prices.data.details.lineItems.reduce<PaddlePrices>((acc, item) => {
    acc[item.price.id] = item.formattedTotals.total;
    return acc;
  }, {});
}

export function usePaddlePrices(
  paddle: Paddle | undefined,
  country: string,
): { prices: PaddlePrices; loading: boolean; error: string | null } {
  const [prices, setPrices] = useState<PaddlePrices>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!paddle) {
      setLoading(false);
      return;
    }

    const items = getLineItems();
    if (items.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const params: Partial<PricePreviewParams> = {
      items,
      ...(country !== UNKNOWN_COUNTRY && {
        address: { countryCode: country },
      }),
    };

    if (!hasLoadedRef.current) setLoading(true);
    setError(null);

    paddle
      .PricePreview(params as PricePreviewParams)
      .then((response) => {
        if (cancelled) return;
        setPrices((prev) => ({ ...prev, ...getPriceAmounts(response) }));
        hasLoadedRef.current = true;
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load prices");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [country, paddle]);

  return { prices, loading, error };
}
