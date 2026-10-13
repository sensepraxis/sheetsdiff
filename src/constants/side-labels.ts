/** Display labels for the two spreadsheet sides. Engine IDs stay A/B. */

export type SideLabels = {
  a: string;
  b: string;
};

export const DEFAULT_SIDE_LABELS: SideLabels = {
  a: "Bank",
  b: "Books",
};

/** One-click presets for common recon scenarios. */
export const SIDE_LABEL_PRESETS: Array<{ id: string; label: string; sides: SideLabels }> =
  [
    { id: "bank-books", label: "Bank ↔ Books", sides: { a: "Bank", b: "Books" } },
    {
      id: "statement-ledger",
      label: "Statement ↔ Ledger",
      sides: { a: "Statement", b: "Ledger" },
    },
    {
      id: "system",
      label: "System 1 ↔ System 2",
      sides: { a: "System 1", b: "System 2" },
    },
    {
      id: "source",
      label: "Source A ↔ Source B",
      sides: { a: "Source A", b: "Source B" },
    },
  ];

export function onlyInLabel(side: "a" | "b", labels: SideLabels): string {
  return `Only ${labels[side]}`;
}

export function fileCardTitle(side: "a" | "b", labels: SideLabels): string {
  const letter = side === "a" ? "A" : "B";
  return `File ${letter} — ${labels[side]}`;
}
