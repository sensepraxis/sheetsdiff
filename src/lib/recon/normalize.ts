import Decimal from "decimal.js";
import type {
  ColumnMapping,
  ParsedSheet,
  ReconOptions,
  Side,
  TransactionRow,
} from "@/lib/recon/types";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

function cleanMoney(raw: string): Decimal | null {
  const trimmed = raw.trim();
  if (!trimmed || /^total|合计|小计/i.test(trimmed)) return null;

  let text = trimmed.replace(/[,¥$€£\s]/g, "");
  const parenNeg = /^\((.*)\)$/.test(text);
  if (parenNeg) text = text.slice(1, -1);
  if (!text || text === "-" || text === "—") return null;

  try {
    let value = new Decimal(text);
    if (parenNeg) value = value.neg();
    return value;
  } catch {
    return null;
  }
}

function parseDate(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;

  // Excel serial-ish numbers already stringified by parser sometimes.
  const iso = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    const y = iso[1];
    const m = iso[2].padStart(2, "0");
    const d = iso[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const us = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (us) {
    let y = us[3];
    if (y.length === 2) y = `20${y}`;
    const m = us[1].padStart(2, "0");
    const d = us[2].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const dt = new Date(t);
  if (!Number.isNaN(dt.getTime())) {
    return dt.toISOString().slice(0, 10);
  }
  return null;
}

function findHeader(mapping: ColumnMapping, role: string): string | undefined {
  return Object.entries(mapping).find(([, r]) => r === role)?.[0];
}

export function normalizeSheet(
  sheet: ParsedSheet,
  mapping: ColumnMapping,
  side: Side,
  options: ReconOptions,
): TransactionRow[] {
  const dateH = findHeader(mapping, "date");
  const amountH = findHeader(mapping, "amount");
  const debitH = findHeader(mapping, "debit");
  const creditH = findHeader(mapping, "credit");
  const refH = findHeader(mapping, "reference");
  const descH = findHeader(mapping, "description");

  const out: TransactionRow[] = [];

  sheet.rows.forEach((raw, index) => {
    // Skip likely total rows
    const blob = Object.values(raw).join(" ").toLowerCase();
    if (/\b(total|合计|小计|balance brought)\b/i.test(blob) && index > 0) {
      return;
    }

    let amount: Decimal | null = null;
    if (amountH) {
      amount = cleanMoney(raw[amountH] ?? "");
    } else if (debitH || creditH) {
      const debit = cleanMoney(raw[debitH ?? ""] ?? "") ?? new Decimal(0);
      const credit = cleanMoney(raw[creditH ?? ""] ?? "") ?? new Decimal(0);
      if (debit.isZero() && credit.isZero()) amount = null;
      else amount = credit.minus(debit);
    }

    if (!amount) return;

    if (side === "B" && options.flipSignOnB) {
      amount = amount.neg();
    }

    const date = dateH ? parseDate(raw[dateH] ?? "") : null;
    const reference = (refH ? raw[refH] : "")?.trim() ?? "";
    const description = (descH ? raw[descH] : "")?.trim() ?? "";
    const absoluteAmount = amount.abs().toFixed(2);
    const signed = amount.toFixed(2);
    const direction = amount.isNeg() ? "out" : amount.isZero() ? "unknown" : "in";
    const fingerprint = `${absoluteAmount}|${date ?? ""}|${reference}|${description.slice(0, 40)}`;

    out.push({
      rowId: `${side}-${index}`,
      side,
      date,
      amount: signed,
      absoluteAmount,
      direction,
      reference,
      description,
      raw,
      fingerprint,
    });
  });

  return out;
}
