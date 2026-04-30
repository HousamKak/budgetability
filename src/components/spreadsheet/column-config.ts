import type { ColumnDef, ColumnGroup } from "@/types/spreadsheet.types";

// ============================================
// STATIC COLUMN DEFINITIONS
// ============================================

const timeColumns: ColumnDef[] = [
  { key: "year", label: "Year", type: "text", editable: false, width: 60 },
  { key: "month", label: "Month", type: "text", editable: false, width: 80 },
];

// Income is auto-derived from account deposits. No manual sub-columns —
// a single read-only column shows the total deposits for the month.
const incomeColumns: ColumnDef[] = [
  { key: "income_total", label: "Income", type: "computed", editable: false, width: 110 },
];

// Payment columns will be dynamically built from user categories + these fixed ones
const fixedPaymentColumns: ColumnDef[] = [
  { key: "payment_total", label: "Total Payments", type: "computed", editable: false, width: 120 },
];

const savingsColumns: ColumnDef[] = [
  { key: "savings_drhm", label: "Savings in DRHM", type: "currency", editable: true, width: 120 },
  { key: "savings_dollar", label: "Savings in Dollar", type: "currency", editable: true, width: 120 },
  { key: "savings_cash", label: "Cash Savings", type: "currency", editable: true, width: 110 },
];

const otherColumns: ColumnDef[] = [
  { key: "other_credit_card", label: "Credit Card", type: "currency", editable: true, width: 110 },
  { key: "other_loans", label: "Loans", type: "currency", editable: true, width: 100 },
  { key: "other_buy_exchange", label: "Buy Dollar Rate", type: "number", editable: true, width: 110 },
  { key: "other_sell_exchange", label: "Sell Dollar Rate", type: "number", editable: true, width: 110 },
];

// ============================================
// COLUMN GROUP BUILDERS
// ============================================

export function buildColumnGroups(
  categoryNames: string[],
): ColumnGroup[] {
  // Build dynamic payment columns from user's expense categories
  const dynamicPaymentColumns: ColumnDef[] = categoryNames.map((name) => ({
    key: paymentColumnKey(name),
    label: name,
    type: "currency" as const,
    editable: false, // auto-computed from expenses
    width: 110,
  }));

  const paymentColumns = [...dynamicPaymentColumns, ...fixedPaymentColumns];

  return [
    {
      id: "time",
      label: "Time",
      summaryColumnKey: "month",
      columns: timeColumns,
      alwaysExpanded: true,
    },
    {
      id: "income",
      label: "Income",
      summaryColumnKey: "income_total",
      columns: incomeColumns,
    },
    {
      id: "payments",
      label: "Payments",
      summaryColumnKey: "payment_total",
      columns: paymentColumns,
    },
    {
      id: "savings",
      label: "Savings",
      summaryColumnKey: "savings_drhm",
      columns: savingsColumns,
    },
    {
      id: "other",
      label: "Other",
      summaryColumnKey: "other_credit_card",
      columns: otherColumns,
    },
  ];
}

// Single helper for deriving the payment column key from a category name.
// Used by both buildColumnGroups and the row builder so they can't drift.
export function paymentColumnKey(categoryName: string): string {
  return `payment_${categoryName.toLowerCase().replace(/\s+/g, "_")}`;
}

// Helper: get the category name from a payment column key
export function categoryNameFromPaymentKey(key: string): string | null {
  if (!key.startsWith("payment_") || key === "payment_total") return null;
  return key
    .replace("payment_", "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
