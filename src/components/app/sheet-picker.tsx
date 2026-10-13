"use client";

type Preview = {
  name: string;
  rowCount: number;
  headers: string[];
  sampleRows: string[][];
  looksTransactional: boolean;
};

type Props = {
  fileName: string;
  sideLabel: string;
  previews: Preview[];
  onSelect: (sheetName: string) => void;
  onCancel: () => void;
};

export function SheetPicker({
  fileName,
  sideLabel,
  previews,
  onSelect,
  onCancel,
}: Props) {
  const suggested =
    previews.find((p) => p.looksTransactional)?.name ?? previews[0]?.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--ink)]">
            Choose a sheet — {sideLabel}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {fileName} has {previews.length} sheets. Pick the transaction tab.
          </p>
        </div>

        <div className="max-h-[55vh] space-y-3 overflow-y-auto px-6 py-4">
          {previews.map((preview) => (
            <button
              key={preview.name}
              type="button"
              onClick={() => onSelect(preview.name)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] ${
                preview.name === suggested
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]/50"
                  : "border-[var(--border)] bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--ink)]">
                    {preview.name}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {preview.rowCount} data rows
                    {preview.looksTransactional ? " · looks like ledger" : ""}
                  </p>
                </div>
                {preview.name === suggested ? (
                  <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-white">
                    Suggested
                  </span>
                ) : null}
              </div>
              {preview.headers.length > 0 ? (
                <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--border)] bg-[#f8fafc]">
                  <table className="min-w-full text-left text-[11px]">
                    <thead>
                      <tr className="text-[var(--muted)]">
                        {preview.headers.slice(0, 6).map((h) => (
                          <th key={h} className="px-2 py-1 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sampleRows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t border-[var(--border)]">
                          {row.slice(0, 6).map((cell, j) => (
                            <td
                              key={j}
                              className="max-w-[120px] truncate px-2 py-1 text-[var(--ink)]"
                            >
                              {cell || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
