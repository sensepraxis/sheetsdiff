/** Prefer new publishable/secret keys; fall back to legacy anon/service_role names. */

export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;
}

export function getSupabasePublishableKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    undefined
  );
}

export function getSupabaseSecretKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    undefined
  );
}

export function isSupabaseConfigured() {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  return Boolean(
    url &&
      key &&
      !url.includes("YOUR_PROJECT") &&
      key !== "your_anon_key" &&
      !key.includes("YOUR_"),
  );
}
