import {
  buildMappingUserPrompt,
  MAPPING_SYSTEM,
  parseMappingJson,
  type MappingSuggestion,
} from "@/lib/ai/mapping-prompt";

export type { MappingSuggestion };

export async function suggestMappingWithOllama(input: {
  headers: string[];
  sampleRows: Record<string, string>[];
}): Promise<MappingSuggestion[] | null> {
  const base = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL ?? "qwen3:8b";

  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: MAPPING_SYSTEM },
          { role: "user", content: buildMappingUserPrompt(input) },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      message?: { content?: string };
    };
    return parseMappingJson(data.message?.content ?? "");
  } catch {
    return null;
  }
}
