import type { MatchResult, ReconSummary, TransactionRow } from "@/lib/recon/types";

export type ReviewCase = Extract<MatchResult, { status: "needs_review" }>;

export function reviewKey(item: ReviewCase): string {
  const a = item.candidatesA.map((r) => r.rowId).slice().sort().join(",");
  const b = item.candidatesB.map((r) => r.rowId).slice().sort().join(",");
  return `r:${a}|${b}`;
}

export function listReviewCases(results: MatchResult[]): Array<{
  key: string;
  item: ReviewCase;
}> {
  return results
    .filter((r): r is ReviewCase => r.status === "needs_review")
    .map((item) => ({ key: reviewKey(item), item }));
}

export function recomputeSummary(
  results: MatchResult[],
  base: Pick<ReconSummary, "countA" | "countB" | "sumA" | "sumB" | "delta">,
): ReconSummary {
  const matched = results.filter((r) => r.status === "matched").length;
  const onlyA = results.filter((r) => r.status === "only_a").length;
  const onlyB = results.filter((r) => r.status === "only_b").length;
  const needsReview = results.filter((r) => r.status === "needs_review").length;
  const total = base.countA + base.countB;

  return {
    ...base,
    matched,
    onlyA,
    onlyB,
    needsReview,
    matchRate: total === 0 ? 0 : Math.round((matched * 2 * 100) / total),
  };
}

function findReview(
  results: MatchResult[],
  key: string,
): { index: number; item: ReviewCase } | null {
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "needs_review" && reviewKey(r) === key) {
      return { index: i, item: r };
    }
  }
  return null;
}

/**
 * Confirm one Side A row ↔ one Side B row from a needs_review case.
 * Leftover candidates become only_a / only_b.
 */
export function resolveReviewMatch(
  results: MatchResult[],
  key: string,
  aRowId: string,
  bRowId: string,
): MatchResult[] | { error: string } {
  const found = findReview(results, key);
  if (!found) return { error: "Review case no longer exists." };

  const a = found.item.candidatesA.find((r) => r.rowId === aRowId);
  const b = found.item.candidatesB.find((r) => r.rowId === bRowId);
  if (!a || !b) {
    return { error: "Pick one row from each side, then confirm." };
  }

  const leftoversA = found.item.candidatesA.filter((r) => r.rowId !== aRowId);
  const leftoversB = found.item.candidatesB.filter((r) => r.rowId !== bRowId);

  const next: MatchResult[] = [];
  for (let i = 0; i < results.length; i++) {
    if (i === found.index) {
      next.push({
        status: "matched",
        a,
        b,
        matchType: "manual",
        confidence: 1,
        explanation: "Manually confirmed in review",
      });
      for (const row of leftoversA) next.push({ status: "only_a", row });
      for (const row of leftoversB) next.push({ status: "only_b", row });
      continue;
    }
    next.push(results[i]);
  }
  return next;
}

/** Mark all candidates in a review case as unmatched (no pair). */
export function dismissReview(
  results: MatchResult[],
  key: string,
): MatchResult[] | { error: string } {
  const found = findReview(results, key);
  if (!found) return { error: "Review case no longer exists." };

  const next: MatchResult[] = [];
  for (let i = 0; i < results.length; i++) {
    if (i === found.index) {
      for (const row of found.item.candidatesA) {
        next.push({ status: "only_a", row });
      }
      for (const row of found.item.candidatesB) {
        next.push({ status: "only_b", row });
      }
      continue;
    }
    next.push(results[i]);
  }
  return next;
}

export function formatCandidateLine(row: TransactionRow): string {
  const bits = [
    row.date ?? "no date",
    `$${row.amount}`,
    row.reference || null,
    row.description || null,
  ].filter(Boolean);
  return bits.join(" · ");
}
