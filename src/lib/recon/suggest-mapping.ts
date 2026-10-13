import type { ColumnMapping, ColumnRole } from "@/lib/recon/types";

const RULES: Array<{ role: ColumnRole; patterns: RegExp[] }> = [
  {
    role: "date",
    patterns: [/date/i, /posted/i, /trans(?:action)?\s*date/i, /日期|记账日/],
  },
  {
    role: "amount",
    patterns: [/^amount$/i, /amt/i, /value/i, /金额|数额|发生额/],
  },
  {
    role: "debit",
    patterns: [/debit/i, /withdrawal/i, /outflow/i, /借方|支出/],
  },
  {
    role: "credit",
    patterns: [/credit/i, /deposit/i, /inflow/i, /贷方|收入/],
  },
  {
    role: "reference",
    patterns: [/ref/i, /check\s*#?/i, /txn|trans(?:action)?\s*id/i, /单号|流水号|凭证/],
  },
  {
    role: "description",
    patterns: [/desc/i, /memo/i, /narration/i, /payee/i, /摘要|备注|说明/],
  },
];

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<ColumnRole>();

  for (const header of headers) {
    let assigned: ColumnRole = "ignore";
    for (const rule of RULES) {
      if (used.has(rule.role) && rule.role !== "ignore") continue;
      if (rule.patterns.some((re) => re.test(header))) {
        assigned = rule.role;
        used.add(rule.role);
        break;
      }
    }
    mapping[header] = assigned;
  }

  // Prefer a single amount column when both debit/credit are missing amount.
  const roles = Object.values(mapping);
  if (!roles.includes("amount") && !roles.includes("debit") && !roles.includes("credit")) {
    const amountish = headers.find((h) => /money|usd|balance/i.test(h));
    if (amountish) mapping[amountish] = "amount";
  }

  return mapping;
}

export function mappingIsValid(mapping: ColumnMapping): boolean {
  const roles = Object.values(mapping);
  const hasDate = roles.includes("date");
  const hasAmount = roles.includes("amount");
  const hasSplit = roles.includes("debit") && roles.includes("credit");
  return hasDate && (hasAmount || hasSplit);
}
