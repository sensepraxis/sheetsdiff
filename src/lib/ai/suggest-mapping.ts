import { deepseekConfigured, suggestMappingWithDeepSeek } from "@/lib/ai/deepseek";
import { suggestMappingWithOllama } from "@/lib/ai/ollama";
import type { MappingSuggestion } from "@/lib/ai/types";

export type { MappingSuggestion };

/**
 * Prefer DeepSeek when DEEPSEEK_API_KEY is set; otherwise try local Ollama.
 */
export async function suggestColumnMappingAi(input: {
  headers: string[];
  sampleRows: Record<string, string>[];
}): Promise<{ suggestions: MappingSuggestion[]; provider: "deepseek" | "ollama" } | null> {
  if (deepseekConfigured()) {
    const suggestions = await suggestMappingWithDeepSeek(input);
    if (suggestions?.length) {
      return { suggestions, provider: "deepseek" };
    }
  }

  const suggestions = await suggestMappingWithOllama(input);
  if (suggestions?.length) {
    return { suggestions, provider: "ollama" };
  }

  return null;
}
