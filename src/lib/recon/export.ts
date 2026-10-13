import * as XLSX from "xlsx";
import {
  DEFAULT_SIDE_LABELS,
  onlyInLabel,
  type SideLabels,
} from "@/constants/side-labels";
import type { MatchResult, ReconSummary } from "@/lib/recon/types";

function sheetName(raw: string): string {
  const cleaned = raw.replace(/[\\/?*[\]]/g, "").trim() || "Sheet";
  return cleaned.slice(0, 31);
}

export function buildExportWorkbook(
  results: MatchResult[],
  summary: ReconSummary,
  options?: { audit?: boolean; labels?: SideLabels },
): ArrayBuffer {
  const labels = options?.labels ?? DEFAULT_SIDE_LABELS;
  const matched = results
    .filter((r) => r.status === "matched")
    .map((r) => {
      if (r.status !== "matched") return {};
      return {
        "A Date": r.a.date ?? "",
        "A Amount": r.a.amount,
        "A Description": r.a.description,
        "A Reference": r.a.reference,
        "B Date": r.b.date ?? "",
        "B Amount": r.b.amount,
        "B Description": r.b.description,
        "B Reference": r.b.reference,
        Match: r.matchType,
      };
    });

  const onlyA = results
    .filter((r) => r.status === "only_a")
    .map((r) =>
      r.status === "only_a"
        ? {
            Date: r.row.date ?? "",
            Amount: r.row.amount,
            Description: r.row.description,
            Reference: r.row.reference,
          }
        : {},
    );

  const onlyB = results
    .filter((r) => r.status === "only_b")
    .map((r) =>
      r.status === "only_b"
        ? {
            Date: r.row.date ?? "",
            Amount: r.row.amount,
            Description: r.row.description,
            Reference: r.row.reference,
          }
        : {},
    );

  const summaryRows = [
    { Metric: `Rows ${labels.a}`, Value: summary.countA },
    { Metric: `Rows ${labels.b}`, Value: summary.countB },
    { Metric: "Matched pairs", Value: summary.matched },
    { Metric: onlyInLabel("a", labels), Value: summary.onlyA },
    { Metric: onlyInLabel("b", labels), Value: summary.onlyB },
    { Metric: "Needs review", Value: summary.needsReview },
    { Metric: `Sum ${labels.a}`, Value: summary.sumA },
    { Metric: `Sum ${labels.b}`, Value: summary.sumB },
    { Metric: `Delta (${labels.a}-${labels.b})`, Value: summary.delta },
    { Metric: "Match rate %", Value: summary.matchRate },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matched), "Matched");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(onlyA),
    sheetName(onlyInLabel("a", labels)),
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(onlyB),
    sheetName(onlyInLabel("b", labels)),
  );

  if (options?.audit) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          Note: "SheetDiff audit export",
          GeneratedAt: new Date().toISOString(),
          Method: "Deterministic match: reference+amount, then amount+date. No silent 1:N pairing.",
        },
      ]),
      "Audit",
    );
  }

  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

export function downloadArrayBuffer(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
