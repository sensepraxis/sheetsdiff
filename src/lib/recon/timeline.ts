import { reviewKey } from "@/lib/recon/review";
import type { MatchResult } from "@/lib/recon/types";
import {
  DEFAULT_SIDE_LABELS,
  onlyInLabel,
  type SideLabels,
} from "@/constants/side-labels";

export type TimelineStatus =
  | "matched"
  | "only_a"
  | "only_b"
  | "needs_review";

export type TimelineFilter =
  | "all"
  | "problems"
  | "matched"
  | "only_a"
  | "only_b"
  | "needs_review";

export type TimelineRow = {
  id: string;
  date: string | null;
  amount: string;
  description: string;
  reference: string;
  source: string;
  status: TimelineStatus;
  detail: string;
  isProblem: boolean;
  /** Present when status is needs_review — used to open Manual review. */
  reviewKey?: string;
};

export function statusLabel(
  status: TimelineStatus,
  labels: SideLabels = DEFAULT_SIDE_LABELS,
): string {
  switch (status) {
    case "matched":
      return "Matched";
    case "only_a":
      return onlyInLabel("a", labels);
    case "only_b":
      return onlyInLabel("b", labels);
    case "needs_review":
      return "Needs review";
  }
}

export function buildTimeline(
  results: MatchResult[],
  labels: SideLabels = DEFAULT_SIDE_LABELS,
): TimelineRow[] {
  const rows: TimelineRow[] = [];

  results.forEach((result) => {
    if (result.status === "matched") {
      rows.push({
        id: `matched-${result.a.rowId}-${result.b.rowId}`,
        date: result.a.date ?? result.b.date,
        amount: result.a.amount,
        description: result.a.description || result.b.description,
        reference: result.a.reference || result.b.reference,
        source: "Both",
        status: "matched",
        detail: `↔ ${result.b.description || result.b.amount} · ${result.matchType}`,
        isProblem: false,
      });
      return;
    }

    if (result.status === "needs_review") {
      const sample = result.candidatesA[0] ?? result.candidatesB[0];
      const key = reviewKey(result);
      rows.push({
        id: `review-${key}`,
        date: sample?.date ?? null,
        amount: sample?.amount ?? "—",
        description: result.explanation,
        reference: sample?.reference ?? "",
        source: "Both",
        status: "needs_review",
        detail: `A:${result.candidatesA.length} / B:${result.candidatesB.length} · click to review`,
        isProblem: true,
        reviewKey: key,
      });
      return;
    }

    rows.push({
      id: `${result.status}-${result.row.rowId}`,
      date: result.row.date,
      amount: result.row.amount,
      description: result.row.description,
      reference: result.row.reference,
      source: result.status === "only_a" ? labels.a : labels.b,
      status: result.status,
      detail: statusLabel(result.status, labels),
      isProblem: true,
    });
  });

  return rows.sort((a, b) => {
    const da = a.date ?? "9999-99-99";
    const db = b.date ?? "9999-99-99";
    if (da !== db) return da.localeCompare(db);
    if (a.isProblem !== b.isProblem) return a.isProblem ? -1 : 1;
    return a.amount.localeCompare(b.amount);
  });
}

export function filterTimeline(
  rows: TimelineRow[],
  filter: TimelineFilter,
): TimelineRow[] {
  switch (filter) {
    case "all":
      return rows;
    case "problems":
      return rows.filter((r) => r.isProblem);
    case "matched":
      return rows.filter((r) => r.status === "matched");
    case "only_a":
      return rows.filter((r) => r.status === "only_a");
    case "only_b":
      return rows.filter((r) => r.status === "only_b");
    case "needs_review":
      return rows.filter((r) => r.status === "needs_review");
  }
}

export function rowToneClass(status: TimelineStatus): string {
  switch (status) {
    case "matched":
      return "bg-white hover:bg-[#f8fafc]";
    case "only_a":
    case "only_b":
      return "bg-[#fef2f2]";
    case "needs_review":
      return "bg-[#fffbeb]";
  }
}

export function statusPillClass(status: TimelineStatus): string {
  switch (status) {
    case "matched":
      return "bg-[#e2e8f0] text-[#334155]";
    case "only_a":
    case "only_b":
      return "bg-[#fecaca] text-[#991b1b]";
    case "needs_review":
      return "bg-[#fde68a] text-[#92400e]";
  }
}
