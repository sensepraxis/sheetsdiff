import {
  buildMappingUserPrompt,
  MAPPING_SYSTEM,
  parseMappingJson,
  type MappingSuggestion,
} from "@/lib/ai/mapping-prompt";

/**
 * DeepSeek Chat — OpenAI-compatible API.
 * Docs: https://api-docs.deepseek.com/
 */
export async function suggestMappingWithDeepSeek(input: {
  headers: string[];
  sampleRows: Record<string, string>[];
}): Promise<MappingSuggestion[] | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return null;

  const base = (
    process.env.DEEPSEEK_API_BASE ?? "https://api.deepseek.com"
  ).replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

  try {
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          { role: "system", content: MAPPING_SYSTEM },
          {
            role: "user",
            content: `${buildMappingUserPrompt(input)}

Reply with json only: either a raw JSON array, or {"mappings":[...]} .`,
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[deepseek]", res.status, text.slice(0, 300));
      return null;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return parseMappingJson(content);
  } catch (err) {
    console.error("[deepseek] request failed", err);
    return null;
  }
}

export function deepseekConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}
