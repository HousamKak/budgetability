import type { ManualEntry } from "@/types/spreadsheet.types";
import {
  type CurrencyCode,
  type CurrencySettings,
  type ExchangeRates,
  DEFAULT_RATES,
  convert,
  formatCurrency,
  getBaseCurrency,
  isCurrencyCode,
  toBase,
} from "./currency";
import { supabase } from "./supabase";

// ============================================
// DATA TYPES
// ============================================

// Category type - user-defined categories with colors and icons
export type Category = {
  id: string;
  name: string;
  color: string; // Hex code: "#ef4444"
  icon: string; // Lucide icon name: "shopping-cart"
  sortOrder: number;
  isDefault: boolean;
};

// Account type - for envelope budgeting
// Every account is denominated in one currency; its balance and the account
// side of every transaction are always in that currency (docs/currency-spec.md).
export type Account = {
  id: string;
  name: string;
  accountType: "checking" | "savings" | "credit" | "cash" | "other";
  currency: CurrencyCode;
  initialBalance: number;
  currentBalance: number;
  isDefault: boolean;
  color?: string;
  icon?: string;
  sortOrder: number;
  // Parent groups ("mother accounts") this account belongs to. An account can
  // be in several groups at once (overlapping aggregates). Populated on read;
  // empty/undefined = ungrouped.
  groupIds?: string[];
};

// Account ↔ group membership (many-to-many join row)
export type AccountGroupMember = {
  groupId: string;
  accountId: string;
};

// Where a forecast flow came from. Absent = a hand-written flow living in the
// forecast_flows table. Present = the flow is *derived* from a real record the
// user marked with "Show in Forecast"; it has no row of its own, so its amount,
// name and month always track the source.
export type ForecastSourceKind = "expense" | "plan" | "deposit" | "rule";

export type ForecastSource = {
  kind: ForecastSourceKind;
  id: string; // the source record's id (or the rule's id)
  monthKey: string; // the source's month, for routing edits back
};

// Turns a flow's amount from a number you typed into one computed per month
// from your real records — "total the expenses on these accounts". Present on a
// flow = that flow is computed; absent = an ordinary typed flow. Everything
// else about the flow (name, year, months, on/off) works exactly the same,
// which is what scopes a rule to the months you actually want it on.
export type ForecastRuleSource =
  | "expenses"
  | "deposits"
  | "plans"
  // Members are the records that point at this flow, hand-picked, rather than
  // whatever happens to match a filter.
  | "picked";
export type ForecastProjection =
  | "none" // future months contribute nothing (historical overlay)
  | "average"
  | "median"
  | "last"
  | "fixed";

// One expense as offered in the member picker, with enough context to choose
// it and to see whether it is already claimed elsewhere on the forecast.
export type PickableExpense = {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  note?: string;
  category?: string;
  accountId?: string;
  inForecast: boolean;
  forecastFlowId?: string;
};

export type ForecastRuleSpec = {
  source: ForecastRuleSource;
  accountIds: string[]; // empty = every account
  categoryIds: string[]; // empty = every category
  excludeLinked: boolean; // skip records already marked individually
  projection: ForecastProjection;
  projectionWindow: number; // months of history the projection learns from
  fixedValue?: number;
};

// Forecast flow type - a projected inflow/outflow across months of a year.
// Amounts are positive magnitudes (in real currency); `type` sets the sign.
// Uncertain flows carry a low/high range that produces best/worst scenarios.
export type ForecastFlow = {
  id: string;
  year: number;
  months: number[]; // 1..12
  type: "in" | "out";
  name?: string;
  uncertain: boolean;
  value?: number; // certain amount (magnitude)
  lowValue?: number; // uncertain low (magnitude)
  highValue?: number; // uncertain high (magnitude)
  isGhost: boolean; // hypothetical what-if
  enabled: boolean;
  sortOrder: number;
  source?: ForecastSource; // set only on linked (derived) flows
  // Present = this flow's amount is computed per month rather than typed.
  rule?: ForecastRuleSpec;
};

// Account Group type - a non-transactable "mother account" that groups several
// real accounts. Its balance is always derived (sum of member currentBalance).
export type AccountGroup = {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  sortOrder: number;
};

// Account Transaction type - tracks money movement.
// `amount` is native to the SOURCE account. On cross-currency transfers
// `toAmount` is the destination-side native amount; `baseAmount` snapshots the
// movement's value in the user's base currency at entry time.
export type AccountTransaction = {
  id: string;
  fromAccountId?: string;
  toAccountId?: string;
  amount: number;
  toAmount?: number;
  baseAmount?: number;
  transactionType:
    | "transfer"
    | "budget_allocation"
    | "savings_contribution"
    | "overdraft_coverage"
    | "deposit"
    | "expense";
  monthKey?: string;
  savingsGoalId?: string;
  note?: string;
  createdAt: string;
  // Forecast link (deposits only — see the 20260810 migration).
  inForecast?: boolean;
  forecastEnabled?: boolean;
  forecastFlowId?: string;
};

// Budget Allocation type - links accounts to monthly budgets
export type BudgetAllocation = {
  id: string;
  accountId: string;
  monthKey: string;
  amount: number;
};

// Savings Goal type - goals with images
export type SavingsGoal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  imageUrl?: string;
  deadline?: string;
  color?: string;
  isCompleted: boolean;
  completedAt?: string;
};

// Savings Contribution type - tracks money added to goals
export type SavingsContribution = {
  id: string;
  savingsGoalId: string;
  accountId: string;
  amount: number;
  note?: string;
  createdAt: string;
};

// Expense type - with optional categoryId for new system.
// `amount` is ALWAYS in the base currency (budget math). When the paying
// account is denominated differently, originalAmount/originalCurrency record
// what was physically paid — that native amount moves the account balance.
export type Expense = {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  originalAmount?: number;
  originalCurrency?: CurrencyCode;
  category?: string; // Legacy TEXT field
  categoryId?: string; // NEW: Reference to categories table
  accountId?: string; // Account this expense was paid from
  note?: string;
  // Forecast link: inForecast = shows on the Forecast page as an outflow in the
  // month of `date`; forecastEnabled = counted in the band (toggle, not removal).
  inForecast?: boolean;
  forecastEnabled?: boolean;
  // Set when this expense is one member of a grouped forecast line. Mutually
  // exclusive with inForecast — a record has exactly one home on the forecast.
  forecastFlowId?: string;
};

// Plan type - with optional categoryId for new system
export type PlanItem = {
  id: string;
  monthKey: string;
  weekIndex: number;
  amount: number;
  category?: string; // Legacy TEXT field
  categoryId?: string; // NEW: Reference to categories table
  accountId?: string; // Account this plan will be paid from when marked paid
  note?: string;
  targetDate?: string;
  // Forecast link: outflow in the month of `targetDate` (else `monthKey`).
  // Carried over to the expense created when the plan is marked paid.
  inForecast?: boolean;
  forecastEnabled?: boolean;
  forecastFlowId?: string;
};

export type DraftItem = {
  id: string;
  note: string;
  amount?: number;
  category?: string;
  categoryId?: string;
  accountId?: string;
  date?: string;
};

// Store type - localStorage structure
export type Store = {
  budgets: Record<string, number>;
  expenses: Record<string, Expense[]>;
  plans: Record<string, PlanItem[]>;
  drafts: DraftItem[];
  categories: Category[];
  accounts: Account[];
  accountGroups: AccountGroup[];
  accountGroupMembers: AccountGroupMember[];
  accountTransactions: AccountTransaction[];
  budgetAllocations: Record<string, BudgetAllocation[]>;
  savingsGoals: SavingsGoal[];
  savingsContributions: SavingsContribution[];
  spreadsheetEntries: ManualEntry[];
  forecastFlows: ForecastFlow[];
  settings: { baseCurrency: CurrencyCode };
  exchangeRates: ExchangeRates;
};

// Default categories seed data
export const DEFAULT_CATEGORIES: Omit<Category, "id">[] = [
  {
    name: "Groceries",
    color: "#22c55e",
    icon: "shopping-cart",
    sortOrder: 0,
    isDefault: true,
  },
  {
    name: "Household",
    color: "#8b5cf6",
    icon: "home",
    sortOrder: 1,
    isDefault: true,
  },
  {
    name: "Transport",
    color: "#3b82f6",
    icon: "car",
    sortOrder: 2,
    isDefault: true,
  },
  {
    name: "Eating Out",
    color: "#f97316",
    icon: "utensils",
    sortOrder: 3,
    isDefault: true,
  },
  {
    name: "Health",
    color: "#ef4444",
    icon: "heart-pulse",
    sortOrder: 4,
    isDefault: true,
  },
  {
    name: "Gifts",
    color: "#ec4899",
    icon: "gift",
    sortOrder: 5,
    isDefault: true,
  },
  {
    name: "Bills",
    color: "#eab308",
    icon: "receipt",
    sortOrder: 6,
    isDefault: true,
  },
  {
    name: "Other",
    color: "#6b7280",
    icon: "more-horizontal",
    sortOrder: 7,
    isDefault: true,
  },
];

// LocalStorage fallback
const STORAGE_KEY = "paper-budget-cartoon-v2"; // Bumped version for new schema

const defaultStore: Store = {
  budgets: {},
  expenses: {},
  plans: {},
  drafts: [],
  categories: [],
  accounts: [],
  accountGroups: [],
  accountGroupMembers: [],
  accountTransactions: [],
  budgetAllocations: {},
  savingsGoals: [],
  savingsContributions: [],
  spreadsheetEntries: [],
  forecastFlows: [],
  settings: { baseCurrency: "USD" },
  exchangeRates: { ...DEFAULT_RATES },
};

function loadStoreFromLocalStorage(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Try to migrate from old storage key
      const oldRaw = localStorage.getItem("paper-budget-cartoon-v1");
      if (oldRaw) {
        const oldParsed = JSON.parse(oldRaw);
        const migrated: Store = {
          budgets: oldParsed.budgets ?? {},
          expenses: oldParsed.expenses ?? {},
          plans: oldParsed.plans ?? {},
          drafts: oldParsed.drafts ?? [],
          categories: [],
          accounts: [],
          accountGroups: [],
          accountGroupMembers: [],
          accountTransactions: [],
          budgetAllocations: {},
          savingsGoals: [],
          savingsContributions: [],
          spreadsheetEntries: [],
          forecastFlows: [],
          settings: { baseCurrency: "USD" },
          exchangeRates: { ...DEFAULT_RATES },
        };
        saveStoreToLocalStorage(migrated);
        return migrated;
      }
      return { ...defaultStore };
    }
    const parsed = JSON.parse(raw) as Partial<Store>;
    const accounts = parsed.accounts ?? [];
    // Migrate any legacy single-membership (account.groupId) into the join list
    let members = parsed.accountGroupMembers ?? [];
    if (members.length === 0) {
      const legacy = (accounts as Array<Account & { groupId?: string }>)
        .filter((a) => a.groupId)
        .map((a) => ({ groupId: a.groupId as string, accountId: a.id }));
      if (legacy.length > 0) members = legacy;
    }
    return {
      budgets: parsed.budgets ?? {},
      expenses: parsed.expenses ?? {},
      plans: parsed.plans ?? {},
      drafts: parsed.drafts ?? [],
      categories: parsed.categories ?? [],
      // Accounts saved before multi-currency have no currency field: USD.
      accounts: accounts.map((a) => ({
        ...a,
        currency: isCurrencyCode(a.currency) ? a.currency : "USD",
      })),
      accountGroups: parsed.accountGroups ?? [],
      accountGroupMembers: members,
      accountTransactions: parsed.accountTransactions ?? [],
      budgetAllocations: parsed.budgetAllocations ?? {},
      savingsGoals: parsed.savingsGoals ?? [],
      savingsContributions: parsed.savingsContributions ?? [],
      spreadsheetEntries: parsed.spreadsheetEntries ?? [],
      forecastFlows: parsed.forecastFlows ?? [],
      settings: {
        baseCurrency: isCurrencyCode(parsed.settings?.baseCurrency)
          ? parsed.settings.baseCurrency
          : "USD",
      },
      exchangeRates: { ...DEFAULT_RATES, ...parsed.exchangeRates },
    };
  } catch {
    return { ...defaultStore };
  }
}

function saveStoreToLocalStorage(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// Data service class
export class DataService {
  private useSupabase: boolean;
  private localStore: Store;
  private seedPromise: Promise<void> | null = null;

  constructor() {
    this.useSupabase = !!supabase;
    this.localStore = loadStoreFromLocalStorage();
  }

  /** Ensures default categories are seeded exactly once. Safe to call from anywhere. */
  async ensureDefaults(): Promise<void> {
    if (!this.seedPromise) {
      this.seedPromise = this.seedDefaultCategories();
    }
    return this.seedPromise;
  }

  // Check if user is authenticated for Supabase operations
  private async getCurrentUser() {
    if (!supabase) return null;

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user) {
        return null;
      }
      return user;
    } catch (error) {
      console.warn("Error checking authentication:", error);
      return null;
    }
  }

  // Get authentication status
  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return !!user;
  }

  // ============================================
  // CURRENCY SETTINGS & EXCHANGE RATES
  // ============================================
  // Base currency denominates the planning domain (budgets, expenses, plans,
  // allocations, savings, forecast). Rates are units of currency per 1 USD;
  // unset rates fall back to DEFAULT_RATES so conversion always works.

  async getCurrencySettings(): Promise<CurrencySettings> {
    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (user) {
          const [settingsRes, ratesRes] = await Promise.all([
            supabase
              .from("user_settings")
              .select("base_currency")
              .eq("user_id", user.id)
              .maybeSingle(),
            supabase.from("exchange_rates").select("currency, rate"),
          ]);

          if (settingsRes.error) throw settingsRes.error;
          if (ratesRes.error) throw ratesRes.error;

          const baseCurrency = isCurrencyCode(settingsRes.data?.base_currency)
            ? settingsRes.data.base_currency
            : "USD";
          const rates: ExchangeRates = { USD: 1, ...DEFAULT_RATES };
          for (const row of ratesRes.data ?? []) {
            if (isCurrencyCode(row.currency) && Number(row.rate) > 0) {
              rates[row.currency] = Number(row.rate);
            }
          }

          // Mirror locally so offline sessions keep the same view.
          this.localStore.settings = { baseCurrency };
          this.localStore.exchangeRates = rates;
          saveStoreToLocalStorage(this.localStore);

          return { baseCurrency, rates };
        }
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    return {
      baseCurrency: this.localStore.settings?.baseCurrency ?? "USD",
      rates: { USD: 1, ...DEFAULT_RATES, ...this.localStore.exchangeRates },
    };
  }

  async setBaseCurrency(code: CurrencyCode): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase.from("user_settings").upsert({
          user_id: user.id,
          base_currency: code,
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.settings = { baseCurrency: code };
    saveStoreToLocalStorage(this.localStore);
  }

  async setExchangeRate(code: CurrencyCode, rate: number): Promise<void> {
    if (code === "USD") throw new Error("USD is the anchor; its rate is 1");
    if (!(rate > 0)) throw new Error("Rate must be positive");

    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase.from("exchange_rates").upsert({
          user_id: user.id,
          currency: code,
          rate,
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.exchangeRates = {
      ...this.localStore.exchangeRates,
      [code]: rate,
    };
    saveStoreToLocalStorage(this.localStore);
  }

  /** The currency an account is denominated in ("USD" when unknown). */
  private async accountCurrency(accountId?: string): Promise<CurrencyCode> {
    if (!accountId) return getBaseCurrency();
    const accounts = await this.getAccounts();
    return accounts.find((a) => a.id === accountId)?.currency ?? "USD";
  }

  // Budget operations
  async getBudget(monthKey: string): Promise<number> {
    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) {
          console.warn("User not authenticated, falling back to localStorage");
        } else {
          const { data, error } = await supabase
            .from("budgets")
            .select("amount")
            .eq("user_id", user.id)
            .eq("month_key", monthKey)
            .single();

          if (error && error.code !== "PGRST116") {
            console.error("Supabase budget fetch error:", error);
            throw error;
          }

          const budget = data?.amount ? Number(data.amount) : 0;
          console.log("Budget loaded from Supabase:", monthKey, budget);

          // Update local store to stay in sync
          this.localStore.budgets[monthKey] = budget;
          saveStoreToLocalStorage(this.localStore);

          return budget;
        }
      } catch (error) {
        // Do NOT overwrite the locally cached budget on unexpected errors —
        // just return the cached value for this call.
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }
    return this.localStore.budgets[monthKey] ?? 0;
  }

  async setBudget(monthKey: string, amount: number): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) {
          console.warn("User not authenticated, falling back to localStorage");
        } else {
          const { error } = await supabase.from("budgets").upsert(
            {
              month_key: monthKey,
              amount,
              user_id: user.id,
            },
            {
              onConflict: "user_id,month_key",
            },
          );

          if (error) {
            console.error("Supabase budget upsert error:", error);
            throw error;
          }
          console.log(
            "Budget successfully saved to Supabase:",
            monthKey,
            amount,
          );

          // Update local store to stay in sync with Supabase
          this.localStore.budgets[monthKey] = amount;
          saveStoreToLocalStorage(this.localStore);
          return;
        }
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.budgets[monthKey] = amount;
    saveStoreToLocalStorage(this.localStore);
  }

  // Expense operations
  async getExpenses(monthKey: string): Promise<Expense[]> {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("expenses")
          .select("*")
          .eq("month_key", monthKey)
          .order("date", { ascending: true });

        if (error) throw error;
        const expenses =
          data?.map((row) => ({
            id: row.id,
            date: row.date,
            amount: Number(row.amount),
            originalAmount:
              row.original_amount != null
                ? Number(row.original_amount)
                : undefined,
            originalCurrency: isCurrencyCode(row.original_currency)
              ? row.original_currency
              : undefined,
            category: row.category || undefined,
            categoryId: row.category_id || undefined,
            accountId: row.account_id || undefined,
            note: row.note || undefined,
            inForecast: !!row.in_forecast,
            forecastEnabled: row.forecast_enabled !== false,
            forecastFlowId: row.forecast_flow_id || undefined,
          })) || [];

        // Update local store to stay in sync
        this.localStore.expenses[monthKey] = expenses;
        saveStoreToLocalStorage(this.localStore);

        return expenses;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        return (this.localStore.expenses[monthKey] ?? [])
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date));
      }
    }

    return (this.localStore.expenses[monthKey] ?? [])
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async addExpense(monthKey: string, expense: Expense): Promise<void> {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (monthKey > currentMonthKey) {
      throw new Error(
        "Cannot add an expense for a future month — create a plan instead.",
      );
    }

    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) {
          console.warn("User not authenticated, falling back to localStorage");
        } else {
          const { error } = await supabase.from("expenses").insert({
            id: expense.id,
            user_id: user.id,
            month_key: monthKey,
            date: expense.date,
            amount: expense.amount,
            original_amount: expense.originalAmount ?? null,
            original_currency: expense.originalCurrency ?? null,
            category: expense.category,
            category_id: expense.categoryId || null,
            account_id: expense.accountId || null,
            note: expense.note,
            in_forecast: !!expense.inForecast,
            forecast_enabled: expense.forecastEnabled !== false,
          });

          if (error) throw error;

          // Deduct from account if specified — in the account's native
          // currency (originalAmount when the account isn't base-denominated).
          if (expense.accountId) {
            const txId = crypto.randomUUID();
            const { error: txError } = await supabase
              .from("account_transactions")
              .insert({
                id: txId,
                user_id: user.id,
                from_account_id: expense.accountId,
                amount: expense.originalAmount ?? expense.amount,
                base_amount: expense.amount,
                transaction_type: "expense",
                month_key: monthKey,
                note: expense.note || expense.category || "Expense",
              });
            if (txError) throw txError;
          }
          return;
        }
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    const list = this.localStore.expenses[monthKey]
      ? [...this.localStore.expenses[monthKey]]
      : [];
    list.push(expense);
    this.localStore.expenses[monthKey] = list;

    // Deduct from account if specified (native amount)
    if (expense.accountId) {
      const nativeAmount = expense.originalAmount ?? expense.amount;
      this.localStore.accounts = this.localStore.accounts.map((a) =>
        a.id === expense.accountId
          ? { ...a, currentBalance: a.currentBalance - nativeAmount }
          : a,
      );
      this.localStore.accountTransactions = [
        ...this.localStore.accountTransactions,
        {
          id: crypto.randomUUID(),
          fromAccountId: expense.accountId,
          amount: nativeAmount,
          baseAmount: expense.amount,
          transactionType: "expense",
          monthKey,
          note: expense.note || expense.category || "Expense",
          createdAt: new Date().toISOString(),
        },
      ];
    }

    saveStoreToLocalStorage(this.localStore);
  }

  async removeExpense(monthKey: string, id: string): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        // Fetch the expense first to check for accountId
        const { data: expenseData } = await supabase
          .from("expenses")
          .select("account_id, amount, original_amount, category, note")
          .eq("id", id)
          .single();

        const { error } = await supabase.from("expenses").delete().eq("id", id);
        if (error) throw error;

        // Refund the account if the expense was linked (native amount)
        if (expenseData?.account_id) {
          const user = await this.getCurrentUser();
          if (user) {
            const txId = crypto.randomUUID();
            const { error: txError } = await supabase
              .from("account_transactions")
              .insert({
                id: txId,
                user_id: user.id,
                to_account_id: expenseData.account_id,
                amount: Number(
                  expenseData.original_amount ?? expenseData.amount,
                ),
                base_amount: Number(expenseData.amount),
                transaction_type: "expense",
                month_key: monthKey,
                note: `Refund: ${expenseData.note || expenseData.category || "Expense deleted"}`,
              });
            if (txError) throw txError;
          }
        }
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    // Find the expense before removing to check for accountId
    const expense = (this.localStore.expenses[monthKey] ?? []).find(
      (x) => x.id === id,
    );

    const list = (this.localStore.expenses[monthKey] ?? []).filter(
      (x) => x.id !== id,
    );
    this.localStore.expenses[monthKey] = list;

    // Refund the account if the expense was linked (native amount)
    if (expense?.accountId) {
      const nativeAmount = expense.originalAmount ?? expense.amount;
      this.localStore.accounts = this.localStore.accounts.map((a) =>
        a.id === expense.accountId
          ? { ...a, currentBalance: a.currentBalance + nativeAmount }
          : a,
      );
      this.localStore.accountTransactions = [
        ...this.localStore.accountTransactions,
        {
          id: crypto.randomUUID(),
          toAccountId: expense.accountId,
          amount: nativeAmount,
          baseAmount: expense.amount,
          transactionType: "expense",
          monthKey,
          note: `Refund: ${expense.note || expense.category || "Expense deleted"}`,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    saveStoreToLocalStorage(this.localStore);
  }

  // Plan operations
  async getPlans(monthKey: string): Promise<PlanItem[]> {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("plans")
          .select("*")
          .eq("month_key", monthKey)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Supabase plans fetch error:", error);
          throw error;
        }
        console.log("Plans loaded from Supabase:", data?.length || 0, "items");
        const plans =
          data?.map((row) => ({
            id: row.id,
            monthKey: row.month_key,
            weekIndex: row.week_index,
            amount: Number(row.amount),
            category: row.category || undefined,
            accountId: row.account_id || undefined,
            note: row.note || undefined,
            targetDate: row.target_date || undefined,
            inForecast: !!row.in_forecast,
            forecastEnabled: row.forecast_enabled !== false,
            forecastFlowId: row.forecast_flow_id || undefined,
          })) || [];

        // Update local store to stay in sync
        this.localStore.plans[monthKey] = plans;
        saveStoreToLocalStorage(this.localStore);

        return plans;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        return this.localStore.plans[monthKey] ?? [];
      }
    }

    return this.localStore.plans[monthKey] ?? [];
  }

  async addPlan(monthKey: string, plan: PlanItem): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) {
          console.warn("User not authenticated, falling back to localStorage");
        } else {
          const { error } = await supabase.from("plans").insert({
            id: plan.id,
            user_id: user.id,
            month_key: monthKey,
            week_index: plan.weekIndex,
            amount: plan.amount,
            category: plan.category,
            account_id: plan.accountId || null,
            note: plan.note,
            target_date: plan.targetDate,
            in_forecast: !!plan.inForecast,
            forecast_enabled: plan.forecastEnabled !== false,
          });

          if (error) {
            console.error("Supabase plans insert error:", error);
            throw error;
          }
          console.log("Plan successfully saved to Supabase:", plan.id);
          return;
        }
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    const list = this.localStore.plans[monthKey]
      ? [...this.localStore.plans[monthKey]]
      : [];
    list.push(plan);
    this.localStore.plans[monthKey] = list;
    saveStoreToLocalStorage(this.localStore);
  }

  async updatePlan(
    monthKey: string,
    id: string,
    updates: Partial<PlanItem>,
  ): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const dbUpdates: any = {};
        if (updates.weekIndex !== undefined)
          dbUpdates.week_index = updates.weekIndex;
        if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
        if (updates.category !== undefined)
          dbUpdates.category = updates.category;
        if (updates.accountId !== undefined)
          dbUpdates.account_id = updates.accountId || null;
        if (updates.note !== undefined) dbUpdates.note = updates.note;
        if (updates.targetDate !== undefined)
          dbUpdates.target_date = updates.targetDate;
        if (updates.inForecast !== undefined) {
          dbUpdates.in_forecast = updates.inForecast;
          if (updates.inForecast) dbUpdates.forecast_flow_id = null;
        }
        if (updates.forecastEnabled !== undefined)
          dbUpdates.forecast_enabled = updates.forecastEnabled;

        const { error } = await supabase
          .from("plans")
          .update(dbUpdates)
          .eq("id", id);

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    const list = (this.localStore.plans[monthKey] ?? []).map((x) =>
      x.id === id ? { ...x, ...updates } : x,
    );
    this.localStore.plans[monthKey] = list;
    saveStoreToLocalStorage(this.localStore);
  }

  async removePlan(monthKey: string, id: string): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const { error } = await supabase.from("plans").delete().eq("id", id);

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    const list = (this.localStore.plans[monthKey] ?? []).filter(
      (x) => x.id !== id,
    );
    this.localStore.plans[monthKey] = list;
    saveStoreToLocalStorage(this.localStore);
  }

  async clearMonth(monthKey: string): Promise<void> {
    // First, refund all budget allocations for this month back to accounts.
    // Refunds are the natively-deducted snapshots, not rate conversions.
    const allocations = await this.getBudgetAllocations(monthKey);
    const refundNativeByAccount = new Map<string, number>();
    for (const alloc of allocations) {
      refundNativeByAccount.set(
        alloc.accountId,
        await this.netAllocatedNative(alloc.accountId, monthKey),
      );
    }

    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();

        // Refund each allocation back to its account
        for (const alloc of allocations) {
          const refundNative =
            refundNativeByAccount.get(alloc.accountId) ?? alloc.amount;
          if (refundNative > 0 && user) {
            const refundTxId = crypto.randomUUID();
            const { error: refundError } = await supabase
              .from("account_transactions")
              .insert({
                id: refundTxId,
                user_id: user.id,
                to_account_id: alloc.accountId,
                amount: refundNative,
                base_amount: alloc.amount,
                transaction_type: "budget_allocation",
                month_key: monthKey,
                note: "Month cleared - allocation refunded",
              });
            if (refundError) throw refundError;
          }
        }

        // Delete allocations, budgets, expenses, plans for this month
        await Promise.all([
          supabase
            .from("budget_allocations")
            .delete()
            .eq("month_key", monthKey),
          supabase.from("budgets").delete().eq("month_key", monthKey),
          supabase.from("expenses").delete().eq("month_key", monthKey),
          supabase.from("plans").delete().eq("month_key", monthKey),
        ]);
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    // Local: refund allocations back to accounts (native snapshot)
    for (const alloc of allocations) {
      const refundNative =
        refundNativeByAccount.get(alloc.accountId) ?? alloc.amount;
      if (refundNative > 0) {
        this.localStore.accounts = this.localStore.accounts.map((a) =>
          a.id === alloc.accountId
            ? { ...a, currentBalance: a.currentBalance + refundNative }
            : a,
        );

        // Record refund transaction
        this.localStore.accountTransactions = [
          ...this.localStore.accountTransactions,
          {
            id: crypto.randomUUID(),
            toAccountId: alloc.accountId,
            amount: refundNative,
            baseAmount: alloc.amount,
            transactionType: "budget_allocation",
            monthKey,
            note: "Month cleared - allocation refunded",
            createdAt: new Date().toISOString(),
          },
        ];
      }
    }

    // Clear allocations, budget, expenses, plans
    delete this.localStore.budgetAllocations[monthKey];
    this.localStore.budgets[monthKey] = 0;
    this.localStore.expenses[monthKey] = [];
    this.localStore.plans[monthKey] = [];
    saveStoreToLocalStorage(this.localStore);
  }

  // Draft operations
  async getDrafts(): Promise<DraftItem[]> {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("drafts")
          .select("*")
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Supabase drafts fetch error:", error);
          throw error;
        }
        console.log("Drafts loaded from Supabase:", data?.length || 0, "items");
        return (
          data?.map((row) => ({
            id: row.id,
            note: row.note,
            amount: row.amount ? Number(row.amount) : undefined,
            category: row.category || undefined,
            accountId: row.account_id || undefined,
            date: row.date || undefined,
          })) || []
        );
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        return this.localStore.drafts ?? [];
      }
    }

    return this.localStore.drafts ?? [];
  }

  async addDraft(draft: DraftItem): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) {
          console.warn("User not authenticated, falling back to localStorage");
        } else {
          const { error } = await supabase.from("drafts").insert({
            id: draft.id,
            user_id: user.id,
            note: draft.note,
            amount: draft.amount,
            category: draft.category,
            account_id: draft.accountId || null,
            date: draft.date,
          });

          if (error) {
            console.error("Supabase drafts insert error:", error);
            throw error;
          }
          console.log("Draft successfully saved to Supabase:", draft.id);
          return;
        }
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    const list = [...this.localStore.drafts];
    list.push(draft);
    this.localStore.drafts = list;
    saveStoreToLocalStorage(this.localStore);
  }

  async updateDraft(id: string, updates: Partial<DraftItem>): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const dbUpdates: any = {};
        if (updates.note !== undefined) dbUpdates.note = updates.note;
        if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
        if (updates.category !== undefined)
          dbUpdates.category = updates.category;
        if (updates.accountId !== undefined)
          dbUpdates.account_id = updates.accountId || null;
        if (updates.date !== undefined) dbUpdates.date = updates.date;

        const { error } = await supabase
          .from("drafts")
          .update(dbUpdates)
          .eq("id", id);

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    const list = this.localStore.drafts.map((x) =>
      x.id === id ? { ...x, ...updates } : x,
    );
    this.localStore.drafts = list;
    saveStoreToLocalStorage(this.localStore);
  }

  async removeDraft(id: string): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const { error } = await supabase.from("drafts").delete().eq("id", id);

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    const list = this.localStore.drafts.filter((x) => x.id !== id);
    this.localStore.drafts = list;
    saveStoreToLocalStorage(this.localStore);
  }

  async clearAllDrafts(): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase
          .from("drafts")
          .delete()
          .eq("user_id", user.id); // Delete all of this user's drafts

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.drafts = [];
    saveStoreToLocalStorage(this.localStore);
  }

  // ============================================
  // EXPENSE UPDATE (Previously missing)
  // ============================================
  async updateExpense(
    monthKey: string,
    id: string,
    updates: Partial<Expense>,
  ): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        // Fetch old expense to handle account balance adjustments
        const { data: oldExpense } = await supabase
          .from("expenses")
          .select("account_id, amount, original_amount")
          .eq("id", id)
          .single();

        const dbUpdates: Record<string, unknown> = {};
        if (updates.amount !== undefined) {
          dbUpdates.amount = updates.amount;
          // An amount edit re-denominates the expense: callers send the
          // original* pair alongside it (undefined = entered in base), so a
          // missing pair must CLEAR any stale native snapshot, not keep it.
          dbUpdates.original_amount = updates.originalAmount ?? null;
          dbUpdates.original_currency = updates.originalCurrency ?? null;
        }
        if (updates.category !== undefined)
          dbUpdates.category = updates.category;
        if (updates.categoryId !== undefined)
          dbUpdates.category_id = updates.categoryId;
        if (updates.accountId !== undefined)
          dbUpdates.account_id = updates.accountId || null;
        if (updates.note !== undefined) dbUpdates.note = updates.note;
        if (updates.date !== undefined) dbUpdates.date = updates.date;
        if (updates.inForecast !== undefined) {
          dbUpdates.in_forecast = updates.inForecast;
          // A record has one home on the forecast, and the DB enforces it.
          // Marking one individually takes it out of whatever group held it.
          if (updates.inForecast) dbUpdates.forecast_flow_id = null;
        }
        if (updates.forecastEnabled !== undefined)
          dbUpdates.forecast_enabled = updates.forecastEnabled;

        const { error } = await supabase
          .from("expenses")
          .update(dbUpdates)
          .eq("id", id);

        if (error) throw error;

        // Handle account balance adjustments (native amounts on each side)
        const user = await this.getCurrentUser();
        if (user && oldExpense) {
          const oldAccountId = oldExpense.account_id;
          const oldBase = Number(oldExpense.amount);
          const oldNative = Number(oldExpense.original_amount ?? oldExpense.amount);
          const newAccountId = updates.accountId !== undefined ? updates.accountId : oldAccountId;
          const newBase = updates.amount !== undefined ? updates.amount : oldBase;
          const newNative =
            updates.originalAmount !== undefined
              ? (updates.originalAmount ?? newBase)
              : updates.amount !== undefined
                ? updates.amount
                : oldNative;

          // Refund old account
          if (oldAccountId) {
            const { error: refundTxError } = await supabase
              .from("account_transactions")
              .insert({
                id: crypto.randomUUID(),
                user_id: user.id,
                to_account_id: oldAccountId,
                amount: oldNative,
                base_amount: oldBase,
                transaction_type: "expense",
                month_key: monthKey,
                note: "Expense updated - old amount refunded",
              });
            if (refundTxError) throw refundTxError;
          }
          // Deduct from new account
          if (newAccountId) {
            const { error: deductTxError } = await supabase
              .from("account_transactions")
              .insert({
                id: crypto.randomUUID(),
                user_id: user.id,
                from_account_id: newAccountId,
                amount: newNative,
                base_amount: newBase,
                transaction_type: "expense",
                month_key: monthKey,
                note: "Expense updated - new amount deducted",
              });
            if (deductTxError) throw deductTxError;
          }
        }
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    const oldExpense = (this.localStore.expenses[monthKey] ?? []).find(
      (x) => x.id === id,
    );

    // Mirror the DB semantics: an amount edit without an original* pair means
    // the entry is base-denominated, so any stale native snapshot is cleared.
    const normalizedUpdates =
      updates.amount !== undefined
        ? {
            originalAmount: undefined,
            originalCurrency: undefined,
            ...updates,
          }
        : updates;

    const list = (this.localStore.expenses[monthKey] ?? []).map((x) =>
      x.id === id ? { ...x, ...normalizedUpdates } : x,
    );
    this.localStore.expenses[monthKey] = list;

    // Handle account balance adjustments for localStorage (native amounts)
    if (oldExpense) {
      const oldAccountId = oldExpense.accountId;
      const oldNative = oldExpense.originalAmount ?? oldExpense.amount;
      const newAccountId = updates.accountId !== undefined ? updates.accountId : oldAccountId;
      const newBase = updates.amount !== undefined ? updates.amount : oldExpense.amount;
      const newNative =
        updates.originalAmount !== undefined
          ? (updates.originalAmount ?? newBase)
          : updates.amount !== undefined
            ? updates.amount
            : oldNative;

      // Refund old account
      if (oldAccountId) {
        this.localStore.accounts = this.localStore.accounts.map((a) =>
          a.id === oldAccountId
            ? { ...a, currentBalance: a.currentBalance + oldNative }
            : a,
        );
      }
      // Deduct from new account
      if (newAccountId) {
        this.localStore.accounts = this.localStore.accounts.map((a) =>
          a.id === newAccountId
            ? { ...a, currentBalance: a.currentBalance - newNative }
            : a,
        );
      }
    }

    saveStoreToLocalStorage(this.localStore);
  }

  // ============================================
  // CATEGORY OPERATIONS
  // ============================================
  async getCategories(): Promise<Category[]> {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("categories")
          .select("*")
          .order("sort_order", { ascending: true });

        if (error) throw error;

        const categories =
          data?.map((row) => ({
            id: row.id,
            name: row.name,
            color: row.color,
            icon: row.icon,
            sortOrder: row.sort_order,
            isDefault: row.is_default,
          })) || [];

        // Update local store
        this.localStore.categories = categories;
        saveStoreToLocalStorage(this.localStore);

        return categories;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    return this.localStore.categories ?? [];
  }

  async addCategory(category: Omit<Category, "id">): Promise<Category> {
    const id = crypto.randomUUID();
    const newCategory: Category = { id, ...category };

    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) {
          console.warn("User not authenticated, falling back to localStorage");
        } else {
          const { error } = await supabase.from("categories").insert({
            id,
            user_id: user.id,
            name: category.name,
            color: category.color,
            icon: category.icon,
            sort_order: category.sortOrder,
            is_default: category.isDefault,
          });

          if (error) throw error;
          return newCategory;
        }
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.categories = [...this.localStore.categories, newCategory];
    saveStoreToLocalStorage(this.localStore);
    return newCategory;
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.color !== undefined) dbUpdates.color = updates.color;
        if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
        if (updates.sortOrder !== undefined)
          dbUpdates.sort_order = updates.sortOrder;

        const { error } = await supabase
          .from("categories")
          .update(dbUpdates)
          .eq("id", id);

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.categories = this.localStore.categories.map((c) =>
      c.id === id ? { ...c, ...updates } : c,
    );
    saveStoreToLocalStorage(this.localStore);
  }

  async reorderCategories(orderedIds: string[]): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        // Apply new sort_order based on the array index.
        await Promise.all(
          orderedIds.map((id, index) =>
            supabase!
              .from("categories")
              .update({ sort_order: index })
              .eq("id", id),
          ),
        );
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    const indexById = new Map(orderedIds.map((id, idx) => [id, idx]));
    this.localStore.categories = this.localStore.categories
      .map((c) =>
        indexById.has(c.id) ? { ...c, sortOrder: indexById.get(c.id)! } : c,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);
    saveStoreToLocalStorage(this.localStore);
  }

  async removeCategory(id: string): Promise<void> {
    // Name is needed to also clear legacy text-only references (expenses that
    // carry the category name but no categoryId).
    const removedName = this.localStore.categories.find((c) => c.id === id)?.name;

    if (this.useSupabase && supabase) {
      try {
        // Detach expenses BEFORE deleting the category so none are left with a
        // dangling reference (which would make them silently uncategorized in
        // an uncontrolled way, and could trip a FK constraint on delete).
        const { error: idErr } = await supabase
          .from("expenses")
          .update({ category_id: null })
          .eq("category_id", id);
        if (idErr) throw idErr;

        if (removedName) {
          const { error: nameErr } = await supabase
            .from("expenses")
            .update({ category: null })
            .eq("category", removedName)
            .is("category_id", null);
          if (nameErr) throw nameErr;
        }

        const { error } = await supabase
          .from("categories")
          .delete()
          .eq("id", id);

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    // Detach references in every month's expense list, then drop the category.
    for (const monthKey of Object.keys(this.localStore.expenses)) {
      this.localStore.expenses[monthKey] = this.localStore.expenses[monthKey].map(
        (e) => {
          if (e.categoryId === id) return { ...e, categoryId: undefined };
          if (!e.categoryId && removedName && e.category === removedName)
            return { ...e, category: undefined };
          return e;
        },
      );
    }
    this.localStore.categories = this.localStore.categories.filter(
      (c) => c.id !== id,
    );
    saveStoreToLocalStorage(this.localStore);
  }

  async seedDefaultCategories(): Promise<void> {
    const existing = await this.getCategories();

    // Only add default categories that don't already exist
    const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));
    const missingCategories = DEFAULT_CATEGORIES.filter(
      (cat) => !existingNames.has(cat.name.toLowerCase()),
    );
    for (const cat of missingCategories) {
      await this.addCategory(cat);
    }
  }

  // ============================================
  // ACCOUNT OPERATIONS
  // ============================================
  async getAccounts(): Promise<Account[]> {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("accounts")
          .select("*")
          .order("sort_order", { ascending: true });

        if (error) throw error;

        const members = await this.getAccountGroupMembers();
        const groupsByAccount = new Map<string, string[]>();
        for (const m of members) {
          const list = groupsByAccount.get(m.accountId) ?? [];
          list.push(m.groupId);
          groupsByAccount.set(m.accountId, list);
        }

        const accounts =
          data?.map((row) => ({
            id: row.id,
            name: row.name,
            accountType: row.account_type as Account["accountType"],
            currency: isCurrencyCode(row.currency) ? row.currency : "USD",
            initialBalance: Number(row.initial_balance),
            currentBalance: Number(row.current_balance),
            isDefault: row.is_default,
            color: row.color || undefined,
            icon: row.icon || undefined,
            sortOrder: row.sort_order,
            groupIds: groupsByAccount.get(row.id) ?? [],
          })) || [];

        this.localStore.accounts = accounts;
        saveStoreToLocalStorage(this.localStore);

        return accounts;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    // Local: attach groupIds from the membership list
    const members = this.localStore.accountGroupMembers ?? [];
    return (this.localStore.accounts ?? []).map((a) => ({
      ...a,
      currency: isCurrencyCode(a.currency) ? a.currency : "USD",
      groupIds: members
        .filter((m) => m.accountId === a.id)
        .map((m) => m.groupId),
    }));
  }

  async addAccount(
    account: Omit<Account, "id" | "currentBalance">,
  ): Promise<Account> {
    const id = crypto.randomUUID();
    const newAccount: Account = {
      id,
      ...account,
      currentBalance: account.initialBalance, // Start with initial balance
    };

    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) {
          console.warn("User not authenticated, falling back to localStorage");
        } else {
          const { error } = await supabase.from("accounts").insert({
            id,
            user_id: user.id,
            name: account.name,
            account_type: account.accountType,
            currency: account.currency,
            initial_balance: account.initialBalance,
            current_balance: account.initialBalance,
            is_default: account.isDefault,
            color: account.color,
            icon: account.icon,
            sort_order: account.sortOrder,
          });

          if (error) throw error;
          return newAccount;
        }
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.accounts = [...this.localStore.accounts, newAccount];
    saveStoreToLocalStorage(this.localStore);
    return newAccount;
  }

  async updateAccount(id: string, updates: Partial<Account>): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.accountType !== undefined)
          dbUpdates.account_type = updates.accountType;
        if (updates.currency !== undefined)
          dbUpdates.currency = updates.currency;
        if (updates.initialBalance !== undefined)
          dbUpdates.initial_balance = updates.initialBalance;
        if (updates.currentBalance !== undefined)
          dbUpdates.current_balance = updates.currentBalance;
        if (updates.isDefault !== undefined)
          dbUpdates.is_default = updates.isDefault;
        if (updates.color !== undefined) dbUpdates.color = updates.color;
        if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
        if (updates.sortOrder !== undefined)
          dbUpdates.sort_order = updates.sortOrder;

        const { error } = await supabase
          .from("accounts")
          .update(dbUpdates)
          .eq("id", id);

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.accounts = this.localStore.accounts.map((a) =>
      a.id === id ? { ...a, ...updates } : a,
    );
    saveStoreToLocalStorage(this.localStore);
  }

  async removeAccount(id: string): Promise<void> {
    // First, refund all budget allocations that reference this account
    const allAccountAllocations =
      await this.getAllBudgetAllocationsForAccount(id);
    for (const alloc of allAccountAllocations) {
      try {
        await this.removeBudgetAllocation(alloc.accountId, alloc.monthKey);
      } catch (e) {
        console.warn("Failed to remove allocation during account deletion:", e);
      }
    }

    if (this.useSupabase && supabase) {
      try {
        // CASCADE will remove budget_allocations, but we already refunded above
        const { error } = await supabase.from("accounts").delete().eq("id", id);

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    // Remove the account
    this.localStore.accounts = this.localStore.accounts.filter(
      (a) => a.id !== id,
    );

    // Remove its group memberships (DB cascades; mirror locally)
    this.localStore.accountGroupMembers = (
      this.localStore.accountGroupMembers ?? []
    ).filter((m) => m.accountId !== id);

    // Clean up any remaining orphaned allocations in all months
    for (const monthKey of Object.keys(this.localStore.budgetAllocations)) {
      this.localStore.budgetAllocations[monthKey] = (
        this.localStore.budgetAllocations[monthKey] ?? []
      ).filter((a) => a.accountId !== id);
    }

    saveStoreToLocalStorage(this.localStore);
  }

  async setDefaultAccount(id: string): Promise<void> {
    // Unset all defaults first, then set the new one
    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error("Not authenticated");

        // The database trigger handles unsetting other defaults
        const { error } = await supabase
          .from("accounts")
          .update({ is_default: true })
          .eq("id", id);

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.accounts = this.localStore.accounts.map((a) => ({
      ...a,
      isDefault: a.id === id,
    }));
    saveStoreToLocalStorage(this.localStore);
  }

  async getDefaultAccount(): Promise<Account | null> {
    const accounts = await this.getAccounts();
    return accounts.find((a) => a.isDefault) || accounts[0] || null;
  }

  // ============================================
  // ACCOUNT GROUP OPERATIONS ("mother accounts")
  // ============================================
  async getAccountGroups(): Promise<AccountGroup[]> {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("account_groups")
          .select("*")
          .order("sort_order", { ascending: true });

        if (error) throw error;

        const groups =
          (data as Array<Record<string, unknown>> | null)?.map((row) => ({
            id: row.id as string,
            name: row.name as string,
            color: (row.color as string) || undefined,
            icon: (row.icon as string) || undefined,
            sortOrder: (row.sort_order as number) ?? 0,
          })) || [];

        this.localStore.accountGroups = groups;
        saveStoreToLocalStorage(this.localStore);

        return groups;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    return this.localStore.accountGroups ?? [];
  }

  async addAccountGroup(
    group: Omit<AccountGroup, "id">,
  ): Promise<AccountGroup> {
    const id = crypto.randomUUID();
    const newGroup: AccountGroup = { id, ...group };

    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) {
          console.warn("User not authenticated, falling back to localStorage");
        } else {
          const { error } = await supabase.from("account_groups").insert({
            id,
            user_id: user.id,
            name: group.name,
            color: group.color,
            icon: group.icon,
            sort_order: group.sortOrder,
          } as never);

          if (error) throw error;
          return newGroup;
        }
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.accountGroups = [
      ...this.localStore.accountGroups,
      newGroup,
    ];
    saveStoreToLocalStorage(this.localStore);
    return newGroup;
  }

  async updateAccountGroup(
    id: string,
    updates: Partial<Omit<AccountGroup, "id">>,
  ): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.color !== undefined) dbUpdates.color = updates.color;
        if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
        if (updates.sortOrder !== undefined)
          dbUpdates.sort_order = updates.sortOrder;

        const { error } = await supabase
          .from("account_groups")
          .update(dbUpdates as never)
          .eq("id", id);

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.accountGroups = this.localStore.accountGroups.map((g) =>
      g.id === id ? { ...g, ...updates } : g,
    );
    saveStoreToLocalStorage(this.localStore);
  }

  // Deleting a group never deletes its accounts — only its membership rows are
  // removed (DB FK cascades; mirrored locally below).
  async removeAccountGroup(id: string): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const { error } = await supabase
          .from("account_groups")
          .delete()
          .eq("id", id);

        if (error) throw error;
        // FK ON DELETE CASCADE already removed membership rows in the DB.
        this.localStore.accountGroups = this.localStore.accountGroups.filter(
          (g) => g.id !== id,
        );
        this.localStore.accountGroupMembers =
          this.localStore.accountGroupMembers.filter((m) => m.groupId !== id);
        saveStoreToLocalStorage(this.localStore);
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.accountGroups = this.localStore.accountGroups.filter(
      (g) => g.id !== id,
    );
    this.localStore.accountGroupMembers =
      this.localStore.accountGroupMembers.filter((m) => m.groupId !== id);
    saveStoreToLocalStorage(this.localStore);
  }

  // ============================================
  // ACCOUNT ↔ GROUP MEMBERSHIP (many-to-many)
  // ============================================
  async getAccountGroupMembers(): Promise<AccountGroupMember[]> {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("account_group_members")
          .select("group_id, account_id");

        if (error) throw error;

        const members =
          (data as Array<Record<string, unknown>> | null)?.map((row) => ({
            groupId: row.group_id as string,
            accountId: row.account_id as string,
          })) || [];

        this.localStore.accountGroupMembers = members;
        saveStoreToLocalStorage(this.localStore);
        return members;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    return this.localStore.accountGroupMembers ?? [];
  }

  // Add an account to a group (no-op if already a member).
  async addAccountToGroup(accountId: string, groupId: string): Promise<void> {
    const exists = (this.localStore.accountGroupMembers ?? []).some(
      (m) => m.accountId === accountId && m.groupId === groupId,
    );

    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase
          .from("account_group_members")
          .upsert(
            {
              user_id: user.id,
              group_id: groupId,
              account_id: accountId,
            },
            { onConflict: "group_id,account_id", ignoreDuplicates: true },
          );

        if (error) throw error;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    if (!exists) {
      this.localStore.accountGroupMembers = [
        ...(this.localStore.accountGroupMembers ?? []),
        { accountId, groupId },
      ];
      saveStoreToLocalStorage(this.localStore);
    }
  }

  // Remove an account from a single group.
  async removeAccountFromGroup(
    accountId: string,
    groupId: string,
  ): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const { error } = await supabase
          .from("account_group_members")
          .delete()
          .eq("account_id", accountId)
          .eq("group_id", groupId);

        if (error) throw error;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.accountGroupMembers = (
      this.localStore.accountGroupMembers ?? []
    ).filter((m) => !(m.accountId === accountId && m.groupId === groupId));
    saveStoreToLocalStorage(this.localStore);
  }

  // Replace the full set of groups an account belongs to.
  async setAccountGroups(
    accountId: string,
    groupIds: string[],
  ): Promise<void> {
    const desired = new Set(groupIds);
    const current = new Set(
      (this.localStore.accountGroupMembers ?? [])
        .filter((m) => m.accountId === accountId)
        .map((m) => m.groupId),
    );
    const toAdd = groupIds.filter((g) => !current.has(g));
    const toRemove = [...current].filter((g) => !desired.has(g));

    for (const g of toAdd) await this.addAccountToGroup(accountId, g);
    for (const g of toRemove) await this.removeAccountFromGroup(accountId, g);
  }

  // Detach an account from every group it belongs to.
  async removeAccountFromAllGroups(accountId: string): Promise<void> {
    await this.setAccountGroups(accountId, []);
  }

  // A deposit is this app's only "income" event. `inForecast` marks it to show
  // up on the Forecast page as an inflow in the month it was recorded.
  async depositToAccount(
    accountId: string,
    amount: number,
    note?: string,
    inForecast = false,
  ): Promise<void> {
    const id = crypto.randomUUID();
    // `amount` is native to the account; snapshot its base value for totals.
    const currency = await this.accountCurrency(accountId);
    const baseAmount = toBase(amount, currency);
    const transaction: AccountTransaction = {
      id,
      toAccountId: accountId,
      amount,
      baseAmount,
      transactionType: "deposit",
      note,
      createdAt: new Date().toISOString(),
      inForecast,
      forecastEnabled: true,
    };

    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error("Not authenticated");

        // Insert transaction (trigger will update balance)
        const { error } = await supabase.from("account_transactions").insert({
          id,
          user_id: user.id,
          to_account_id: accountId,
          amount,
          base_amount: baseAmount,
          transaction_type: "deposit",
          note,
          in_forecast: inForecast,
          forecast_enabled: true,
        });

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    // Update local balance
    this.localStore.accounts = this.localStore.accounts.map((a) =>
      a.id === accountId
        ? { ...a, currentBalance: a.currentBalance + amount }
        : a,
    );
    this.localStore.accountTransactions = [
      ...this.localStore.accountTransactions,
      transaction,
    ];
    saveStoreToLocalStorage(this.localStore);
  }

  // ============================================
  // TRANSACTION OPERATIONS
  // ============================================
  async transferBetweenAccounts(
    fromId: string,
    toId: string,
    amount: number,
    note?: string,
    // Destination-side amount for cross-currency transfers. The dialog
    // pre-fills it from the rate table but the user can override it (street
    // rates differ), so whatever arrives here is the effective conversion.
    toAmount?: number,
  ): Promise<void> {
    const id = crypto.randomUUID();
    const [fromCurrency, toCurrency] = await Promise.all([
      this.accountCurrency(fromId),
      this.accountCurrency(toId),
    ]);
    const crossCurrency = fromCurrency !== toCurrency;
    const destinationAmount = crossCurrency
      ? (toAmount ?? convert(amount, fromCurrency, toCurrency))
      : undefined;
    const baseAmount = toBase(amount, fromCurrency);
    const transaction: AccountTransaction = {
      id,
      fromAccountId: fromId,
      toAccountId: toId,
      amount,
      toAmount: destinationAmount,
      baseAmount,
      transactionType: "transfer",
      note,
      createdAt: new Date().toISOString(),
    };

    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error("Not authenticated");

        // Insert transaction (trigger will update balances)
        const { error } = await supabase.from("account_transactions").insert({
          id,
          user_id: user.id,
          from_account_id: fromId,
          to_account_id: toId,
          amount,
          to_amount: destinationAmount ?? null,
          base_amount: baseAmount,
          transaction_type: "transfer",
          note,
        });

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    // Update local balances
    this.localStore.accounts = this.localStore.accounts.map((a) => {
      if (a.id === fromId)
        return { ...a, currentBalance: a.currentBalance - amount };
      if (a.id === toId)
        return {
          ...a,
          currentBalance: a.currentBalance + (destinationAmount ?? amount),
        };
      return a;
    });
    this.localStore.accountTransactions = [
      ...this.localStore.accountTransactions,
      transaction,
    ];
    saveStoreToLocalStorage(this.localStore);
  }

  // `amount` is native to the account (what leaves it); the allocation row is
  // denominated in the base currency, converted at the current rate.
  async allocateToBudget(
    accountId: string,
    monthKey: string,
    amount: number,
  ): Promise<void> {
    if (amount <= 0) throw new Error("Allocation amount must be positive");

    // Validate sufficient balance
    const accounts = this.useSupabase
      ? await this.getAccounts()
      : this.localStore.accounts;
    const account = accounts.find((a) => a.id === accountId);
    if (!account) throw new Error("Account not found");
    if (amount > account.currentBalance) {
      throw new Error(
        `Insufficient balance: ${account.name} has ${formatCurrency(account.currentBalance, account.currency)} but tried to allocate ${formatCurrency(amount, account.currency)}`,
      );
    }

    const baseAmount = toBase(amount, account.currency);
    const transactionId = crypto.randomUUID();
    const allocationId = crypto.randomUUID();

    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error("Not authenticated");

        // Check for existing allocation for this account+month
        const existingAllocations = await this.getBudgetAllocations(monthKey);
        const existing = existingAllocations.find(
          (a) => a.accountId === accountId,
        );

        if (existing) {
          // Already has allocation - delegate to updateBudgetAllocation
          // which correctly handles the difference (in base currency)
          await this.updateBudgetAllocation(
            accountId,
            monthKey,
            existing.amount + baseAmount,
          );
          return;
        }

        // Create new allocation FIRST (INSERT not UPSERT to avoid replacing)
        // so the balance-mutating transaction only happens once the
        // allocation row exists.
        const { error: allocError } = await supabase
          .from("budget_allocations")
          .insert({
            id: allocationId,
            user_id: user.id,
            account_id: accountId,
            month_key: monthKey,
            amount: baseAmount,
          });

        if (allocError) throw allocError;

        // Create transaction (trigger will update account balance)
        const { error: txError } = await supabase
          .from("account_transactions")
          .insert({
            id: transactionId,
            user_id: user.id,
            from_account_id: accountId,
            amount,
            base_amount: baseAmount,
            transaction_type: "budget_allocation",
            month_key: monthKey,
          });

        if (txError) throw txError;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    // Deduct from account balance
    this.localStore.accounts = this.localStore.accounts.map((a) =>
      a.id === accountId
        ? { ...a, currentBalance: a.currentBalance - amount }
        : a,
    );

    // Update or create allocation (base currency)
    const allocations = this.localStore.budgetAllocations[monthKey] ?? [];
    const existingIdx = allocations.findIndex((a) => a.accountId === accountId);
    if (existingIdx >= 0) {
      allocations[existingIdx] = {
        ...allocations[existingIdx],
        amount: allocations[existingIdx].amount + baseAmount,
      };
    } else {
      allocations.push({
        id: allocationId,
        accountId,
        monthKey,
        amount: baseAmount,
      });
    }
    this.localStore.budgetAllocations[monthKey] = allocations;

    // Record transaction
    this.localStore.accountTransactions = [
      ...this.localStore.accountTransactions,
      {
        id: transactionId,
        fromAccountId: accountId,
        amount,
        baseAmount,
        transactionType: "budget_allocation",
        monthKey,
        createdAt: new Date().toISOString(),
      },
    ];

    saveStoreToLocalStorage(this.localStore);
  }

  async getBudgetAllocations(monthKey: string): Promise<BudgetAllocation[]> {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("budget_allocations")
          .select("*")
          .eq("month_key", monthKey);

        if (error) throw error;

        return (
          data?.map((row) => ({
            id: row.id,
            accountId: row.account_id,
            monthKey: row.month_key,
            amount: Number(row.amount),
          })) || []
        );
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    return this.localStore.budgetAllocations[monthKey] ?? [];
  }

  async getTotalAllocatedBudget(monthKey: string): Promise<number> {
    const allocations = await this.getBudgetAllocations(monthKey);
    return allocations.reduce((sum, a) => sum + a.amount, 0);
  }

  /**
   * Get all budget allocations for a specific account across all months.
   * Used to show on AccountCard how much is committed from this account.
   */
  async getAllBudgetAllocationsForAccount(
    accountId: string,
  ): Promise<BudgetAllocation[]> {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("budget_allocations")
          .select("*")
          .eq("account_id", accountId);

        if (error) throw error;

        return (
          data?.map((row) => ({
            id: row.id,
            accountId: row.account_id,
            monthKey: row.month_key,
            amount: Number(row.amount),
          })) || []
        );
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    // Local: scan all months for allocations from this account
    const results: BudgetAllocation[] = [];
    for (const [, allocations] of Object.entries(
      this.localStore.budgetAllocations,
    )) {
      for (const alloc of allocations) {
        if (alloc.accountId === accountId) {
          results.push(alloc);
        }
      }
    }
    return results;
  }

  /**
   * Get all budget allocations across all months (for all accounts).
   * Used on Accounts page to show allocated amounts per account.
   */
  async getAllBudgetAllocations(): Promise<BudgetAllocation[]> {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("budget_allocations")
          .select("*");

        if (error) throw error;

        return (
          data?.map((row) => ({
            id: row.id,
            accountId: row.account_id,
            monthKey: row.month_key,
            amount: Number(row.amount),
          })) || []
        );
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    const results: BudgetAllocation[] = [];
    for (const [, allocations] of Object.entries(
      this.localStore.budgetAllocations,
    )) {
      results.push(...allocations);
    }
    return results;
  }

  // Net native amount this account has put into a month's budget, computed
  // from its budget_allocation transactions (deducts minus refunds). Exact
  // snapshot — never depends on the current rate table.
  private async netAllocatedNative(
    accountId: string,
    monthKey: string,
  ): Promise<number> {
    const txs = await this.getAllocationTransactions(accountId, monthKey);
    let net = 0;
    for (const t of txs) {
      if (t.transactionType !== "budget_allocation") continue;
      if (t.fromAccountId === accountId) net += t.amount;
      if (t.toAccountId === accountId) net -= t.amount;
    }
    return Math.round(net * 100) / 100;
  }

  // `newAmount` is in the BASE currency (allocations are base-denominated).
  // Increases deduct the account at the current rate; decreases refund
  // proportionally from the natively-deducted snapshot, so refunds return
  // exactly what was taken regardless of rate changes since.
  async updateBudgetAllocation(
    accountId: string,
    monthKey: string,
    newAmount: number,
  ): Promise<void> {
    const account = (await this.getAccounts()).find(
      (a) => a.id === accountId,
    );
    if (!account) throw new Error("Account not found");

    // Native movement for a base-currency difference.
    const nativeForDiff = async (diffBase: number, currentBase: number) => {
      if (diffBase > 0) {
        return convert(diffBase, getBaseCurrency(), account.currency);
      }
      const netNative = await this.netAllocatedNative(accountId, monthKey);
      if (currentBase <= 0 || netNative <= 0) {
        return convert(-diffBase, getBaseCurrency(), account.currency);
      }
      const fraction = Math.min(1, -diffBase / currentBase);
      return Math.round(netNative * fraction * 100) / 100;
    };

    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error("Not authenticated");

        // Get the current allocation to calculate the difference
        const allocations = await this.getBudgetAllocations(monthKey);
        const currentAllocation = allocations.find(
          (a) => a.accountId === accountId,
        );
        const currentAmount = currentAllocation?.amount ?? 0;
        const amountDifference = newAmount - currentAmount;
        const nativeAmount = await nativeForDiff(
          amountDifference,
          currentAmount,
        );

        // Update the allocation
        const { error: allocError } = await supabase
          .from("budget_allocations")
          .update({ amount: newAmount })
          .eq("account_id", accountId)
          .eq("month_key", monthKey);

        if (allocError) throw allocError;

        // Create a transaction for the difference (if any)
        if (amountDifference !== 0 && nativeAmount > 0) {
          const transactionId = crypto.randomUUID();
          const { error: txError } = await supabase
            .from("account_transactions")
            .insert({
              id: transactionId,
              user_id: user.id,
              from_account_id: amountDifference > 0 ? accountId : null,
              to_account_id: amountDifference < 0 ? accountId : null,
              amount: nativeAmount,
              base_amount: Math.abs(amountDifference),
              transaction_type: "budget_allocation",
              month_key: monthKey,
              note:
                amountDifference > 0
                  ? "Allocation increased"
                  : "Allocation decreased",
            });

          if (txError) throw txError;
        }

        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    // Local storage fallback
    const allocations = this.localStore.budgetAllocations[monthKey] ?? [];
    const existingIdx = allocations.findIndex((a) => a.accountId === accountId);
    if (existingIdx >= 0) {
      const currentAmount = allocations[existingIdx].amount;
      const amountDifference = newAmount - currentAmount;
      const nativeAmount = await nativeForDiff(amountDifference, currentAmount);
      const signedNative = amountDifference > 0 ? nativeAmount : -nativeAmount;

      // Update allocation
      allocations[existingIdx] = {
        ...allocations[existingIdx],
        amount: newAmount,
      };
      this.localStore.budgetAllocations[monthKey] = allocations;

      // Update account balance (native)
      this.localStore.accounts = this.localStore.accounts.map((a) =>
        a.id === accountId
          ? { ...a, currentBalance: a.currentBalance - signedNative }
          : a,
      );

      // Add transaction
      if (amountDifference !== 0 && nativeAmount > 0) {
        this.localStore.accountTransactions = [
          ...this.localStore.accountTransactions,
          {
            id: crypto.randomUUID(),
            fromAccountId: amountDifference > 0 ? accountId : undefined,
            toAccountId: amountDifference < 0 ? accountId : undefined,
            amount: nativeAmount,
            baseAmount: Math.abs(amountDifference),
            transactionType: "budget_allocation",
            monthKey,
            note:
              amountDifference > 0
                ? "Allocation increased"
                : "Allocation decreased",
            createdAt: new Date().toISOString(),
          },
        ];
      }

      saveStoreToLocalStorage(this.localStore);
    }
  }

  async removeBudgetAllocation(
    accountId: string,
    monthKey: string,
  ): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error("Not authenticated");

        // Get the current allocation amount to refund
        const allocations = await this.getBudgetAllocations(monthKey);
        const allocation = allocations.find((a) => a.accountId === accountId);
        if (!allocation) return;

        // Refund exactly the native amount that was deducted, from the
        // transaction snapshot — immune to rate changes since allocation.
        const refundNative = await this.netAllocatedNative(
          accountId,
          monthKey,
        );

        // Delete the allocation
        const { error: allocError } = await supabase
          .from("budget_allocations")
          .delete()
          .eq("account_id", accountId)
          .eq("month_key", monthKey);

        if (allocError) throw allocError;

        // Create a transaction to refund the amount back to the account
        if (refundNative > 0) {
          const transactionId = crypto.randomUUID();
          const { error: txError } = await supabase
            .from("account_transactions")
            .insert({
              id: transactionId,
              user_id: user.id,
              to_account_id: accountId,
              amount: refundNative,
              base_amount: allocation.amount,
              transaction_type: "budget_allocation",
              month_key: monthKey,
              note: "Allocation removed - refunded to account",
            });

          if (txError) throw txError;
        }

        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    // Local storage fallback
    const allocations = this.localStore.budgetAllocations[monthKey] ?? [];
    const allocation = allocations.find((a) => a.accountId === accountId);
    if (!allocation) return;

    // Refund the natively-deducted snapshot, not a rate-dependent conversion.
    const refundNative = await this.netAllocatedNative(accountId, monthKey);

    // Remove allocation
    this.localStore.budgetAllocations[monthKey] = allocations.filter(
      (a) => a.accountId !== accountId,
    );

    if (refundNative > 0) {
      // Refund to account
      this.localStore.accounts = this.localStore.accounts.map((a) =>
        a.id === accountId
          ? { ...a, currentBalance: a.currentBalance + refundNative }
          : a,
      );

      // Add refund transaction
      this.localStore.accountTransactions = [
        ...this.localStore.accountTransactions,
        {
          id: crypto.randomUUID(),
          toAccountId: accountId,
          amount: refundNative,
          baseAmount: allocation.amount,
          transactionType: "budget_allocation",
          monthKey,
          note: "Allocation removed - refunded to account",
          createdAt: new Date().toISOString(),
        },
      ];
    }

    saveStoreToLocalStorage(this.localStore);
  }

  async getAllocationTransactions(
    accountId: string,
    monthKey: string,
  ): Promise<AccountTransaction[]> {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("account_transactions")
          .select("*")
          .eq("month_key", monthKey)
          .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
          .order("created_at", { ascending: false });

        if (error) throw error;

        return (
          data?.map((row) => ({
            id: row.id,
            fromAccountId: row.from_account_id || undefined,
            toAccountId: row.to_account_id || undefined,
            amount: Number(row.amount),
            toAmount: row.to_amount != null ? Number(row.to_amount) : undefined,
            baseAmount:
              row.base_amount != null ? Number(row.base_amount) : undefined,
            transactionType:
              row.transaction_type as AccountTransaction["transactionType"],
            monthKey: row.month_key || undefined,
            savingsGoalId: row.savings_goal_id || undefined,
            note: row.note || undefined,
            createdAt: row.created_at,
            inForecast: !!row.in_forecast,
            forecastEnabled: row.forecast_enabled !== false,
          })) || []
        );
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    const transactions = this.localStore.accountTransactions ?? [];
    return transactions
      .filter(
        (t) =>
          t.monthKey === monthKey &&
          (t.fromAccountId === accountId || t.toAccountId === accountId),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // What every account was worth at the end of `monthKey`, plus what moved
  // during it.
  //
  // `accounts.current_balance` is live, and every single change to it goes
  // through an account_transactions row (+to_account, -from_account, reversed
  // on delete). So a historical balance is exact, not an estimate: take today's
  // balance and rewind every transaction recorded after the month ended.
  //
  // Returns a map keyed by account id. Accounts with no activity still get an
  // entry, so callers can render every account for any month.
  async getAccountMonthSnapshot(monthKey: string): Promise<
    Record<string, { balance: number; inflow: number; outflow: number }>
  > {
    const [accounts, transactions] = await Promise.all([
      this.getAccounts(),
      this.getAccountTransactions(),
    ]);

    const snapshot: Record<
      string,
      { balance: number; inflow: number; outflow: number }
    > = {};
    for (const a of accounts) {
      snapshot[a.id] = {
        balance: a.currentBalance,
        inflow: 0,
        outflow: 0,
      };
    }

    for (const t of transactions) {
      // createdAt is an ISO timestamp, so its first 7 chars are the month key
      // and string comparison orders months correctly.
      const txMonth = (t.createdAt ?? "").slice(0, 7);
      if (!txMonth) continue;

      // Each account's numbers stay native to it: the destination side of a
      // cross-currency transfer moved by toAmount, not the source amount.
      const inbound = t.toAmount ?? t.amount;
      if (txMonth > monthKey) {
        // Recorded after the month we're looking at — undo it.
        if (t.toAccountId && snapshot[t.toAccountId])
          snapshot[t.toAccountId].balance -= inbound;
        if (t.fromAccountId && snapshot[t.fromAccountId])
          snapshot[t.fromAccountId].balance += t.amount;
      } else if (txMonth === monthKey) {
        if (t.toAccountId && snapshot[t.toAccountId])
          snapshot[t.toAccountId].inflow += inbound;
        if (t.fromAccountId && snapshot[t.fromAccountId])
          snapshot[t.fromAccountId].outflow += t.amount;
      }
    }

    return snapshot;
  }

  async removeAccountTransaction(transactionId: string): Promise<void> {
    // Only deposits and transfers are reversible from this entry point.
    // Other transaction types back state managed elsewhere (expenses are
    // paid against an expense row, allocations back budgets, etc.) so
    // deleting them here would desync the rest of the app — those have
    // their own undo flows.
    const REVERSIBLE: AccountTransaction["transactionType"][] = [
      "deposit",
      "transfer",
    ];

    if (this.useSupabase && supabase) {
      try {
        const { data: row, error: fetchErr } = await supabase
          .from("account_transactions")
          .select("transaction_type")
          .eq("id", transactionId)
          .single();

        if (fetchErr) throw fetchErr;
        if (!row) throw new Error("Transaction not found");
        if (
          !REVERSIBLE.includes(
            row.transaction_type as AccountTransaction["transactionType"],
          )
        ) {
          throw new Error(
            "Only deposit or transfer transactions can be reverted",
          );
        }

        // Trigger will reverse the balance(s) on delete — refunds source
        // and debits destination, which undoes both deposits and transfers.
        const { error } = await supabase
          .from("account_transactions")
          .delete()
          .eq("id", transactionId);

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    const tx = this.localStore.accountTransactions.find(
      (t) => t.id === transactionId,
    );
    if (!tx) throw new Error("Transaction not found");
    if (!REVERSIBLE.includes(tx.transactionType)) {
      throw new Error(
        "Only deposit or transfer transactions can be reverted",
      );
    }

    // Reverse the balance change (destination side moved by toAmount on
    // cross-currency transfers).
    this.localStore.accounts = this.localStore.accounts.map((a) => {
      if (a.id === tx.fromAccountId) {
        return { ...a, currentBalance: a.currentBalance + tx.amount };
      }
      if (a.id === tx.toAccountId) {
        return {
          ...a,
          currentBalance: a.currentBalance - (tx.toAmount ?? tx.amount),
        };
      }
      return a;
    });
    this.localStore.accountTransactions =
      this.localStore.accountTransactions.filter((t) => t.id !== transactionId);
    saveStoreToLocalStorage(this.localStore);
  }

  async getAccountTransactions(
    accountId?: string,
  ): Promise<AccountTransaction[]> {
    if (this.useSupabase && supabase) {
      try {
        let query = supabase
          .from("account_transactions")
          .select("*")
          .order("created_at", { ascending: false });

        if (accountId) {
          query = query.or(
            `from_account_id.eq.${accountId},to_account_id.eq.${accountId}`,
          );
        }

        const { data, error } = await query;

        if (error) throw error;

        return (
          data?.map((row) => ({
            id: row.id,
            fromAccountId: row.from_account_id || undefined,
            toAccountId: row.to_account_id || undefined,
            amount: Number(row.amount),
            toAmount: row.to_amount != null ? Number(row.to_amount) : undefined,
            baseAmount:
              row.base_amount != null ? Number(row.base_amount) : undefined,
            transactionType:
              row.transaction_type as AccountTransaction["transactionType"],
            monthKey: row.month_key || undefined,
            savingsGoalId: row.savings_goal_id || undefined,
            note: row.note || undefined,
            createdAt: row.created_at,
            inForecast: !!row.in_forecast,
            forecastEnabled: row.forecast_enabled !== false,
          })) || []
        );
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    let transactions = this.localStore.accountTransactions ?? [];
    if (accountId) {
      transactions = transactions.filter(
        (t) => t.fromAccountId === accountId || t.toAccountId === accountId,
      );
    }
    return transactions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ============================================
  // SAVINGS GOAL OPERATIONS
  // ============================================
  async getSavingsGoals(): Promise<SavingsGoal[]> {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("savings_goals")
          .select("*")
          .order("created_at", { ascending: true });

        if (error) throw error;

        const goals =
          data?.map((row) => ({
            id: row.id,
            name: row.name,
            targetAmount: Number(row.target_amount),
            currentAmount: Number(row.current_amount),
            imageUrl: row.image_url || undefined,
            deadline: row.deadline || undefined,
            color: row.color || undefined,
            isCompleted: row.is_completed,
            completedAt: row.completed_at || undefined,
          })) || [];

        this.localStore.savingsGoals = goals;
        saveStoreToLocalStorage(this.localStore);

        return goals;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    return this.localStore.savingsGoals ?? [];
  }

  async addSavingsGoal(
    goal: Omit<
      SavingsGoal,
      "id" | "currentAmount" | "isCompleted" | "completedAt"
    >,
  ): Promise<SavingsGoal> {
    const id = crypto.randomUUID();
    const newGoal: SavingsGoal = {
      id,
      ...goal,
      currentAmount: 0,
      isCompleted: false,
    };

    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase.from("savings_goals").insert({
          id,
          user_id: user.id,
          name: goal.name,
          target_amount: goal.targetAmount,
          current_amount: 0,
          image_url: goal.imageUrl,
          deadline: goal.deadline,
          color: goal.color,
          is_completed: false,
        });

        if (error) throw error;
        return newGoal;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.savingsGoals = [...this.localStore.savingsGoals, newGoal];
    saveStoreToLocalStorage(this.localStore);
    return newGoal;
  }

  async updateSavingsGoal(
    id: string,
    updates: Partial<SavingsGoal>,
  ): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.targetAmount !== undefined)
          dbUpdates.target_amount = updates.targetAmount;
        if (updates.imageUrl !== undefined)
          dbUpdates.image_url = updates.imageUrl;
        if (updates.deadline !== undefined)
          dbUpdates.deadline = updates.deadline;
        if (updates.color !== undefined) dbUpdates.color = updates.color;

        const { error } = await supabase
          .from("savings_goals")
          .update(dbUpdates)
          .eq("id", id);

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.savingsGoals = this.localStore.savingsGoals.map((g) =>
      g.id === id ? { ...g, ...updates } : g,
    );
    saveStoreToLocalStorage(this.localStore);
  }

  async removeSavingsGoal(id: string): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const { error } = await supabase
          .from("savings_goals")
          .delete()
          .eq("id", id);

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.savingsGoals = this.localStore.savingsGoals.filter(
      (g) => g.id !== id,
    );
    saveStoreToLocalStorage(this.localStore);
  }

  // `amount` is native to the account; goals are base-denominated, so the
  // goal is credited with the converted base value (snapshotted here).
  async contributeToSavingsGoal(
    goalId: string,
    accountId: string,
    amount: number,
    note?: string,
  ): Promise<void> {
    const contributionId = crypto.randomUUID();
    const transactionId = crypto.randomUUID();
    const currency = await this.accountCurrency(accountId);
    const baseAmount = toBase(amount, currency);

    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error("Not authenticated");

        // Create transaction (trigger will update account balance)
        const { error: txError } = await supabase
          .from("account_transactions")
          .insert({
            id: transactionId,
            user_id: user.id,
            from_account_id: accountId,
            amount,
            base_amount: baseAmount,
            transaction_type: "savings_contribution",
            savings_goal_id: goalId,
            note,
          });

        if (txError) throw txError;

        // Create contribution in base (trigger will update goal current_amount)
        const { error: contribError } = await supabase
          .from("savings_contributions")
          .insert({
            id: contributionId,
            user_id: user.id,
            savings_goal_id: goalId,
            account_id: accountId,
            amount: baseAmount,
            note,
          });

        if (contribError) throw contribError;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    // Update local
    this.localStore.accounts = this.localStore.accounts.map((a) =>
      a.id === accountId
        ? { ...a, currentBalance: a.currentBalance - amount }
        : a,
    );

    this.localStore.savingsGoals = this.localStore.savingsGoals.map((g) => {
      if (g.id !== goalId) return g;
      const newAmount = g.currentAmount + baseAmount;
      const isCompleted = newAmount >= g.targetAmount;
      return {
        ...g,
        currentAmount: newAmount,
        isCompleted,
        completedAt:
          isCompleted && !g.isCompleted
            ? new Date().toISOString()
            : g.completedAt,
      };
    });

    this.localStore.savingsContributions = [
      ...this.localStore.savingsContributions,
      {
        id: contributionId,
        savingsGoalId: goalId,
        accountId,
        amount: baseAmount,
        note,
        createdAt: new Date().toISOString(),
      },
    ];

    this.localStore.accountTransactions = [
      ...this.localStore.accountTransactions,
      {
        id: transactionId,
        fromAccountId: accountId,
        amount,
        baseAmount,
        transactionType: "savings_contribution",
        savingsGoalId: goalId,
        note,
        createdAt: new Date().toISOString(),
      },
    ];

    saveStoreToLocalStorage(this.localStore);
  }

  async getSavingsContributions(
    goalId: string,
  ): Promise<SavingsContribution[]> {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("savings_contributions")
          .select("*")
          .eq("savings_goal_id", goalId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        return (
          data?.map((row) => ({
            id: row.id,
            savingsGoalId: row.savings_goal_id,
            accountId: row.account_id,
            amount: Number(row.amount),
            note: row.note || undefined,
            createdAt: row.created_at,
          })) || []
        );
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    return (this.localStore.savingsContributions ?? [])
      .filter((c) => c.savingsGoalId === goalId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ============================================
  // IMAGE UPLOAD OPERATIONS
  // ============================================
  async uploadSavingsGoalImage(file: File): Promise<string> {
    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) throw new Error("Not authenticated");

        const ALLOWED_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];
        const fileExt = file.name.split(".").pop()?.toLowerCase();
        if (!fileExt || !ALLOWED_IMAGE_EXTENSIONS.includes(fileExt)) {
          throw new Error("Unsupported image type");
        }
        const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("savings-goal-images")
          .upload(fileName, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("savings-goal-images").getPublicUrl(fileName);

        return publicUrl;
      } catch (error) {
        console.warn("Supabase storage error:", error);
        throw error;
      }
    }

    // For localStorage mode, convert to base64 data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async deleteSavingsGoalImage(imagePath: string): Promise<void> {
    if (this.useSupabase && supabase && !imagePath.startsWith("data:")) {
      try {
        // Extract path from full URL
        const url = new URL(imagePath);
        const pathParts = url.pathname.split("/savings-goal-images/");
        if (pathParts.length > 1) {
          const { error } = await supabase.storage
            .from("savings-goal-images")
            .remove([pathParts[1]]);

          if (error) throw error;
        }
      } catch (error) {
        console.warn("Supabase storage delete error:", error);
      }
    }
    // For localStorage mode with data URLs, nothing to delete
  }

  // ============================================
  // SPREADSHEET BATCH QUERIES
  // ============================================

  async getExpensesForMonthRange(
    startMonthKey: string,
    endMonthKey: string,
  ): Promise<Record<string, Expense[]>> {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("expenses")
          .select("*")
          .gte("month_key", startMonthKey)
          .lte("month_key", endMonthKey)
          .order("date", { ascending: true });

        if (error) throw error;

        const result: Record<string, Expense[]> = {};
        for (const row of data ?? []) {
          const mk = row.month_key;
          if (!result[mk]) result[mk] = [];
          result[mk].push({
            id: row.id,
            date: row.date,
            amount: Number(row.amount),
            originalAmount:
              row.original_amount != null
                ? Number(row.original_amount)
                : undefined,
            originalCurrency: isCurrencyCode(row.original_currency)
              ? row.original_currency
              : undefined,
            category: row.category || undefined,
            categoryId: row.category_id || undefined,
            accountId: row.account_id || undefined,
            note: row.note || undefined,
          });
        }
        return result;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    const result: Record<string, Expense[]> = {};
    for (const [mk, expenses] of Object.entries(this.localStore.expenses)) {
      if (mk >= startMonthKey && mk <= endMonthKey) {
        result[mk] = expenses.slice().sort((a, b) => a.date.localeCompare(b.date));
      }
    }
    return result;
  }

  async getBudgetsForMonthRange(
    startMonthKey: string,
    endMonthKey: string,
  ): Promise<Record<string, number>> {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("budgets")
          .select("month_key, amount")
          .gte("month_key", startMonthKey)
          .lte("month_key", endMonthKey);

        if (error) throw error;

        const result: Record<string, number> = {};
        for (const row of data ?? []) {
          result[row.month_key] = Number(row.amount);
        }
        return result;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    const result: Record<string, number> = {};
    for (const [mk, amount] of Object.entries(this.localStore.budgets)) {
      if (mk >= startMonthKey && mk <= endMonthKey) {
        result[mk] = amount;
      }
    }
    return result;
  }

  async getAllSavingsContributions(): Promise<SavingsContribution[]> {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("savings_contributions")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        return (
          data?.map((row) => ({
            id: row.id,
            savingsGoalId: row.savings_goal_id,
            accountId: row.account_id,
            amount: Number(row.amount),
            note: row.note || undefined,
            createdAt: row.created_at,
          })) || []
        );
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    return (this.localStore.savingsContributions ?? [])
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ============================================
  // SPREADSHEET MANUAL ENTRIES
  // ============================================

  async getSpreadsheetEntries(): Promise<ManualEntry[]> {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("spreadsheet_entries")
          .select("*");

        if (error) throw error;

        return (
          data?.map((row) => ({
            id: row.id,
            monthKey: row.month_key,
            columnKey: row.column_key,
            value: Number(row.value),
          })) || []
        );
      } catch (error) {
        // Don't flip global useSupabase flag — table may not exist yet
        console.warn("Spreadsheet entries Supabase error, using localStorage:", error);
      }
    }

    return this.localStore.spreadsheetEntries ?? [];
  }

  async setSpreadsheetEntry(
    monthKey: string,
    columnKey: string,
    value: number,
  ): Promise<void> {
    const existing = (this.localStore.spreadsheetEntries ?? []).find(
      (e) => e.monthKey === monthKey && e.columnKey === columnKey,
    );
    const id = existing?.id ?? crypto.randomUUID();

    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (user) {
          const { error } = await supabase.from("spreadsheet_entries").upsert(
            {
              id,
              user_id: user.id,
              month_key: monthKey,
              column_key: columnKey,
              value,
            },
            { onConflict: "user_id,month_key,column_key" },
          );

          if (error) throw error;
        }
      } catch (error) {
        console.warn("Spreadsheet entries Supabase error, using localStorage:", error);
      }
    }

    if (existing) {
      this.localStore.spreadsheetEntries = this.localStore.spreadsheetEntries.map(
        (e) => (e.id === existing.id ? { ...e, value } : e),
      );
    } else {
      this.localStore.spreadsheetEntries = [
        ...this.localStore.spreadsheetEntries,
        { id, monthKey, columnKey, value },
      ];
    }
    saveStoreToLocalStorage(this.localStore);
  }

  async removeSpreadsheetEntry(
    monthKey: string,
    columnKey: string,
  ): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (user) {
          const { error } = await supabase
            .from("spreadsheet_entries")
            .delete()
            .eq("user_id", user.id)
            .eq("month_key", monthKey)
            .eq("column_key", columnKey);

          if (error) throw error;
        }
      } catch (error) {
        console.warn("Spreadsheet entries Supabase error, using localStorage:", error);
      }
    }

    this.localStore.spreadsheetEntries = (
      this.localStore.spreadsheetEntries ?? []
    ).filter((e) => !(e.monthKey === monthKey && e.columnKey === columnKey));
    saveStoreToLocalStorage(this.localStore);
  }

  // ============================================
  // FORECAST FLOW OPERATIONS
  // ============================================
  async getForecastFlows(): Promise<ForecastFlow[]> {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("forecast_flows")
          .select("*")
          .order("sort_order", { ascending: true });

        if (error) throw error;

        const flows =
          (data as Array<Record<string, unknown>> | null)?.map((row) =>
            forecastRowToFlow(row),
          ) || [];

        this.localStore.forecastFlows = flows;
        saveStoreToLocalStorage(this.localStore);
        return flows;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    return this.localStore.forecastFlows ?? [];
  }

  async addForecastFlow(
    flow: Omit<ForecastFlow, "id">,
  ): Promise<ForecastFlow> {
    const id = crypto.randomUUID();
    const newFlow: ForecastFlow = { id, ...flow };

    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) {
          console.warn("User not authenticated, falling back to localStorage");
        } else {
          const { error } = await supabase
            .from("forecast_flows")
            .insert(forecastFlowToRow(newFlow, user.id) as never);
          if (error) throw error;
          return newFlow;
        }
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.forecastFlows = [
      ...(this.localStore.forecastFlows ?? []),
      newFlow,
    ];
    saveStoreToLocalStorage(this.localStore);
    return newFlow;
  }

  async updateForecastFlow(
    id: string,
    updates: Partial<Omit<ForecastFlow, "id">>,
  ): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.year !== undefined) dbUpdates.year = updates.year;
        if (updates.months !== undefined) dbUpdates.months = updates.months;
        if (updates.type !== undefined) dbUpdates.type = updates.type;
        if (updates.name !== undefined) dbUpdates.name = updates.name ?? null;
        if (updates.uncertain !== undefined)
          dbUpdates.uncertain = updates.uncertain;
        if (updates.value !== undefined)
          dbUpdates.value = updates.value ?? null;
        if (updates.lowValue !== undefined)
          dbUpdates.low_value = updates.lowValue ?? null;
        if (updates.highValue !== undefined)
          dbUpdates.high_value = updates.highValue ?? null;
        if (updates.isGhost !== undefined) dbUpdates.is_ghost = updates.isGhost;
        if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;
        if (updates.sortOrder !== undefined)
          dbUpdates.sort_order = updates.sortOrder;
        // `rule` present in the patch at all — even as undefined — means the
        // caller is setting what kind of flow this is, so write the columns.
        if ("rule" in updates) Object.assign(dbUpdates, ruleSpecToRow(updates.rule));

        const { error } = await supabase
          .from("forecast_flows")
          .update(dbUpdates as never)
          .eq("id", id);
        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.forecastFlows = (this.localStore.forecastFlows ?? []).map(
      (f) => (f.id === id ? { ...f, ...updates } : f),
    );
    saveStoreToLocalStorage(this.localStore);
  }

  async removeForecastFlow(id: string): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const { error } = await supabase
          .from("forecast_flows")
          .delete()
          .eq("id", id);
        if (error) throw error;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.forecastFlows = (
      this.localStore.forecastFlows ?? []
    ).filter((f) => f.id !== id);
    saveStoreToLocalStorage(this.localStore);
  }

  // ============================================
  // FORECAST LINKS (real records marked "Show in Forecast")
  // ============================================

  // Every marked expense / plan / deposit, projected into the ForecastFlow
  // shape so the forecast math can treat them exactly like manual flows.
  //
  // These are derived, not stored: there is no row in forecast_flows for them.
  // The amount, name and month always reflect the source record, and deleting
  // the source removes the flow with no reconciliation step.
  //
  // Marked records are always *certain* (value, never a low/high band) — they
  // are facts, so they shift the best and worst lines by the same amount.
  async getLinkedForecastFlows(): Promise<ForecastFlow[]> {
    const flows: ForecastFlow[] = [];

    const push = (
      kind: ForecastSourceKind,
      id: string,
      when: string | null | undefined,
      fallbackMonthKey: string | null | undefined,
      amount: number,
      name: string,
      enabled: boolean,
    ) => {
      const at = parseYearMonth(when) ?? parseYearMonth(fallbackMonthKey);
      if (!at || !(amount > 0)) return;
      flows.push({
        id: `${kind}:${id}`,
        year: at.year,
        months: [at.month], // a marked record is always a single occurrence
        type: kind === "deposit" ? "in" : "out",
        name,
        uncertain: false,
        value: amount,
        isGhost: false,
        enabled,
        sortOrder: 0, // assigned below, after sorting
        source: {
          kind,
          id,
          monthKey: fallbackMonthKey || monthKeyOf(at),
        },
      });
    };

    if (this.useSupabase && supabase) {
      try {
        const [expRes, planRes, depRes] = await Promise.all([
          supabase
            .from("expenses")
            .select("id, month_key, date, amount, category, note, forecast_enabled")
            .eq("in_forecast", true),
          supabase
            .from("plans")
            .select(
              "id, month_key, target_date, amount, category, note, forecast_enabled",
            )
            .eq("in_forecast", true),
          supabase
            .from("account_transactions")
            .select("id, created_at, month_key, amount, note, forecast_enabled")
            .eq("in_forecast", true)
            .eq("transaction_type", "deposit"),
        ]);

        if (expRes.error) throw expRes.error;
        if (planRes.error) throw planRes.error;
        if (depRes.error) throw depRes.error;

        for (const r of expRes.data ?? []) {
          push(
            "expense",
            r.id,
            r.date,
            r.month_key,
            Number(r.amount),
            r.note || r.category || "Expense",
            r.forecast_enabled !== false,
          );
        }
        for (const r of planRes.data ?? []) {
          push(
            "plan",
            r.id,
            r.target_date,
            r.month_key,
            Number(r.amount),
            r.note || r.category || "Plan",
            r.forecast_enabled !== false,
          );
        }
        for (const r of depRes.data ?? []) {
          push(
            "deposit",
            r.id,
            r.created_at,
            r.month_key,
            Number(r.amount),
            r.note || "Deposit",
            r.forecast_enabled !== false,
          );
        }

        return orderLinkedFlows(flows);
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        flows.length = 0;
      }
    }

    for (const [monthKey, list] of Object.entries(
      this.localStore.expenses ?? {},
    )) {
      for (const e of list) {
        if (!e.inForecast) continue;
        push(
          "expense",
          e.id,
          e.date,
          monthKey,
          e.amount,
          e.note || e.category || "Expense",
          e.forecastEnabled !== false,
        );
      }
    }
    for (const [monthKey, list] of Object.entries(
      this.localStore.plans ?? {},
    )) {
      for (const p of list) {
        if (!p.inForecast) continue;
        push(
          "plan",
          p.id,
          p.targetDate,
          monthKey,
          p.amount,
          p.note || p.category || "Plan",
          p.forecastEnabled !== false,
        );
      }
    }
    for (const t of this.localStore.accountTransactions ?? []) {
      if (!t.inForecast || t.transactionType !== "deposit") continue;
      push(
        "deposit",
        t.id,
        t.createdAt,
        t.monthKey,
        t.amount,
        t.note || "Deposit",
        t.forecastEnabled !== false,
      );
    }

    return orderLinkedFlows(flows);
  }

  // Flip the forecast flags on a source record without touching anything else.
  //
  // Deliberately not routed through updateExpense/updatePlan: those replay the
  // account balance adjustment (a refund + a re-deduction transaction) on every
  // call, which would litter the ledger with a pair of no-op rows each time you
  // toggled a card on the forecast page.
  async setForecastLink(
    source: ForecastSource,
    patch: { inForecast?: boolean; forecastEnabled?: boolean },
  ): Promise<void> {
    const table =
      source.kind === "expense"
        ? "expenses"
        : source.kind === "plan"
          ? "plans"
          : "account_transactions";

    if (this.useSupabase && supabase) {
      try {
        const dbUpdates: Record<string, unknown> = {};
        if (patch.inForecast !== undefined)
          dbUpdates.in_forecast = patch.inForecast;
        if (patch.forecastEnabled !== undefined)
          dbUpdates.forecast_enabled = patch.forecastEnabled;
        if (Object.keys(dbUpdates).length === 0) return;

        const { error } = await supabase
          .from(table)
          .update(dbUpdates as never)
          .eq("id", source.id);
        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    if (source.kind === "expense") {
      const list = this.localStore.expenses[source.monthKey] ?? [];
      this.localStore.expenses[source.monthKey] = list.map((x) =>
        x.id === source.id ? { ...x, ...patch } : x,
      );
    } else if (source.kind === "plan") {
      const list = this.localStore.plans[source.monthKey] ?? [];
      this.localStore.plans[source.monthKey] = list.map((x) =>
        x.id === source.id ? { ...x, ...patch } : x,
      );
    } else {
      this.localStore.accountTransactions = (
        this.localStore.accountTransactions ?? []
      ).map((t) => (t.id === source.id ? { ...t, ...patch } : t));
    }
    saveStoreToLocalStorage(this.localStore);
  }

  // ============================================
  // COMPUTED (RULE) FLOWS
  // ============================================

  // Expand each computed flow into one line per month it covers, with that
  // month's total. A computed flow stores no amount of its own — its months
  // and year say *where* it applies, and this fills in *how much*.
  //
  // The expansion carries source.kind === "rule" so views can tell it apart,
  // and so the flows list can fold the lines back into the single stored row
  // the user actually edits.
  //
  // Months up to and including the current one use the real total, so the
  // current (partial) month shows what has actually been spent so far. Later
  // months use the flow's projection — 'none' by default, which makes a
  // computed flow a historical overlay until you ask it to project.
  async evaluateRuleFlows(
    ruleFlows: ForecastFlow[],
    year: number,
  ): Promise<ForecastFlow[]> {
    // Disabled ones are still expanded, flagged disabled, exactly like a muted
    // typed flow — the maths skips them but they stay on screen.
    const defs = ruleFlows.filter((f) => f.rule && f.year === year);
    if (defs.length === 0) return [];

    const window = Math.max(1, ...defs.map((f) => f.rule!.projectionWindow));
    const from = addMonths(`${year}-01`, -window);
    const to = `${year}-12`;
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // 'picked' groups draw from the expenses table like an expense filter does;
    // they just select by membership instead of by account.
    const needed = new Set(
      defs.map((f) => (f.rule!.source === "picked" ? "expenses" : f.rule!.source)),
    );
    const rows: Partial<Record<ForecastRuleSource, AggregateRow[]>> = {};
    for (const src of needed) {
      rows[src] = await this.loadAggregateRows(src, from, to);
    }

    const out: ForecastFlow[] = [];
    let order = 0;

    for (const def of defs) {
      const rule = def.rule!;
      const picked = rule.source === "picked";
      const all = rows[picked ? "expenses" : rule.source] ?? [];
      const accounts = new Set(rule.accountIds);
      const categories = new Set(rule.categoryIds);

      // Month -> summed magnitude, over the rows this rule actually matches.
      const byMonth = new Map<string, number>();
      for (const r of all) {
        if (picked) {
          // Membership is the whole filter — nothing else applies.
          if (r.forecastFlowId !== def.id) continue;
        } else {
          if (accounts.size > 0 && (!r.accountId || !accounts.has(r.accountId)))
            continue;
          if (categories.size > 0 && (!r.categoryId || !categories.has(r.categoryId)))
            continue;
          // Skip anything already on the forecast in its own right — marked
          // individually, or claimed by a grouped line.
          if (rule.excludeLinked && (r.inForecast || r.forecastFlowId)) continue;
        }
        byMonth.set(r.monthKey, (byMonth.get(r.monthKey) ?? 0) + r.amount);
      }

      // Projection is learned only from *closed* months — including the
      // partial current month would drag the figure below a typical one.
      const closed = [...byMonth.entries()]
        .filter(([m]) => m < currentMonthKey)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-rule.projectionWindow)
        .map(([, v]) => v);
      const projected = projectValue(rule, closed);

      // Only the months the flow is actually scoped to — this is what stops a
      // computed flow from landing on every month of the year by fiat.
      //
      // A month that totals nothing still gets a line. Skipping zeros made a
      // flow scoped entirely to future months (with no projection) expand to
      // nothing at all, so it vanished from every view that is built from the
      // expansion — including the default one. Zero adds nothing to the
      // maths, and "no spending recorded yet" is worth seeing.
      // A picked group sits wherever its members actually fall — their dates
      // decide, not a month grid — and projects nothing, because its members
      // are things that already happened.
      const monthNumbers = picked
        ? [...byMonth.keys()]
            .map((k) => Number(k.slice(5, 7)))
            .sort((a, b) => a - b)
        : def.months;

      for (const m of monthNumbers) {
        if (m < 1 || m > 12) continue;
        const monthKey = `${year}-${String(m).padStart(2, "0")}`;
        const actual = byMonth.get(monthKey) ?? 0;
        const value =
          picked || monthKey <= currentMonthKey ? actual : projected;
        out.push({
          id: `rule:${def.id}:${monthKey}`,
          year,
          months: [m],
          type: def.type,
          name: def.name,
          uncertain: false,
          value,
          isGhost: def.isGhost,
          enabled: def.enabled,
          sortOrder: LINKED_SORT_OFFSET + 500_000 + order++,
          source: { kind: "rule", id: def.id, monthKey },
        });
      }
    }

    return out;
  }

  // Expenses a grouped line could take as members, for the picker: every
  // expense in the range, each saying whether it's already spoken for.
  async getPickableExpenses(
    fromMonth: string,
    toMonth: string,
  ): Promise<PickableExpense[]> {
    const out: PickableExpense[] = [];

    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("expenses")
          .select(
            "id, month_key, date, amount, note, category, account_id, in_forecast, forecast_flow_id",
          )
          .gte("month_key", fromMonth)
          .lte("month_key", toMonth)
          .order("date", { ascending: true });
        if (error) throw error;
        for (const r of (data as Array<Record<string, unknown>> | null) ?? []) {
          out.push({
            id: r.id as string,
            date: (r.date as string) || `${r.month_key}-01`,
            amount: Number(r.amount) || 0,
            note: (r.note as string) || undefined,
            category: (r.category as string) || undefined,
            accountId: (r.account_id as string) || undefined,
            inForecast: !!r.in_forecast,
            forecastFlowId: (r.forecast_flow_id as string) || undefined,
          });
        }
        return out;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        out.length = 0;
      }
    }

    for (const [monthKey, list] of Object.entries(
      this.localStore.expenses ?? {},
    )) {
      if (monthKey < fromMonth || monthKey > toMonth) continue;
      for (const e of list) {
        out.push({
          id: e.id,
          date: e.date || `${monthKey}-01`,
          amount: e.amount,
          note: e.note,
          category: e.category,
          accountId: e.accountId,
          inForecast: !!e.inForecast,
          forecastFlowId: e.forecastFlowId,
        });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Make exactly `expenseIds` the members of `flowId`. Joining a group clears
  // the record's own mark — a record has one home on the forecast, never two,
  // which is what keeps it from being counted twice.
  async setFlowMembers(flowId: string, expenseIds: string[]): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        // Release the previous members first, then claim the new set. Doing it
        // in this order means an id in both sets is never briefly unlinked.
        const { error: clearErr } = await supabase
          .from("expenses")
          .update({ forecast_flow_id: null } as never)
          .eq("forecast_flow_id", flowId);
        if (clearErr) throw clearErr;

        if (expenseIds.length > 0) {
          const { error: setErr } = await supabase
            .from("expenses")
            .update({
              forecast_flow_id: flowId,
              in_forecast: false,
            } as never)
            .in("id", expenseIds);
          if (setErr) throw setErr;
        }
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    const wanted = new Set(expenseIds);
    for (const [monthKey, list] of Object.entries(
      this.localStore.expenses ?? {},
    )) {
      this.localStore.expenses[monthKey] = list.map((e) => {
        if (wanted.has(e.id))
          return { ...e, forecastFlowId: flowId, inForecast: false };
        if (e.forecastFlowId === flowId)
          return { ...e, forecastFlowId: undefined };
        return e;
      });
    }
    saveStoreToLocalStorage(this.localStore);
  }

  // Flat rows a rule can aggregate, normalised across the three sources.
  private async loadAggregateRows(
    source: ForecastRuleSource,
    fromMonth: string,
    toMonth: string,
  ): Promise<AggregateRow[]> {
    const out: AggregateRow[] = [];

    if (this.useSupabase && supabase) {
      try {
        if (source === "expenses" || source === "plans") {
          const table = source === "expenses" ? "expenses" : "plans";
          const dateCol = source === "expenses" ? "date" : "target_date";
          const { data, error } = await supabase
            .from(table)
            .select(
              `id, month_key, ${dateCol}, amount, account_id, category_id, in_forecast, forecast_flow_id`,
            )
            .gte("month_key", fromMonth)
            .lte("month_key", toMonth);
          if (error) throw error;
          for (const r of (data as Array<Record<string, unknown>> | null) ?? []) {
            const when = (r[dateCol] as string) || (r.month_key as string);
            out.push({
              monthKey: String(when).slice(0, 7),
              amount: Number(r.amount) || 0,
              accountId: (r.account_id as string) || undefined,
              categoryId: (r.category_id as string) || undefined,
              inForecast: !!r.in_forecast,
              forecastFlowId: (r.forecast_flow_id as string) || undefined,
            });
          }
          return out;
        }

        // Deposits have no month_key, so the month comes from created_at and
        // the range filter has to be applied here rather than in the query.
        const { data, error } = await supabase
          .from("account_transactions")
          .select("id, created_at, amount, to_account_id, in_forecast")
          .eq("transaction_type", "deposit");
        if (error) throw error;
        for (const r of (data as Array<Record<string, unknown>> | null) ?? []) {
          const monthKey = String(r.created_at ?? "").slice(0, 7);
          if (!monthKey || monthKey < fromMonth || monthKey > toMonth) continue;
          out.push({
            monthKey,
            amount: Number(r.amount) || 0,
            accountId: (r.to_account_id as string) || undefined,
            inForecast: !!r.in_forecast,
          });
        }
        return out;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        out.length = 0;
      }
    }

    if (source === "expenses") {
      for (const [monthKey, list] of Object.entries(
        this.localStore.expenses ?? {},
      )) {
        if (monthKey < fromMonth || monthKey > toMonth) continue;
        for (const e of list) {
          out.push({
            monthKey: (e.date || monthKey).slice(0, 7),
            amount: e.amount,
            accountId: e.accountId,
            categoryId: e.categoryId,
            inForecast: !!e.inForecast,
            forecastFlowId: e.forecastFlowId,
          });
        }
      }
    } else if (source === "plans") {
      for (const [monthKey, list] of Object.entries(
        this.localStore.plans ?? {},
      )) {
        if (monthKey < fromMonth || monthKey > toMonth) continue;
        for (const p of list) {
          out.push({
            monthKey: (p.targetDate || monthKey).slice(0, 7),
            amount: p.amount,
            accountId: p.accountId,
            categoryId: p.categoryId,
            inForecast: !!p.inForecast,
            forecastFlowId: p.forecastFlowId,
          });
        }
      }
    } else {
      for (const t of this.localStore.accountTransactions ?? []) {
        if (t.transactionType !== "deposit") continue;
        const monthKey = (t.createdAt ?? "").slice(0, 7);
        if (!monthKey || monthKey < fromMonth || monthKey > toMonth) continue;
        out.push({
          monthKey,
          amount: t.amount,
          accountId: t.toAccountId,
          inForecast: !!t.inForecast,
        });
      }
    }
    return out;
  }

  // Bulk-insert flows (used by the importer). Returns the created flows.
  async addForecastFlows(
    flows: Array<Omit<ForecastFlow, "id">>,
  ): Promise<ForecastFlow[]> {
    const created: ForecastFlow[] = flows.map((f) => ({
      id: crypto.randomUUID(),
      ...f,
    }));
    if (created.length === 0) return [];

    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (!user) {
          console.warn("User not authenticated, falling back to localStorage");
        } else {
          const { error } = await supabase
            .from("forecast_flows")
            .insert(
              created.map((f) => forecastFlowToRow(f, user.id)) as never,
            );
          if (error) throw error;
          return created;
        }
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
      }
    }

    this.localStore.forecastFlows = [
      ...(this.localStore.forecastFlows ?? []),
      ...created,
    ];
    saveStoreToLocalStorage(this.localStore);
    return created;
  }
}

// ---- Forecast link helpers ----

// Pull {year, month} out of a "YYYY-MM-DD", "YYYY-MM" or ISO timestamp string.
// `month` is 1-based to match ForecastFlow.months.
function parseYearMonth(
  value: string | null | undefined,
): { year: number; month: number } | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

function monthKeyOf({ year, month }: { year: number; month: number }): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// Linked flows have no user-defined ordering, so give them a stable one:
// chronological, then by name. The offset keeps them below hand-written flows,
// which own the low sort_order range.
const LINKED_SORT_OFFSET = 1_000_000;

function orderLinkedFlows(flows: ForecastFlow[]): ForecastFlow[] {
  return flows
    .sort(
      (a, b) =>
        a.year - b.year ||
        (a.months[0] ?? 0) - (b.months[0] ?? 0) ||
        (a.name ?? "").localeCompare(b.name ?? ""),
    )
    .map((f, i) => ({ ...f, sortOrder: LINKED_SORT_OFFSET + i }));
}

// ---- Forecast rule helpers ----

// A row a rule can aggregate, normalised across expenses / plans / deposits.
type AggregateRow = {
  monthKey: string;
  amount: number;
  accountId?: string;
  categoryId?: string;
  inForecast: boolean;
  forecastFlowId?: string; // the grouped line this record belongs to, if any
};

// Shift a "YYYY-MM" key by a whole number of months.
function addMonths(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// What a rule shows for a month with no data yet, given the sums of its most
// recent closed months (oldest first).
function projectValue(rule: ForecastRuleSpec, history: number[]): number {
  switch (rule.projection) {
    case "fixed":
      return rule.fixedValue ?? 0;
    case "last":
      return history.length ? history[history.length - 1] : 0;
    case "average":
      return history.length
        ? history.reduce((a, b) => a + b, 0) / history.length
        : 0;
    case "median": {
      if (!history.length) return 0;
      const s = [...history].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    }
    case "none":
    default:
      return 0;
  }
}

// rule_source is the discriminator: null means an ordinary typed flow.
function ruleSpecFromRow(
  row: Record<string, unknown>,
): ForecastRuleSpec | undefined {
  if (!row.rule_source) return undefined;
  return {
    source: row.rule_source as ForecastRuleSource,
    accountIds: Array.isArray(row.rule_account_ids)
      ? (row.rule_account_ids as string[])
      : [],
    categoryIds: Array.isArray(row.rule_category_ids)
      ? (row.rule_category_ids as string[])
      : [],
    excludeLinked: row.rule_exclude_linked !== false,
    projection: (row.rule_projection as ForecastProjection) ?? "none",
    projectionWindow: Number(row.rule_projection_window ?? 3),
    fixedValue:
      row.rule_fixed_value === null || row.rule_fixed_value === undefined
        ? undefined
        : Number(row.rule_fixed_value),
  };
}

function ruleSpecToRow(
  rule: ForecastRuleSpec | undefined,
): Record<string, unknown> {
  if (!rule) {
    // Clear the discriminator so editing a computed flow back into a typed one
    // actually stops it computing.
    return { rule_source: null };
  }
  return {
    rule_source: rule.source,
    rule_account_ids: rule.accountIds,
    rule_category_ids: rule.categoryIds,
    rule_exclude_linked: rule.excludeLinked,
    rule_projection: rule.projection,
    rule_projection_window: rule.projectionWindow,
    rule_fixed_value: rule.fixedValue ?? null,
  };
}

// ---- Forecast flow row mappers (DB snake_case <-> ForecastFlow) ----
function forecastRowToFlow(row: Record<string, unknown>): ForecastFlow {
  const num = (v: unknown): number | undefined =>
    v === null || v === undefined ? undefined : Number(v);
  return {
    id: row.id as string,
    year: Number(row.year),
    months: Array.isArray(row.months) ? (row.months as number[]) : [],
    type: row.type as ForecastFlow["type"],
    name: (row.name as string) || undefined,
    uncertain: !!row.uncertain,
    value: num(row.value),
    lowValue: num(row.low_value),
    highValue: num(row.high_value),
    isGhost: !!row.is_ghost,
    enabled: row.enabled !== false,
    sortOrder: Number(row.sort_order ?? 0),
    rule: ruleSpecFromRow(row),
  };
}

function forecastFlowToRow(
  flow: ForecastFlow,
  userId: string,
): Record<string, unknown> {
  return {
    id: flow.id,
    user_id: userId,
    year: flow.year,
    months: flow.months,
    type: flow.type,
    name: flow.name ?? null,
    uncertain: flow.uncertain,
    value: flow.value ?? null,
    low_value: flow.lowValue ?? null,
    high_value: flow.highValue ?? null,
    is_ghost: flow.isGhost,
    enabled: flow.enabled,
    sort_order: flow.sortOrder,
    ...ruleSpecToRow(flow.rule),
  };
}

// Export singleton instance
export const dataService = new DataService();
