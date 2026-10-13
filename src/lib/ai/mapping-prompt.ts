import type { MappingSuggestion } from "@/lib/ai/types";

export type { MappingSuggestion } from "@/lib/ai/types";

export const MAPPING_SYSTEM =
  "You are a careful spreadsheet mapping assistant for reconciliation. Never invent headers. Return JSON only.";

export function buildMappingUserPrompt(input: {
  headers: string[];
  sampleRows: Record<string, string>[];
}): string {
  return `Map spreadsheet columns for two-sheet reconciliation.
Return ONLY a valid JSON array. Each item: {"header":"...","role":"date|amount|debit|credit|reference|description|ignore","reason":"..."}.
Use each role at most once except ignore. Headers must come from the list below.
Headers: ${JSON.stringify(input.headers)}
Sample rows: ${JSON.stringify(input.sampleRows.slice(0, 3))}`;
}

export function parseMappingJson(content: string): MappingSuggestion[] | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  // Model may wrap JSON in markdown fences.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1]?.trim() ?? trimmed;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as MappingSuggestion[];
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { mappings?: unknown }).mappings)
    ) {
      return (parsed as { mappings: MappingSuggestion[] }).mappings;
    }
    return null;
  } catch {
    return null;
  }
}
