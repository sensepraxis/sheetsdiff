"use client";

import { useState } from "react";
import Link from "next/link";
import type * as XLSX from "xlsx";
import { PLANS, type PlanId } from "@/constants/plans";
import {
  DEFAULT_SIDE_LABELS,
  SIDE_LABEL_PRESETS,
  fileCardTitle,
  type SideLabels,
} from "@/constants/side-labels";
import { ResultsView } from "@/components/app/results-view";
import { SheetPicker } from "@/components/app/sheet-picker";
import {
  buildExportWorkbook,
  downloadArrayBuffer,
} from "@/lib/recon/export";
import { runMatch } from "@/lib/recon/match";
import { normalizeSheet } from "@/lib/recon/normalize";
import { recomputeSummary } from "@/lib/recon/review";
import {
  inspectSpreadsheetFile,
  parseSheetFromWorkbook,
  parseSpreadsheetFile,
} from "@/lib/recon/parse";
import {
  mappingIsValid,
  suggestColumnMapping,
} from "@/lib/recon/suggest-mapping";
import { authFetch, createAuthClient } from "@/lib/supabase/browser-auth";
import type {
  ColumnMapping,
  ColumnRole,
  DiffCandidate,
  MatchResult,
  ParsedSheet,
  ReconSummary,
} from "@/lib/recon/types";

type ProfileInfo = {
  plan: PlanId;
  lifetime_runs_used: number;
  monthly_runs_used: number;
  full_name: string | null;
};

const ROLES: ColumnRole[] = [
  "date",
  "amount",
  "debit",
  "credit",
  "reference",
  "description",
  "ignore",
];

type SheetPickState = {
  side: "A" | "B";
  fileName: string;
  workbook: XLSX.WorkBook;
  previews: Array<{
    name: string;
    rowCount: number;
    headers: string[];
    sampleRows: string[][];
    looksTransactional: boolean;
  }>;
};

export function Workspace({ profile }: { profile: ProfileInfo }) {
  const plan = PLANS[profile.plan] ?? PLANS.free;
  const [sheetA, setSheetA] = useState<ParsedSheet | null>(null);
  const [sheetB, setSheetB] = useState<ParsedSheet | null>(null);
  const [mapA, setMapA] = useState<ColumnMapping>({});
  const [mapB, setMapB] = useState<ColumnMapping>({});
  const [flipSignOnB, setFlipSignOnB] = useState(false);
  const [dateToleranceDays, setDateToleranceDays] = useState(1);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Working…");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [summary, setSummary] = useState<ReconSummary | null>(null);
  const [diffCandidates, setDiffCandidates] = useState<DiffCandidate[]>([]);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [sheetPick, setSheetPick] = useState<SheetPickState | null>(null);
  const [sideLabels, setSideLabels] = useState<SideLabels>(DEFAULT_SIDE_LABELS);

  const previewLimit = plan.previewRows;

  function setLabel(side: "a" | "b", value: string) {
    setSideLabels((prev) => ({ ...prev, [side]: value.slice(0, 24) }));
  }

  function commitLabel(side: "a" | "b") {
    setSideLabels((prev) => {
      const raw = prev[side].trim();
      return {
        ...prev,
        [side]: raw || (side === "a" ? "Side A" : "Side B"),
      };
    });
  }

  function applyParsed(side: "A" | "B", parsed: ParsedSheet) {
    const mapping = suggestColumnMapping(parsed.headers);
    if (side === "A") {
      setSheetA(parsed);
      setMapA(mapping);
    } else {
      setSheetB(parsed);
      setMapB(mapping);
    }
  }

  async function onFile(side: "A" | "B", file: File | null) {
    if (!file) return;
    setError(null);
    setResults(null);
    try {
      const inspected = await inspectSpreadsheetFile(file);

      if (inspected.kind === "csv") {
        const parsed = await parseSpreadsheetFile(file);
        applyParsed(side, parsed);
        return;
      }

      if (inspected.sheetNames.length <= 1) {
        const parsed = await parseSpreadsheetFile(file);
        applyParsed(side, parsed);
        return;
      }

      if (!inspected.workbook) {
        throw new Error("Could not read workbook sheets.");
      }

      setSheetPick({
        side,
        fileName: inspected.fileName,
        workbook: inspected.workbook,
        previews: inspected.previews,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    }
  }

  function confirmSheet(sheetName: string) {
    if (!sheetPick) return;
    const parsed = parseSheetFromWorkbook(
      sheetPick.workbook,
      sheetPick.fileName,
      sheetName,
    );
    applyParsed(sheetPick.side, parsed);
    setSheetPick(null);
  }

  async function askAiMapping(side: "A" | "B") {
    if (!plan.aiSuggestions) {
      setAiNote("AI mapping is available on Pro.");
      return;
    }
    const sheet = side === "A" ? sheetA : sheetB;
    if (!sheet) return;
    setAiNote("Asking DeepSeek…");
    const res = await authFetch("/api/ai/suggest-mapping", {
      method: "POST",
      body: JSON.stringify({
        headers: sheet.headers,
        sampleRows: sheet.rows.slice(0, 3),
      }),
    });
    const data = (await res.json()) as {
      suggestions?: Array<{ header: string; role: ColumnRole }>;
      provider?: string;
      error?: string;
    };
    if (!res.ok || !data.suggestions) {
      setAiNote(data.error || "AI unavailable — using dictionary mapping.");
      return;
    }
    const next: ColumnMapping = { ...(side === "A" ? mapA : mapB) };
    for (const s of data.suggestions) {
      if (sheet.headers.includes(s.header) && ROLES.includes(s.role)) {
        next[s.header] = s.role;
      }
    }
    if (side === "A") setMapA(next);
    else setMapB(next);
    setAiNote(
      `AI mapping applied${data.provider ? ` (${data.provider})` : ""} — review before running.`,
    );
  }

  async function runRecon() {
    if (!sheetA || !sheetB) {
      setError("Upload both files first.");
      return;
    }
    if (!mappingIsValid(mapA) || !mappingIsValid(mapB)) {
      setError("Each side needs a date column and amount (or debit+credit).");
      return;
    }

    // Fail early on raw size (before spending a run / normalizing).
    if (
      sheetA.rows.length > plan.maxRowsPerSide ||
      sheetB.rows.length > plan.maxRowsPerSide
    ) {
      setError(
        `${plan.name} allows up to ${plan.maxRowsPerSide.toLocaleString()} rows per side (A: ${sheetA.rows.length.toLocaleString()}, B: ${sheetB.rows.length.toLocaleString()}). Upgrade for higher limits.`,
      );
      return;
    }

    setBusy(true);
    setBusyLabel("Normalizing…");
    setError(null);
    try {
      const options = { dateToleranceDays, flipSignOnB };
      // Let the UI paint the busy state before heavy work.
      await new Promise((r) => setTimeout(r, 0));

      const rowsA = normalizeSheet(sheetA, mapA, "A", options);
      const rowsB = normalizeSheet(sheetB, mapB, "B", options);

      if (
        rowsA.length > plan.maxRowsPerSide ||
        rowsB.length > plan.maxRowsPerSide
      ) {
        setError(
          `${plan.name} allows up to ${plan.maxRowsPerSide.toLocaleString()} transaction rows per side after mapping (A: ${rowsA.length.toLocaleString()}, B: ${rowsB.length.toLocaleString()}). Upgrade for higher limits.`,
        );
        setBusy(false);
        return;
      }

      const supabase = createAuthClient();
      setBusyLabel("Checking quota…");
      const { data: gateData, error: gateError } = await supabase.rpc(
        "start_recon_run",
        {
          p_file_a_name: sheetA.fileName,
          p_file_b_name: sheetB.fileName,
          p_rows_a: rowsA.length,
          p_rows_b: rowsB.length,
        },
      );

      if (gateError) {
        const hint = /function|schema cache|PGRST202/i.test(gateError.message)
          ? "Run supabase/patch-recon-run-rpc.sql in the Supabase SQL Editor, then try again."
          : gateError.message;
        setError(hint);
        setBusy(false);
        return;
      }

      const gate = gateData as {
        ok?: boolean;
        message?: string;
        runId?: string;
      } | null;

      if (!gate?.ok) {
        setError(gate?.message || "Run limit reached. Upgrade to continue.");
        setBusy(false);
        return;
      }

      setBusyLabel(
        rowsA.length + rowsB.length > 2000
          ? "Matching (large file)…"
          : "Matching…",
      );
      await new Promise((r) => setTimeout(r, 0));

      const matched = runMatch(rowsA, rowsB, options);
      setResults(matched.results);
      setSummary(matched.summary);
      setDiffCandidates(matched.diffCandidates);

      if (gate.runId) {
        await supabase.rpc("complete_recon_run", {
          p_run_id: gate.runId,
          p_matched: matched.summary.matched,
          p_only_a: matched.summary.onlyA,
          p_only_b: matched.summary.onlyB,
          p_needs_review: matched.summary.needsReview,
          p_delta: matched.summary.delta,
          p_summary: matched.summary,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reconcile failed");
    } finally {
      setBusy(false);
      setBusyLabel("Working…");
    }
  }

  function exportXlsx() {
    if (!results || !summary) return;
    if (!plan.fullExport) {
      setError("Full export requires Starter or Pro.");
      return;
    }
    const buffer = buildExportWorkbook(results, summary, {
      audit: plan.auditExport,
      labels: sideLabels,
    });
    downloadArrayBuffer(buffer, `sheetdiff-${Date.now()}.xlsx`);
  }

  function applyManualReview(next: MatchResult[]) {
    if (!summary) return;
    setResults(next);
    setSummary(
      recomputeSummary(next, {
        countA: summary.countA,
        countB: summary.countB,
        sumA: summary.sumA,
        sumB: summary.sumB,
        delta: summary.delta,
      }),
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">
      {sheetPick ? (
        <SheetPicker
          fileName={sheetPick.fileName}
          sideLabel={
            sheetPick.side === "A" ? sideLabels.a : sideLabels.b
          }
          previews={sheetPick.previews}
          onSelect={confirmSheet}
          onCancel={() => setSheetPick(null)}
        />
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--ink)]">
            Reconcile
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            1. Drop two files → 2. Confirm columns → 3. Scan the full timeline
            {profile.full_name ? ` · Hi ${profile.full_name.split(" ")[0]}` : ""}
          </p>
        </div>
        <div className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
          Plan: <span className="text-[var(--ink)]">{plan.name}</span>
          {" · "}
          {plan.id === "free"
            ? `${profile.lifetime_runs_used}/${plan.lifetimeRuns} lifetime run`
            : `${profile.monthly_runs_used}/${plan.runsPerMonth} runs this month`}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Sides
        </span>
        <label className="flex items-center gap-1.5 text-[var(--muted)]">
          A
          <input
            value={sideLabels.a}
            onChange={(e) => setLabel("a", e.target.value)}
            onBlur={() => commitLabel("a")}
            className="w-28 rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-[var(--ink)]"
            maxLength={24}
            aria-label="Side A label"
          />
        </label>
        <span className="text-[var(--muted)]">↔</span>
        <label className="flex items-center gap-1.5 text-[var(--muted)]">
          B
          <input
            value={sideLabels.b}
            onChange={(e) => setLabel("b", e.target.value)}
            onBlur={() => commitLabel("b")}
            className="w-28 rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-[var(--ink)]"
            maxLength={24}
            aria-label="Side B label"
          />
        </label>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {SIDE_LABEL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setSideLabels(preset.sides)}
              className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <FileCard
          label={fileCardTitle("a", sideLabels)}
          sheet={sheetA}
          mapping={mapA}
          maxRows={plan.maxRowsPerSide}
          onFile={(f) => onFile("A", f)}
          onMapChange={setMapA}
          onAi={() => askAiMapping("A")}
          showAi={plan.aiSuggestions}
        />
        <FileCard
          label={fileCardTitle("b", sideLabels)}
          sheet={sheetB}
          mapping={mapB}
          maxRows={plan.maxRowsPerSide}
          onFile={(f) => onFile("B", f)}
          onMapChange={setMapB}
          onAi={() => askAiMapping("B")}
          showAi={plan.aiSuggestions}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm">
        <label className="flex items-center gap-2 text-[var(--muted)]">
          Date tolerance
          <input
            type="number"
            min={0}
            max={7}
            value={dateToleranceDays}
            onChange={(e) => setDateToleranceDays(Number(e.target.value) || 0)}
            className="w-16 rounded-lg border border-[var(--border)] px-2 py-1 text-[var(--ink)]"
          />
          days
        </label>
        <label className="flex items-center gap-2 text-[var(--muted)]">
          <input
            type="checkbox"
            checked={flipSignOnB}
            onChange={(e) => setFlipSignOnB(e.target.checked)}
          />
          Flip sign on file B
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={runRecon}
          className="ml-auto rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? busyLabel : "Run SheetDiff"}
        </button>
      </div>

      <p className="mt-2 text-xs text-[var(--muted)]">
        Plan limit: {plan.maxRowsPerSide.toLocaleString()} rows per side · long
        files use amount indexing + virtualized results
      </p>

      {aiNote ? (
        <p className="mt-3 text-sm text-[var(--accent)]">{aiNote}</p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-red-600">
          {error}{" "}
          {/upgrade|rows per side|pricing/i.test(error) ? (
            <Link href="/pricing" className="underline">
              View pricing
            </Link>
          ) : null}
        </p>
      ) : null}

      {summary && results ? (
        <ResultsView
          results={results}
          summary={summary}
          diffCandidates={diffCandidates}
          previewLimit={previewLimit}
          labels={sideLabels}
          onExport={exportXlsx}
          onResultsChange={applyManualReview}
        />
      ) : null}
    </div>
  );
}

function FileCard({
  label,
  sheet,
  mapping,
  maxRows,
  onFile,
  onMapChange,
  onAi,
  showAi,
}: {
  label: string;
  sheet: ParsedSheet | null;
  mapping: ColumnMapping;
  maxRows: number;
  onFile: (file: File | null) => void;
  onMapChange: (mapping: ColumnMapping) => void;
  onAi: () => void;
  showAi: boolean;
}) {
  const overLimit = sheet != null && sheet.rows.length > maxRows;

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-white/90 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-[var(--ink)]">{label}</h2>
        {showAi ? (
          <button
            type="button"
            onClick={onAi}
            className="text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            AI suggest
          </button>
        ) : null}
      </div>
      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[#f7f9fc] px-4 py-8 text-center hover:bg-[var(--accent-soft)]">
        <span className="text-sm font-medium text-[var(--ink)]">
          {sheet ? sheet.fileName : "Drop CSV / XLSX"}
        </span>
        <span className="mt-1 text-xs text-[var(--muted)]">
          {sheet
            ? `${sheet.rows.length.toLocaleString()} rows${sheet.sheetName ? ` · ${sheet.sheetName}` : ""} · max ${maxRows.toLocaleString()}`
            : "or click to browse"}
        </span>
        <input
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {overLimit ? (
        <p className="mt-2 text-xs text-red-600">
          Over plan limit ({maxRows.toLocaleString()} rows/side).{" "}
          <Link href="/pricing" className="underline">
            Upgrade
          </Link>{" "}
          or trim the sheet before running.
        </p>
      ) : null}
      {sheet ? (
        <div className="mt-4 max-h-56 space-y-2 overflow-y-auto">
          {sheet.headers.map((header) => (
            <div
              key={header}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="truncate text-[var(--muted)]">{header}</span>
              <select
                value={mapping[header] ?? "ignore"}
                onChange={(e) =>
                  onMapChange({
                    ...mapping,
                    [header]: e.target.value as ColumnRole,
                  })
                }
                className="rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
