export type Side = "A" | "B";

export type ColumnRole =
  | "date"
  | "amount"
  | "debit"
  | "credit"
  | "reference"
  | "description"
  | "ignore";

export type ColumnMapping = Record<string, ColumnRole>;

export type TransactionRow = {
  rowId: string;
  side: Side;
  date: string | null;
  amount: string;
  absoluteAmount: string;
  direction: "in" | "out" | "unknown";
  reference: string;
  description: string;
  raw: Record<string, string>;
  fingerprint: string;
};

export type MatchType = "reference+amount" | "amount+date" | "manual";

export type MatchResult =
  | {
      status: "matched";
      a: TransactionRow;
      b: TransactionRow;
      matchType: MatchType;
      confidence: number;
      explanation: string;
    }
  | {
      status: "only_a";
      row: TransactionRow;
    }
  | {
      status: "only_b";
      row: TransactionRow;
    }
  | {
      status: "needs_review";
      candidatesA: TransactionRow[];
      candidatesB: TransactionRow[];
      explanation: string;
    };

export type DiffCandidate = {
  kind: "single_a" | "single_b" | "pair_a" | "pair_b" | "duplicate";
  amount: string;
  rows: TransactionRow[];
  explanation: string;
};

export type ReconSummary = {
  countA: number;
  countB: number;
  matched: number;
  onlyA: number;
  onlyB: number;
  needsReview: number;
  sumA: string;
  sumB: string;
  delta: string;
  matchRate: number;
};

export type ReconOptions = {
  dateToleranceDays: number;
  flipSignOnB: boolean;
};

export type ParsedSheet = {
  fileName: string;
  sheetName?: string;
  headers: string[];
  rows: Record<string, string>[];
};
