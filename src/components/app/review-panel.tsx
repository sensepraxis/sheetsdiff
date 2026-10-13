"use client";

import { useEffect, useMemo, useState } from "react";
import type { SideLabels } from "@/constants/side-labels";
import type { MatchResult } from "@/lib/recon/types";
import {
  dismissReview,
  formatCandidateLine,
  listReviewCases,
  resolveReviewMatch,
  type ReviewCase,
} from "@/lib/recon/review";

type Props = {
  results: MatchResult[];
  labels: SideLabels;
  onResolve: (next: MatchResult[]) => void;
  activeKey?: string | null;
  onActiveKeyChange?: (key: string | null) => void;
};

function autoPicks(item: ReviewCase | null): {
  a: string | null;
  b: string | null;
} {
  if (!item) return { a: null, b: null };
  return {
    a: item.candidatesA.length === 1 ? item.candidatesA[0].rowId : null,
    b: item.candidatesB.length === 1 ? item.candidatesB[0].rowId : null,
  };
}

export function ReviewPanel({
  results,
  labels,
  onResolve,
  activeKey,
  onActiveKeyChange,
}: Props) {
  const cases = useMemo(() => listReviewCases(results), [results]);
  const [pickA, setPickA] = useState<string | null>(null);
  const [pickB, setPickB] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedKey = activeKey ?? cases[0]?.key ?? null;
  const current = cases.find((c) => c.key === selectedKey)?.item ?? null;

  // When a side has exactly one candidate, select it automatically.
  useEffect(() => {
    const next = autoPicks(current);
    setPickA(next.a);
    setPickB(next.b);
    setError(null);
  }, [selectedKey, current]);

  function selectCase(key: string) {
    setError(null);
    onActiveKeyChange?.(key);
  }

  function confirm() {
    if (!selectedKey || !pickA || !pickB) {
      setError(
        `Select one ${labels.a} row and one ${labels.b} row, then Confirm match.`,
      );
      return;
    }
    const next = resolveReviewMatch(results, selectedKey, pickA, pickB);
    if ("error" in next) {
      setError(next.error);
      return;
    }
    setPickA(null);
    setPickB(null);
    setError(null);
    onResolve(next);
  }

  function dismiss() {
    if (!selectedKey) return;
    const next = dismissReview(results, selectedKey);
    if ("error" in next) {
      setError(next.error);
      return;
    }
    setPickA(null);
    setPickB(null);
    setError(null);
    onResolve(next);
  }

  if (cases.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-[#fffbeb] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[#92400e]">Manual review</p>
          <p className="mt-1 text-sm text-[#a16207]">
            Same amount matched more than one row. Pick the correct {labels.a} ↔{" "}
            {labels.b} pair, or leave them unmatched.
          </p>
        </div>
        <span className="rounded-full bg-[#fde68a] px-3 py-1 text-xs font-semibold text-[#92400e]">
          {cases.length} open
        </span>
      </div>

      {cases.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {cases.map((c, i) => (
            <button
              key={c.key}
              type="button"
              onClick={() => selectCase(c.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                c.key === selectedKey
                  ? "bg-[var(--ink)] text-white"
                  : "border border-amber-300 bg-white text-[#92400e]"
              }`}
            >
              Case {i + 1}
            </button>
          ))}
        </div>
      ) : null}

      {current ? (
        <ReviewCaseBody
          item={current}
          labels={labels}
          pickA={pickA}
          pickB={pickB}
          onPickA={setPickA}
          onPickB={setPickB}
        />
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={!pickA || !pickB}
          className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Confirm match
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-[#92400e] hover:bg-amber-50"
        >
          Leave unmatched
        </button>
      </div>
    </div>
  );
}

function ReviewCaseBody({
  item,
  labels,
  pickA,
  pickB,
  onPickA,
  onPickB,
}: {
  item: ReviewCase;
  labels: SideLabels;
  pickA: string | null;
  pickB: string | null;
  onPickA: (id: string) => void;
  onPickB: (id: string) => void;
}) {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <CandidateList
        title={`${labels.a} (File A) — click to select`}
        rows={item.candidatesA}
        selectedId={pickA}
        onSelect={onPickA}
      />
      <CandidateList
        title={`${labels.b} (File B) — click to select`}
        rows={item.candidatesB}
        selectedId={pickB}
        onSelect={onPickB}
      />
      <p className="md:col-span-2 text-xs text-[#a16207]">
        {item.explanation}
        {!pickA || !pickB
          ? " · Select one row on each side to enable Confirm match."
          : null}
      </p>
    </div>
  );
}

function CandidateList({
  title,
  rows,
  selectedId,
  onSelect,
}: {
  title: string;
  rows: ReviewCase["candidatesA"];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#92400e]">
        {title}
      </p>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => {
          const selected = selectedId === row.rowId;
          return (
            <li key={row.rowId}>
              <button
                type="button"
                onClick={() => onSelect(row.rowId)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                  selected
                    ? "border-[var(--accent)] bg-white ring-2 ring-[var(--accent)]/30"
                    : "border-amber-200/80 bg-white/80 hover:border-amber-400"
                }`}
              >
                {formatCandidateLine(row)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
