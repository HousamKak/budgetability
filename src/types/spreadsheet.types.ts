// ============================================
// SPREADSHEET VIEW TYPES
// ============================================

export type ColumnGroupId =
  | "time"
  | "income"
  | "payments"
  | "net"
  | "savings"
  | "other";

export interface ColumnDef {
  key: string;
  label: string;
  type: "currency" | "text" | "number" | "computed";
  editable: boolean;
  width?: number;
}

export interface ColumnGroup {
  id: ColumnGroupId;
  label: string;
  summaryColumnKey: string; // Key of the column shown when collapsed
  columns: ColumnDef[];
  alwaysExpanded?: boolean; // e.g., Time group
}

export interface SpreadsheetRow {
  monthKey: string; // "YYYY-MM"
  year: number;
  month: number; // 0-based
  monthLabel: string;
  showYear: boolean; // Only true for first month of each year
  values: Record<string, number | string | null>;
}

export interface ManualEntry {
  id: string;
  monthKey: string;
  columnKey: string;
  value: number;
}

export type ExpandedGroups = Record<ColumnGroupId, boolean>;
