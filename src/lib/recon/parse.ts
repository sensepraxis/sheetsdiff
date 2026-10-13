import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ParsedSheet } from "@/lib/recon/types";

export type WorkbookPreview = {
  fileName: string;
  sheetNames: string[];
  /** first sheet parsed by default; caller may re-parse another */
  defaultSheetName: string;
};

function normalizeHeader(value: unknown, index: number): string {
  const text = String(value ?? "").trim();
  return text || `Column ${index + 1}`;
}

function rowsFromMatrix(matrix: unknown[][]): ParsedSheet["rows"] {
  if (matrix.length === 0) return [];
  const headerRow = matrix[0] ?? [];
  const headers = headerRow.map((cell, i) => normalizeHeader(cell, i));

  return matrix
    .slice(1)
    .map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((header, i) => {
        const cell = row[i];
        obj[header] =
          cell == null || cell === ""
            ? ""
            : typeof cell === "number"
              ? String(cell)
              : String(cell).trim();
      });
      return obj;
    })
    .filter((row) => Object.values(row).some((v) => v !== ""));
}

function matrixFromSheet(sheet: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
}

export function parseSheetFromWorkbook(
  workbook: XLSX.WorkBook,
  fileName: string,
  sheetName: string,
): ParsedSheet {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { fileName, sheetName, headers: [], rows: [] };
  }
  const matrix = matrixFromSheet(sheet);
  const headers = matrix[0]?.map((cell, i) => normalizeHeader(cell, i)) ?? [];
  return {
    fileName,
    sheetName,
    headers,
    rows: rowsFromMatrix(matrix),
  };
}

export function listSheetPreviews(workbook: XLSX.WorkBook): Array<{
  name: string;
  rowCount: number;
  headers: string[];
  sampleRows: string[][];
  looksTransactional: boolean;
}> {
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const matrix = sheet ? matrixFromSheet(sheet) : [];
    const headers = (matrix[0] ?? []).map((cell, i) => normalizeHeader(cell, i));
    const dataRows = matrix.slice(1).filter((row) =>
      row.some((cell) => String(cell ?? "").trim() !== ""),
    );
    const headerBlob = headers.join(" ").toLowerCase();
    const looksTransactional =
      /(date|日期)/i.test(headerBlob) &&
      /(amount|debit|credit|金额|借方|贷方)/i.test(headerBlob);

    return {
      name,
      rowCount: dataRows.length,
      headers,
      sampleRows: dataRows.slice(0, 5).map((row) =>
        headers.map((_, i) => String(row[i] ?? "")),
      ),
      looksTransactional,
    };
  });
}

export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: "array", cellDates: true });
}

export async function parseSpreadsheetFile(
  file: File,
  preferredSheetName?: string,
): Promise<ParsedSheet> {
  const name = file.name;
  const lower = name.toLowerCase();

  if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) {
    const text = await file.text();
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h, i) => normalizeHeader(h, i),
    });
    const headers = result.meta.fields?.filter(Boolean) ?? [];
    const rows = (result.data ?? []).filter((row) =>
      Object.values(row).some((v) => String(v ?? "").trim() !== ""),
    );
    return { fileName: name, sheetName: "CSV", headers, rows };
  }

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const workbook = await readWorkbook(file);
    const sheetName =
      preferredSheetName && workbook.SheetNames.includes(preferredSheetName)
        ? preferredSheetName
        : workbook.SheetNames[0];
    if (!sheetName) {
      return { fileName: name, sheetName: "", headers: [], rows: [] };
    }
    return parseSheetFromWorkbook(workbook, name, sheetName);
  }

  throw new Error("Unsupported file type. Use CSV or Excel (.xlsx).");
}

export async function inspectSpreadsheetFile(file: File): Promise<{
  kind: "csv" | "excel";
  fileName: string;
  sheetNames: string[];
  previews: ReturnType<typeof listSheetPreviews>;
  workbook?: XLSX.WorkBook;
}> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) {
    return {
      kind: "csv",
      fileName: file.name,
      sheetNames: ["CSV"],
      previews: [],
    };
  }

  const workbook = await readWorkbook(file);
  return {
    kind: "excel",
    fileName: file.name,
    sheetNames: workbook.SheetNames,
    previews: listSheetPreviews(workbook),
    workbook,
  };
}
