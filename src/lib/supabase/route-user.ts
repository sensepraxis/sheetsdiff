import { createClient, type User } from "@supabase/supabase-js";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
} from "@/lib/supabase/env";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

function userFromAccessToken(token: string): User | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as { sub?: string; email?: string; role?: string; exp?: number };
    if (!payload.sub) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return {
      id: payload.sub,
      email: payload.email,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "",
    } as User;
  } catch {
    return null;
  }
}

/** Resolve user from cookie session (preferred) or Bearer token. */
export async function getRouteUser(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return { user, accessToken: null as string | null, supabase };
  } catch {
    /* ignore cookie path failures */
  }

  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (token) {
    const decoded = userFromAccessToken(token);
    if (decoded) {
      return { user: decoded, accessToken: token, supabase: null };
    }

    try {
      const supabase = createClient(
        getSupabaseUrl()!,
        getSupabasePublishableKey()!,
        {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (!error && user) {
        return { user, accessToken: token, supabase };
      }
    } catch {
      /* ignore */
    }
  }

  return { user: null, accessToken: null, supabase: null };
}
