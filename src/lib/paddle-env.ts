import type { Environments } from "@paddle/paddle-js";

function looksLikePlaceholder(value: string | undefined | null): boolean {
  if (!value) return true;
  const v = value.trim();
  if (!v) return true;
  return (
    v.includes("...") ||
    v.includes("YOUR_") ||
    v === "test_" ||
    /^pri_\.+$/.test(v) ||
    /^pri_\.\.\./.test(v) ||
    v.length < 16
  );
}

export function getPaddleClientToken(): string {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  if (!token) {
    throw new Error(
      "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is unset. Add a sandbox client token (test_…) to .env.local.",
    );
  }
  return token;
}

export function getPaddleEnvironment(): Environments {
  const env = process.env.NEXT_PUBLIC_PADDLE_ENV;
  if (!env) {
    throw new Error('NEXT_PUBLIC_PADDLE_ENV must be "sandbox" or "production".');
  }
  if (env !== "sandbox" && env !== "production") {
    throw new Error(`NEXT_PUBLIC_PADDLE_ENV invalid: "${env}".`);
  }
  return env;
}

export function paddleConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN &&
      process.env.NEXT_PUBLIC_PADDLE_ENV,
  );
}

/** True when .env still has stub values like test_... / pri_... */
export function paddleReadyForCheckout(): boolean {
  if (!paddleConfigured()) return false;
  if (looksLikePlaceholder(process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN)) {
    return false;
  }
  const priceIds = [
    process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_MONTH,
    process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_YEAR,
    process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH,
    process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR,
  ];
  return priceIds.every((id) => !looksLikePlaceholder(id));
}
