import { NextResponse } from "next/server";
import { deepseekConfigured } from "@/lib/ai/deepseek";
import { suggestColumnMappingAi } from "@/lib/ai/suggest-mapping";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRouteUser } from "@/lib/supabase/route-user";

export async function POST(request: Request) {
  const { user } = await getRouteUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.plan !== "pro") {
    return NextResponse.json(
      { error: "AI suggestions require Pro." },
      { status: 402 },
    );
  }

  const body = (await request.json()) as {
    headers?: string[];
    sampleRows?: Record<string, string>[];
  };

  if (!body.headers?.length) {
    return NextResponse.json({ error: "headers required" }, { status: 400 });
  }

  const result = await suggestColumnMappingAi({
    headers: body.headers,
    sampleRows: body.sampleRows ?? [],
  });

  if (!result) {
    const hint = deepseekConfigured()
      ? "DeepSeek request failed. Check DEEPSEEK_API_KEY / network, or set up local Ollama as fallback."
      : "No AI provider available. Set DEEPSEEK_API_KEY in .env.local, or run Ollama locally.";
    return NextResponse.json({ error: hint }, { status: 503 });
  }

  return NextResponse.json({
    suggestions: result.suggestions,
    provider: result.provider,
  });
}
