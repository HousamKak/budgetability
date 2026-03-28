import { dataService } from "@/lib/data-service";
import type { Category, Expense } from "@/lib/data-service";
import type { ManualEntry } from "@/types/spreadsheet.types";
import { useCallback, useEffect, useMemo, useState } from "react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad2(n: number) { return String(n).padStart(2, "0"); }
function mk(year: number, month: number) { return `${year}-${pad2(month + 1)}`; }

// ── Row definitions ──────────────────────────────────────────────

export interface RowDef {
  id: string;
  label: string;
  section: "income" | "payments" | "savings" | "other";
  type: "currency" | "number";
}

export interface SectionDef {
  id: string;
  label: string;
  color: string;          // tailwind bg class for header
  rows: RowDef[];
  totalRow?: { id: string; label: string };
}

export interface MonthCol {
  key: string;     // "2026-03"
  label: string;   // "March 2026"
  shortLabel: string; // "Mar 2026"
  isCurrent: boolean;
}

// Static rows ─────────────────────────────────────────────────────

const INCOME_ROWS: RowDef[] = [
  { id: "income_salary", label: "Salary", section: "income", type: "currency" },
  { id: "income_loan_income", label: "Loan Income", section: "income", type: "currency" },
  { id: "income_startups", label: "Startups", section: "income", type: "currency" },
  { id: "income_freelance", label: "Freelance", section: "income", type: "currency" },
  { id: "income_bonus", label: "Bonus", section: "income", type: "currency" },
  { id: "income_investments", label: "Investments & Trading", section: "income", type: "currency" },
  { id: "income_teaching", label: "Teaching", section: "income", type: "currency" },
  { id: "income_content", label: "Content Creation", section: "income", type: "currency" },
  { id: "income_personal_company", label: "Personal Company", section: "income", type: "currency" },
];

const SAVINGS_ROWS: RowDef[] = [
  { id: "savings_drhm", label: "Savings in DRHM", section: "savings", type: "currency" },
  { id: "savings_dollar", label: "Savings in Dollar", section: "savings", type: "currency" },
  { id: "savings_cash", label: "Cash Savings", section: "savings", type: "currency" },
];

const OTHER_ROWS: RowDef[] = [
  { id: "other_credit_card", label: "Credit Card", section: "other", type: "currency" },
  { id: "other_loans", label: "Loans", section: "other", type: "currency" },
  { id: "other_buy_exchange", label: "Buy Dollar Rate", section: "other", type: "number" },
  { id: "other_sell_exchange", label: "Sell Dollar Rate", section: "other", type: "number" },
];

// ── Hook ─────────────────────────────────────────────────────────

export function useSpreadsheetData() {
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth();
  const ny = cm === 11 ? cy + 1 : cy;
  const nm = cm === 11 ? 0 : cm + 1;

  const months: MonthCol[] = useMemo(() => [
    { key: mk(cy, cm), label: `${MONTH_NAMES[cm]} ${cy}`, shortLabel: `${MONTH_NAMES[cm].slice(0, 3)} ${cy}`, isCurrent: true },
    { key: mk(ny, nm), label: `${MONTH_NAMES[nm]} ${ny}`, shortLabel: `${MONTH_NAMES[nm].slice(0, 3)} ${ny}`, isCurrent: false },
  ], [cy, cm, ny, nm]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<ManualEntry[]>([]);
  const [expensesByMonth, setExpensesByMonth] = useState<Record<string, Expense[]>>({});
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  // Manual entry lookup: "monthKey:rowId" → value
  const entryMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(`${e.monthKey}:${e.columnKey}`, e.value);
    return m;
  }, [entries]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [expenses, , manualEntries, cats] = await Promise.all([
          dataService.getExpensesForMonthRange(months[0].key, months[months.length - 1].key),
          dataService.getBudgetsForMonthRange(months[0].key, months[months.length - 1].key),
          dataService.getSpreadsheetEntries(),
          dataService.getCategories(),
        ]);
        if (cancelled) return;
        setExpensesByMonth(expenses);
        setCategories(cats);
        setEntries(manualEntries);
      } catch (error) {
        console.error("Failed to load spreadsheet data:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [months, reloadKey]);

  // Payment rows from categories
  const paymentRows: RowDef[] = useMemo(
    () => categories.map(c => ({
      id: `payment_${c.name.toLowerCase().replace(/\s+/g, "_")}`,
      label: c.name,
      section: "payments" as const,
      type: "currency" as const,
    })),
    [categories],
  );

  // Sections
  const sections: SectionDef[] = useMemo(() => [
    { id: "income", label: "Income", color: "bg-emerald-100/80", rows: INCOME_ROWS, totalRow: { id: "income_total", label: "Total Income" } },
    { id: "payments", label: "Payments", color: "bg-red-100/80", rows: paymentRows, totalRow: { id: "payment_total", label: "Total Payments" } },
    { id: "savings", label: "Savings", color: "bg-blue-100/80", rows: SAVINGS_ROWS, totalRow: { id: "savings_total", label: "Total Savings" } },
    { id: "other", label: "Other", color: "bg-purple-100/80", rows: OTHER_ROWS },
  ], [paymentRows]);

  // ── Cell value logic ───────────────────────────────────────────

  const getCellValue = useCallback((rowId: string, monthKey: string): number | null => {
    // Payment rows (current month) → actual expenses
    if (rowId.startsWith("payment_") && rowId !== "payment_total" && monthKey === months[0].key) {
      const catName = rowId.replace("payment_", "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const monthExpenses = expensesByMonth[monthKey] ?? [];
      const sum = monthExpenses.filter(e => (e.category ?? "Other") === catName).reduce((s, e) => s + e.amount, 0);
      return sum > 0 ? -sum : (entryMap.get(`${monthKey}:${rowId}`) ?? null);
    }
    return entryMap.get(`${monthKey}:${rowId}`) ?? null;
  }, [expensesByMonth, entryMap, months]);

  // Section total
  const getSectionTotal = useCallback((sectionRows: RowDef[], monthKey: string): number => {
    let total = 0;
    for (const row of sectionRows) {
      const v = getCellValue(row.id, monthKey);
      if (v != null) total += v;
    }
    return total;
  }, [getCellValue]);

  // Summary values
  const getSummary = useCallback((monthKey: string) => {
    const income = getSectionTotal(INCOME_ROWS, monthKey);
    const payments = getSectionTotal(paymentRows, monthKey);
    const savings = getSectionTotal(SAVINGS_ROWS, monthKey);
    return {
      netIncome: income + payments, // payments are negative
      afterSavings: income + payments - savings,
    };
  }, [getSectionTotal, paymentRows]);

  // ── Cell editability ───────────────────────────────────────────

  const isCellEditable = useCallback((rowId: string, monthKey: string): boolean => {
    if (rowId.endsWith("_total") || rowId === "net_income" || rowId === "after_savings") return false;
    // Current month payment rows with actual data are read-only
    if (rowId.startsWith("payment_") && monthKey === months[0].key) {
      const catName = rowId.replace("payment_", "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const hasActual = (expensesByMonth[monthKey] ?? []).some(e => (e.category ?? "Other") === catName);
      if (hasActual) return false;
    }
    return true;
  }, [months, expensesByMonth]);

  // ── Cell mutations ─────────────────────────────────────────────

  const updateCell = useCallback(async (rowId: string, monthKey: string, value: number) => {
    await dataService.setSpreadsheetEntry(monthKey, rowId, value);
    setEntries(prev => {
      const existing = prev.find(e => e.monthKey === monthKey && e.columnKey === rowId);
      if (existing) return prev.map(e => e === existing ? { ...e, value } : e);
      return [...prev, { id: crypto.randomUUID(), monthKey, columnKey: rowId, value }];
    });
  }, []);

  const clearCell = useCallback(async (rowId: string, monthKey: string) => {
    await dataService.removeSpreadsheetEntry(monthKey, rowId);
    setEntries(prev => prev.filter(e => !(e.monthKey === monthKey && e.columnKey === rowId)));
  }, []);

  return { sections, months, getCellValue, getSectionTotal, getSummary, isCellEditable, updateCell, clearCell, loading, reload };
}
