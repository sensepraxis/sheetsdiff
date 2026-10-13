import Decimal from "decimal.js";
import type {
  DiffCandidate,
  MatchResult,
  ReconOptions,
  ReconSummary,
  TransactionRow,
} from "@/lib/recon/types";

function dayDiff(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.abs(Math.round((da - db) / 86_400_000));
}

function sumAmounts(rows: TransactionRow[]): Decimal {
  return rows.reduce((acc, r) => acc.plus(r.amount), new Decimal(0));
}

function refAmountKey(reference: string, amount: string): string {
  return `${reference}\0${amount}`;
}

function pushIndex(
  map: Map<string, TransactionRow[]>,
  key: string,
  row: TransactionRow,
) {
  const list = map.get(key);
  if (list) list.push(row);
  else map.set(key, [row]);
}

/**
 * Deterministic recon. Indexes by reference+amount / amount so large files
 * stay near O(n) instead of scanning the full B side for every A row.
 */
export function runMatch(
  sideA: TransactionRow[],
  sideB: TransactionRow[],
  options: ReconOptions,
): { results: MatchResult[]; summary: ReconSummary; diffCandidates: DiffCandidate[] } {
  const poolA = sideA;
  const poolB = sideB;
  const results: MatchResult[] = [];
  const usedA = new Set<string>();
  const usedB = new Set<string>();

  const byRefAmount = new Map<string, TransactionRow[]>();
  const byAmount = new Map<string, TransactionRow[]>();
  for (const b of poolB) {
    pushIndex(byAmount, b.amount, b);
    if (b.reference) {
      pushIndex(byRefAmount, refAmountKey(b.reference, b.amount), b);
    }
  }

  // Pass 1: reference + amount
  for (const a of poolA) {
    if (!a.reference) continue;
    const bucket = byRefAmount.get(refAmountKey(a.reference, a.amount)) ?? [];
    const candidates = bucket.filter((b) => !usedB.has(b.rowId));
    if (candidates.length === 1) {
      const b = candidates[0];
      usedA.add(a.rowId);
      usedB.add(b.rowId);
      results.push({
        status: "matched",
        a,
        b,
        matchType: "reference+amount",
        confidence: 0.98,
        explanation: "Same reference and amount",
      });
    } else if (candidates.length > 1) {
      usedA.add(a.rowId);
      candidates.forEach((c) => usedB.add(c.rowId));
      results.push({
        status: "needs_review",
        candidatesA: [a],
        candidatesB: candidates,
        explanation: "Multiple B rows share the same reference + amount",
      });
    }
  }

  // Pass 2: amount + date tolerance (1:1 only)
  for (const a of poolA) {
    if (usedA.has(a.rowId)) continue;
    const bucket = byAmount.get(a.amount) ?? [];
    const candidates = bucket.filter((b) => {
      if (usedB.has(b.rowId)) return false;
      const diff = dayDiff(a.date, b.date);
      if (diff == null) return false;
      return diff <= options.dateToleranceDays;
    });

    if (candidates.length === 1) {
      const b = candidates[0];
      usedA.add(a.rowId);
      usedB.add(b.rowId);
      results.push({
        status: "matched",
        a,
        b,
        matchType: "amount+date",
        confidence: 0.9,
        explanation: `Same amount within ${options.dateToleranceDays} day(s)`,
      });
    } else if (candidates.length > 1) {
      usedA.add(a.rowId);
      candidates.forEach((c) => usedB.add(c.rowId));
      results.push({
        status: "needs_review",
        candidatesA: [a],
        candidatesB: candidates,
        explanation: "Same amount on multiple dates — needs review",
      });
    }
  }

  for (const a of poolA) {
    if (!usedA.has(a.rowId)) {
      results.push({ status: "only_a", row: a });
    }
  }
  for (const b of poolB) {
    if (!usedB.has(b.rowId)) {
      results.push({ status: "only_b", row: b });
    }
  }

  const matched = results.filter((r) => r.status === "matched").length;
  const onlyA = results.filter((r) => r.status === "only_a").length;
  const onlyB = results.filter((r) => r.status === "only_b").length;
  const needsReview = results.filter((r) => r.status === "needs_review").length;
  const sumA = sumAmounts(sideA);
  const sumB = sumAmounts(sideB);
  const delta = sumA.minus(sumB);

  const summary: ReconSummary = {
    countA: sideA.length,
    countB: sideB.length,
    matched,
    onlyA,
    onlyB,
    needsReview,
    sumA: sumA.toFixed(2),
    sumB: sumB.toFixed(2),
    delta: delta.toFixed(2),
    matchRate:
      sideA.length + sideB.length === 0
        ? 0
        : Math.round((matched * 2 * 100) / (sideA.length + sideB.length)),
  };

  const unmatchedA = results
    .filter((r): r is Extract<MatchResult, { status: "only_a" }> => r.status === "only_a")
    .map((r) => r.row);
  const unmatchedB = results
    .filter((r): r is Extract<MatchResult, { status: "only_b" }> => r.status === "only_b")
    .map((r) => r.row);

  return {
    results,
    summary,
    diffCandidates: findDiffCandidates(unmatchedA, unmatchedB, delta),
  };
}

function findDiffCandidates(
  onlyA: TransactionRow[],
  onlyB: TransactionRow[],
  delta: Decimal,
): DiffCandidate[] {
  if (delta.isZero()) return [];
  const abs = delta.abs();
  const candidates: DiffCandidate[] = [];

  for (const row of onlyA) {
    if (new Decimal(row.amount).abs().equals(abs)) {
      candidates.push({
        kind: "single_a",
        amount: row.amount,
        rows: [row],
        explanation: "This A-only row equals the total difference",
      });
    }
  }
  for (const row of onlyB) {
    if (new Decimal(row.amount).abs().equals(abs)) {
      candidates.push({
        kind: "single_b",
        amount: row.amount,
        rows: [row],
        explanation: "This B-only row equals the total difference",
      });
    }
  }

  // Two-row combinations (bounded — O(k²) with k≤40)
  const scan = (rows: TransactionRow[], kind: DiffCandidate["kind"]) => {
    const limit = Math.min(rows.length, 40);
    for (let i = 0; i < limit; i++) {
      for (let j = i + 1; j < limit; j++) {
        const sum = new Decimal(rows[i].amount).plus(rows[j].amount);
        if (sum.abs().equals(abs)) {
          candidates.push({
            kind,
            amount: sum.toFixed(2),
            rows: [rows[i], rows[j]],
            explanation: "These two rows sum to the total difference",
          });
          if (candidates.length > 12) return;
        }
      }
    }
  };
  scan(onlyA, "pair_a");
  scan(onlyB, "pair_b");

  return candidates.slice(0, 12);
}
