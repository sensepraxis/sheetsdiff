import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/supabase/env";

let authClient: SupabaseClient | null = null;

/**
 * Browser auth uses localStorage so PKCE survives the Google redirect.
 * After login, call syncSessionToCookies() so SSR/middleware can read Cookie session.
 */
export function createAuthClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  if (authClient) return authClient;

  authClient = createClient(getSupabaseUrl()!, getSupabasePublishableKey()!, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    },
  });

  return authClient;
}

/** Write tokens into HttpOnly-friendly auth cookies for server components. */
export async function syncSessionToCookies(session: Session) {
  const res = await fetch("/api/auth/set-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || "Failed to sync session cookie");
  }
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const supabase = createAuthClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(input, { ...init, headers, credentials: "include" });
}
