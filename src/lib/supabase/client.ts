import { createBrowserClient } from "@supabase/ssr";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/supabase/env";

export { isSupabaseConfigured };

export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in sheetdiff/.env.local, then restart npm run dev.",
    );
  }

  return createBrowserClient(getSupabaseUrl()!, getSupabasePublishableKey()!);
}
