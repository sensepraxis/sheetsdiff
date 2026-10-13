import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
} from "@/lib/supabase/env";

const REFRESH_TIMEOUT_MS = 2500;

/**
 * Refresh the auth cookie session on each request.
 * Hard redirects stay in page/server components; this only syncs cookies.
 * Timeout avoids hanging the whole app when Node → supabase.co is slow.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  if (
    path.startsWith("/auth/callback") ||
    path.startsWith("/api/webhook") ||
    path.startsWith("/_next")
  ) {
    return supabaseResponse;
  }

  const url = getSupabaseUrl();
  const anon = getSupabasePublishableKey();
  if (!url || !anon) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  try {
    await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("auth refresh timeout")), REFRESH_TIMEOUT_MS),
      ),
    ]);
  } catch {
    /* network / timeout — keep existing cookies */
  }

  return supabaseResponse;
}
