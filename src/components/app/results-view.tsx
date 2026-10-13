"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ReviewPanel } from "@/components/app/review-panel";
import {
  onlyInLabel,
  type SideLabels,
} from "@/constants/side-labels";
import type { DiffCandidate, MatchResult, ReconSummary } from "@/lib/recon/types";
import {
  buildTimeline,
  filterTimeline,
  rowToneClass,
  statusLabel,
  statusPillClass,
  type TimelineFilter,
  type TimelineRow,
} from "@/lib/recon/timeline";

const VIRTUAL_THRESHOLD = 200;
const ROW_HEIGHT = 48;

function filterTabs(labels: SideLabels): Array<{ id: TimelineFilter; label: string }> {
  return [
    { id: "all", label: "All" },
    { id: "problems", label: "Problems" },
    { id: "matched", label: "Matched" },
    { id: "only_a", label: onlyInLabel("a", labels) },
    { id: "only_b", label: onlyInLabel("b", labels) },
    { id: "needs_review", label: "Review" },
  ];
}

type Props = {
  results: MatchResult[];
  summary: ReconSummary;
  diffCandidates: DiffCandidate[];
  previewLimit: number | null;
  labels: SideLabels;
  onExport: () => void;
  onResultsChange: (next: MatchResult[]) => void;
};

export function ResultsView({
  results,
  summary,
  diffCandidates,
  previewLimit,
  labels,
  onExport,
  onResultsChange,
}: Props) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [problemsFirst, setProblemsFirst] = useState(true);
  const [activeProblem, setActiveProblem] = useState(0);
  const [activeReviewKey, setActiveReviewKey] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const reviewSectionRef = useRef<HTMLDivElement>(null);

  function openReview(key: string) {
    setActiveReviewKey(key);
    setFilter("needs_review");
    requestAnimationFrame(() => {
      reviewSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  const filters = useMemo(() => filterTabs(labels), [labels]);

  const timeline = useMemo(() => {
    const rows = buildTimeline(results, labels);
    if (!problemsFirst) return rows;
    return [...rows].sort((a, b) => {
      if (a.isProblem !== b.isProblem) return a.isProblem ? -1 : 1;
      const da = a.date ?? "9999-99-99";
      const db = b.date ?? "9999-99-99";
      return da.localeCompare(db);
    });
  }, [results, problemsFirst, labels]);

  const filtered = useMemo(
    () => filterTimeline(timeline, filter),
    [timeline, filter],
  );

  const displayRows =
    previewLimit != null ? filtered.slice(0, previewLimit) : filtered;

  const problemIndexes = useMemo(
    () =>
      displayRows
        .map((row, index) => (row.isProblem ? index : -1))
        .filter((index) => index >= 0),
    [displayRows],
  );

  const useVirtual = displayRows.length > VIRTUAL_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    enabled: useVirtual,
  });

  function jumpProblem(delta: number) {
    if (problemIndexes.length === 0) return;
    const next =
      (activeProblem + delta + problemIndexes.length) % problemIndexes.length;
    setActiveProblem(next);
    const rowIndex = problemIndexes[next];
    const row = displayRows[rowIndex];
    if (!row) return;

    if (useVirtual) {
      virtualizer.scrollToIndex(rowIndex, { align: "center" });
    } else {
      rowRefs.current.get(row.id)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        jumpProblem(1);
      }
      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        jumpProblem(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemIndexes, activeProblem, displayRows, useVirtual]);

  useEffect(() => {
    setActiveProblem(0);
  }, [filter, problemsFirst, results]);

  const problemCount =
    summary.onlyA + summary.onlyB + summary.needsReview;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-sm">
        <StatChip label="Matched" value={summary.matched} />
        <StatChip label={onlyInLabel("a", labels)} value={summary.onlyA} tone="danger" />
        <StatChip label={onlyInLabel("b", labels)} value={summary.onlyB} tone="danger" />
        <StatChip label="Review" value={summary.needsReview} tone="warn" />
        <StatChip label="Delta" value={`$${summary.delta}`} tone="warn" />
        <StatChip label="Match rate" value={`${summary.matchRate}%`} />
      </div>

      {diffCandidates.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--accent-soft)] p-4 text-sm">
          <p className="font-semibold text-[var(--accent)]">Diff detective</p>
          <ul className="mt-2 space-y-1 text-[var(--muted)]">
            {diffCandidates.slice(0, 5).map((c, i) => (
              <li key={`${c.kind}-${i}`}>
                {c.explanation}:{" "}
                {c.rows.map((r) => r.description || r.amount).join(" + ")} (
                {c.amount})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div ref={reviewSectionRef}>
        <ReviewPanel
          results={results}
          labels={labels}
          activeKey={activeReviewKey}
          onActiveKeyChange={setActiveReviewKey}
          onResolve={onResultsChange}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              filter === item.id
                ? "bg-[var(--ink)] text-white"
                : "border border-[var(--border)] bg-white text-[var(--muted)]"
            }`}
          >
            {item.label}
          </button>
        ))}

        <label className="ml-1 flex items-center gap-2 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={problemsFirst}
            onChange={(e) => setProblemsFirst(e.target.checked)}
          />
          Problems first
        </label>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={problemIndexes.length === 0}
            onClick={() => jumpProblem(-1)}
            className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:opacity-40"
          >
            Prev problem
          </button>
          <button
            type="button"
            disabled={problemIndexes.length === 0}
            onClick={() => jumpProblem(1)}
            className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:opacity-40"
          >
            Next problem
          </button>
          <span className="text-xs text-[var(--muted)]">
            {problemIndexes.length
              ? `${Math.min(activeProblem + 1, problemIndexes.length)}/${problemIndexes.length}`
              : "0 problems in view"}
            {" · "}
            {problemCount} total · keys J/K
          </span>
          <button
            type="button"
            onClick={onExport}
            className="rounded-full border border-[var(--border)] bg-white px-4 py-1.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--accent-soft)]"
          >
            Export XLSX
          </button>
        </div>
      </div>

      {previewLimit != null && filtered.length > previewLimit ? (
        <p className="mt-3 text-sm text-[var(--gold)]">
          Free preview shows first {previewLimit} rows.{" "}
          <Link href="/pricing" className="underline">
            Upgrade for full export
          </Link>
          .
        </p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="grid grid-cols-[100px_100px_1fr_120px_88px_110px_1.2fr] gap-2 border-b border-[var(--border)] bg-[#f7f9fc] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          <div>Date</div>
          <div>Amount</div>
          <div>Description</div>
          <div>Reference</div>
          <div>Source</div>
          <div>Status</div>
          <div>Detail</div>
        </div>

        {displayRows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            Nothing in this filter.
          </p>
        ) : useVirtual ? (
          <div
            ref={parentRef}
            className="max-h-[560px] overflow-auto"
          >
            <div
              style={{
                height: virtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = displayRows[virtualRow.index];
                return (
                  <div
                    key={row.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    role={row.reviewKey ? "button" : undefined}
                    tabIndex={row.reviewKey ? 0 : undefined}
                    onClick={() => {
                      if (row.reviewKey) openReview(row.reviewKey);
                    }}
                    onKeyDown={(e) => {
                      if (!row.reviewKey) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openReview(row.reviewKey);
                      }
                    }}
                    className={`absolute left-0 top-0 grid w-full grid-cols-[100px_100px_1fr_120px_88px_110px_1.2fr] gap-2 border-b border-[var(--border)] px-4 text-sm ${rowToneClass(row.status)} ${
                      row.reviewKey ? "cursor-pointer" : ""
                    }`}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <TimelineCells row={row} labels={labels} />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div ref={parentRef} className="max-h-[560px] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <tbody>
                {displayRows.map((row) => (
                  <tr
                    key={row.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(row.id, el);
                      else rowRefs.current.delete(row.id);
                    }}
                    onClick={() => {
                      if (row.reviewKey) openReview(row.reviewKey);
                    }}
                    className={`border-b border-[var(--border)] ${rowToneClass(row.status)} ${
                      row.reviewKey ? "cursor-pointer" : ""
                    }`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">{row.date ?? "—"}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {row.amount}
                    </td>
                    <td className="px-4 py-3">{row.description || "—"}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {row.reference || "—"}
                    </td>
                    <td className="px-4 py-3">{row.source}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusPillClass(row.status)}`}
                      >
                        {statusLabel(row.status, labels)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-[var(--muted)]">
        Red = unmatched · Amber = needs review (click to resolve) · White =
        matched. Filter &quot;Problems&quot; without leaving the full timeline.
      </p>
    </section>
  );
}

function TimelineCells({
  row,
  labels,
}: {
  row: TimelineRow;
  labels: SideLabels;
}) {
  return (
    <>
      <div className="flex items-center whitespace-nowrap">{row.date ?? "—"}</div>
      <div className="flex items-center font-medium whitespace-nowrap">
        {row.amount}
      </div>
      <div className="flex items-center truncate">{row.description || "—"}</div>
      <div className="flex items-center truncate text-[var(--muted)]">
        {row.reference || "—"}
      </div>
      <div className="flex items-center">{row.source}</div>
      <div className="flex items-center">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusPillClass(row.status)}`}
        >
          {statusLabel(row.status, labels)}
        </span>
      </div>
      <div className="flex items-center truncate text-[var(--muted)]">
        {row.detail}
      </div>
    </>
  );
}

function StatChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "danger" | "warn";
}) {
  const toneClass =
    tone === "danger"
      ? "bg-[#fef2f2] text-[#991b1b]"
      : tone === "warn"
        ? "bg-[#fffbeb] text-[#92400e]"
        : "bg-[#f8fafc] text-[var(--ink)]";

  return (
    <div className={`rounded-xl px-3 py-1.5 ${toneClass}`}>
      <span className="text-[11px] uppercase tracking-wide opacity-70">
        {label}
      </span>{" "}
      <span className="font-semibold">{value}</span>
    </div>
  );
}
