import { dataService } from "@/lib/data-service";
import type {
  AccountTransaction,
  Category,
  Expense,
} from "@/lib/data-service";
import type { SpreadsheetRow } from "@/types/spreadsheet.types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildColumnGroups, paymentColumnKey } from "./column-config";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function mk(year: number, month: number) {
  return `${year}-${pad2(month + 1)}`;
}

// Mirror the rule used in AccountTransactionsDialog: prefer the explicit
// monthKey stamped at write time, fall back to createdAt for ad-hoc rows
// (deposits / transfers don't usually stamp monthKey).
function txMonthKey(tx: { monthKey?: string; createdAt: string }): string {
  if (tx.monthKey) return tx.monthKey;
  const d = new Date(tx.createdAt);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** Generate month keys from startYear-startMonth to endYear-endMonth (inclusive, 0-based months) */
function generateMonthRange(
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
): { year: number; month: number; monthKey: string }[] {
  const result: { year: number; month: number; monthKey: string }[] = [];
  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    result.push({ year: y, month: m, monthKey: mk(y, m) });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return result;
}

export type DrillDownItem =
  | { kind: "deposit"; tx: AccountTransaction }
  | { kind: "expense"; expense: Expense };

export interface SpreadsheetData {
  rows: SpreadsheetRow[];
  columnGroups: ReturnType<typeof buildColumnGroups>;
  loading: boolean;
  categories: Category[];
  reload: () => void;
  updateEntry: (monthKey: string, columnKey: string, value: number) => Promise<void>;
  removeEntry: (monthKey: string, columnKey: string) => Promise<void>;
  /** Returns the underlying transactions backing a cell's value, or null
   * if the column isn't a derived (deposit / expense) column. */
  drillDown: (monthKey: string, columnKey: string) => DrillDownItem[] | null;
}

export function useSpreadsheetData(
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
): SpreadsheetData {
  const [rows, setRows] = useState<SpreadsheetRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  // Sources for drill-down popovers. Kept in refs so the lookups don't
  // recreate every render; the data itself is small (one cell's worth
  // of underlying rows) and refreshed atomically with the row data.
  const depositsByMonthRef = useRef<Map<string, AccountTransaction[]>>(
    new Map(),
  );
  const expensesByMonthCategoryRef = useRef<Map<string, Expense[]>>(new Map());

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const startKey = mk(startYear, startMonth);
        const endKey = mk(endYear, endMonth);

        const [expensesByMonth, , manualEntries, cats, allTxs] =
          await Promise.all([
            dataService.getExpensesForMonthRange(startKey, endKey),
            dataService.getBudgetsForMonthRange(startKey, endKey),
            dataService.getSpreadsheetEntries(),
            dataService.getCategories(),
            dataService.getAccountTransactions(),
          ]);

        if (cancelled) return;

        const months = generateMonthRange(startYear, startMonth, endYear, endMonth);

        // Build manual entry lookup: "monthKey:columnKey" → value
        const entryMap = new Map<string, number>();
        for (const e of manualEntries) {
          entryMap.set(`${e.monthKey}:${e.columnKey}`, e.value);
        }

        // Group deposits by month for both the Income column total AND
        // the per-cell drill-down popover.
        const depositsByMonth = new Map<string, AccountTransaction[]>();
        for (const tx of allTxs) {
          if (tx.transactionType !== "deposit") continue;
          const key = txMonthKey(tx);
          const list = depositsByMonth.get(key) ?? [];
          list.push(tx);
          depositsByMonth.set(key, list);
        }
        depositsByMonthRef.current = depositsByMonth;

        // Build "monthKey:categoryId" → expenses[] for drill-down,
        // and rebuild "monthKey:categoryName" as a fallback for legacy
        // expenses that have only the text category set.
        const expensesByMonthCategory = new Map<string, Expense[]>();
        const catIdByName = new Map<string, string>();
        for (const c of cats) catIdByName.set(c.name, c.id);

        // Build rows
        let prevYear: number | null = null;
        const builtRows: SpreadsheetRow[] = months.map(({ year, month, monthKey }) => {
          const showYear = year !== prevYear;
          prevYear = year;

          const values: Record<string, number | string | null> = {};

          // Time
          values.year = showYear ? String(year) : "";
          values.month = MONTH_NAMES[month];

          // Income — auto-derived from deposits in account_transactions.
          const monthDeposits = depositsByMonth.get(monthKey) ?? [];
          const incomeTotal = monthDeposits.reduce((s, tx) => s + tx.amount, 0);
          values.income_total = incomeTotal;

          // Payments — match by categoryId first (stable across renames),
          // fall back to legacy text category only when the expense has
          // no categoryId.
          const expenses: Expense[] = expensesByMonth[monthKey] ?? [];
          let paymentTotal = 0;
          for (const cat of cats) {
            const colKey = paymentColumnKey(cat.name);
            const catExpenses = expenses.filter((e) =>
              e.categoryId
                ? e.categoryId === cat.id
                : (e.category ?? "") === cat.name,
            );
            const sum = catExpenses.reduce((s, e) => s + e.amount, 0);
            values[colKey] = sum > 0 ? -sum : 0;
            paymentTotal += sum;
            // Stash for drill-down (only if there are matches).
            if (catExpenses.length > 0) {
              expensesByMonthCategory.set(`${monthKey}:${cat.id}`, catExpenses);
            }
          }
          values.payment_total = paymentTotal > 0 ? -paymentTotal : 0;

          // Net = Income + Payments (payments already negative).
          values.net = incomeTotal + values.payment_total;

          // Savings (from manual entries)
          values.savings_drhm = entryMap.get(`${monthKey}:savings_drhm`) ?? 0;
          values.savings_dollar = entryMap.get(`${monthKey}:savings_dollar`) ?? 0;
          values.savings_cash = entryMap.get(`${monthKey}:savings_cash`) ?? 0;

          // Other (from manual entries)
          values.other_credit_card = entryMap.get(`${monthKey}:other_credit_card`) ?? 0;
          values.other_loans = entryMap.get(`${monthKey}:other_loans`) ?? 0;
          values.other_buy_exchange = entryMap.get(`${monthKey}:other_buy_exchange`) ?? 0;
          values.other_sell_exchange = entryMap.get(`${monthKey}:other_sell_exchange`) ?? 0;

          return {
            monthKey,
            year,
            month,
            monthLabel: MONTH_NAMES[month],
            showYear,
            values,
          };
        });

        expensesByMonthCategoryRef.current = expensesByMonthCategory;

        setRows(builtRows);
        setCategories(cats);
      } catch (error) {
        console.error("Failed to load spreadsheet data:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [startYear, startMonth, endYear, endMonth, reloadKey]);

  const columnGroups = useMemo(
    () => buildColumnGroups(categories.map((c) => c.name)),
    [categories],
  );

  const updateEntry = useCallback(
    async (monthKey: string, columnKey: string, value: number) => {
      await dataService.setSpreadsheetEntry(monthKey, columnKey, value);
      reload();
    },
    [reload],
  );

  const removeEntry = useCallback(
    async (monthKey: string, columnKey: string) => {
      await dataService.removeSpreadsheetEntry(monthKey, columnKey);
      reload();
    },
    [reload],
  );

  const drillDown = useCallback(
    (monthKey: string, columnKey: string): DrillDownItem[] | null => {
      if (columnKey === "income_total") {
        const list = depositsByMonthRef.current.get(monthKey) ?? [];
        return list.length
          ? list.map((tx) => ({ kind: "deposit", tx }) as DrillDownItem)
          : null;
      }
      if (columnKey.startsWith("payment_") && columnKey !== "payment_total") {
        // Reverse the payment column key back to a category name, then to id.
        const niceName = columnKey
          .replace("payment_", "")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        const cat = categories.find(
          (c) => c.name.toLowerCase() === niceName.toLowerCase(),
        );
        if (!cat) return null;
        const list =
          expensesByMonthCategoryRef.current.get(`${monthKey}:${cat.id}`) ?? [];
        return list.length
          ? list.map((expense) => ({ kind: "expense", expense }) as DrillDownItem)
          : null;
      }
      return null;
    },
    [categories],
  );

  return {
    rows,
    columnGroups,
    loading,
    categories,
    reload,
    updateEntry,
    removeEntry,
    drillDown,
  };
}
