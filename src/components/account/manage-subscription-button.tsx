"use client";

import { useState } from "react";
import { authFetch } from "@/lib/supabase/browser-auth";

export function ManageSubscriptionButton({
  paddleCustomerId,
}: {
  paddleCustomerId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch("/api/portal", {
        method: "POST",
        body: JSON.stringify({ paddleCustomerId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || "Not authorized");
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open portal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onClick()}
        className="rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Opening…" : "Manage subscription"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
