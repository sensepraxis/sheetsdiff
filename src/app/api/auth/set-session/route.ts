import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
} from "@/lib/supabase/env";

/**
 * Accept browser tokens (from localStorage PKCE login) and persist them
 * as Supabase SSR cookies for server components / middleware.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
  } | null;

  if (!body?.access_token || !body?.refresh_token) {
    return NextResponse.json({ error: "Missing tokens" }, { status: 400 });
  }

  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.setSession({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return response;
}
