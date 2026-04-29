import type { ManualEntry } from "@/types/spreadsheet.types";
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
export type Account = {
  id: string;
  name: string;
  accountType: "checking" | "savings" | "credit" | "cash" | "other";
  initialBalance: number;
  currentBalance: number;
  isDefault: boolean;
  color?: string;
  icon?: string;
  sortOrder: number;
};

// Account Transaction type - tracks money movement
export type AccountTransaction = {
  id: string;
  fromAccountId?: string;
  toAccountId?: string;
  amount: number;
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

// Expense type - with optional categoryId for new system
export type Expense = {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  category?: string; // Legacy TEXT field
  categoryId?: string; // NEW: Reference to categories table
  accountId?: string; // Account this expense was paid from
  note?: string;
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
  accountTransactions: AccountTransaction[];
  budgetAllocations: Record<string, BudgetAllocation[]>;
  savingsGoals: SavingsGoal[];
  savingsContributions: SavingsContribution[];
  spreadsheetEntries: ManualEntry[];
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
  accountTransactions: [],
  budgetAllocations: {},
  savingsGoals: [],
  savingsContributions: [],
  spreadsheetEntries: [],
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
          accountTransactions: [],
          budgetAllocations: {},
          savingsGoals: [],
          savingsContributions: [],
          spreadsheetEntries: [],
        };
        saveStoreToLocalStorage(migrated);
        return migrated;
      }
      return { ...defaultStore };
    }
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      budgets: parsed.budgets ?? {},
      expenses: parsed.expenses ?? {},
      plans: parsed.plans ?? {},
      drafts: parsed.drafts ?? [],
      categories: parsed.categories ?? [],
      accounts: parsed.accounts ?? [],
      accountTransactions: parsed.accountTransactions ?? [],
      budgetAllocations: parsed.budgetAllocations ?? {},
      savingsGoals: parsed.savingsGoals ?? [],
      savingsContributions: parsed.savingsContributions ?? [],
      spreadsheetEntries: parsed.spreadsheetEntries ?? [],
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

  // Budget operations
  async getBudget(monthKey: string): Promise<number> {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("budgets")
          .select("amount")
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
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        this.useSupabase = false;
        return this.localStore.budgets[monthKey] ?? 0;
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
          this.useSupabase = false;
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
        // Don't disable Supabase for budget conflicts, might be temporary
        if ((error as any)?.code !== "23505") {
          this.useSupabase = false;
        }
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
        return (
          data?.map((row) => ({
            id: row.id,
            date: row.date,
            amount: Number(row.amount),
            category: row.category || undefined,
            accountId: row.account_id || undefined,
            note: row.note || undefined,
          })) || []
        );
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        this.useSupabase = false;
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
          this.useSupabase = false;
        } else {
          const { error } = await supabase.from("expenses").insert({
            id: expense.id,
            user_id: user.id,
            month_key: monthKey,
            date: expense.date,
            amount: expense.amount,
            category: expense.category,
            account_id: expense.accountId || null,
            note: expense.note,
          });

          if (error) throw error;

          // Deduct from account if specified
          if (expense.accountId) {
            const txId = crypto.randomUUID();
            await supabase.from("account_transactions").insert({
              id: txId,
              user_id: user.id,
              from_account_id: expense.accountId,
              amount: expense.amount,
              transaction_type: "expense",
              month_key: monthKey,
              note: expense.note || expense.category || "Expense",
            });
          }
          return;
        }
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        this.useSupabase = false;
      }
    }

    const list = this.localStore.expenses[monthKey]
      ? [...this.localStore.expenses[monthKey]]
      : [];
    list.push(expense);
    this.localStore.expenses[monthKey] = list;

    // Deduct from account if specified
    if (expense.accountId) {
      this.localStore.accounts = this.localStore.accounts.map((a) =>
        a.id === expense.accountId
          ? { ...a, currentBalance: a.currentBalance - expense.amount }
          : a,
      );
      this.localStore.accountTransactions = [
        ...this.localStore.accountTransactions,
        {
          id: crypto.randomUUID(),
          fromAccountId: expense.accountId,
          amount: expense.amount,
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
          .select("account_id, amount, category, note")
          .eq("id", id)
          .single();

        const { error } = await supabase.from("expenses").delete().eq("id", id);
        if (error) throw error;

        // Refund the account if the expense was linked
        if (expenseData?.account_id) {
          const user = await this.getCurrentUser();
          if (user) {
            const txId = crypto.randomUUID();
            await supabase.from("account_transactions").insert({
              id: txId,
              user_id: user.id,
              to_account_id: expenseData.account_id,
              amount: Number(expenseData.amount),
              transaction_type: "expense",
              month_key: monthKey,
              note: `Refund: ${expenseData.note || expenseData.category || "Expense deleted"}`,
            });
          }
        }
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        this.useSupabase = false;
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

    // Refund the account if the expense was linked
    if (expense?.accountId) {
      this.localStore.accounts = this.localStore.accounts.map((a) =>
        a.id === expense.accountId
          ? { ...a, currentBalance: a.currentBalance + expense.amount }
          : a,
      );
      this.localStore.accountTransactions = [
        ...this.localStore.accountTransactions,
        {
          id: crypto.randomUUID(),
          toAccountId: expense.accountId,
          amount: expense.amount,
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
        return (
          data?.map((row) => ({
            id: row.id,
            monthKey: row.month_key,
            weekIndex: row.week_index,
            amount: Number(row.amount),
            category: row.category || undefined,
            accountId: row.account_id || undefined,
            note: row.note || undefined,
            targetDate: row.target_date || undefined,
          })) || []
        );
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        this.useSupabase = false;
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
          this.useSupabase = false;
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
        this.useSupabase = false;
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

        const { error } = await supabase
          .from("plans")
          .update(dbUpdates)
          .eq("id", id);

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        this.useSupabase = false;
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
        this.useSupabase = false;
      }
    }

    const list = (this.localStore.plans[monthKey] ?? []).filter(
      (x) => x.id !== id,
    );
    this.localStore.plans[monthKey] = list;
    saveStoreToLocalStorage(this.localStore);
  }

  async clearMonth(monthKey: string): Promise<void> {
    // First, refund all budget allocations for this month back to accounts
    const allocations = await this.getBudgetAllocations(monthKey);

    if (this.useSupabase && supabase) {
      try {
        const user = await this.getCurrentUser();

        // Refund each allocation back to its account
        for (const alloc of allocations) {
          if (alloc.amount > 0 && user) {
            const refundTxId = crypto.randomUUID();
            await supabase.from("account_transactions").insert({
              id: refundTxId,
              user_id: user.id,
              to_account_id: alloc.accountId,
              amount: alloc.amount,
              transaction_type: "budget_allocation",
              month_key: monthKey,
              note: "Month cleared - allocation refunded",
            });
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
        this.useSupabase = false;
      }
    }

    // Local: refund allocations back to accounts
    for (const alloc of allocations) {
      if (alloc.amount > 0) {
        this.localStore.accounts = this.localStore.accounts.map((a) =>
          a.id === alloc.accountId
            ? { ...a, currentBalance: a.currentBalance + alloc.amount }
            : a,
        );

        // Record refund transaction
        this.localStore.accountTransactions = [
          ...this.localStore.accountTransactions,
          {
            id: crypto.randomUUID(),
            toAccountId: alloc.accountId,
            amount: alloc.amount,
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
        this.useSupabase = false;
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
          this.useSupabase = false;
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
        this.useSupabase = false;
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
        this.useSupabase = false;
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
        this.useSupabase = false;
      }
    }

    const list = this.localStore.drafts.filter((x) => x.id !== id);
    this.localStore.drafts = list;
    saveStoreToLocalStorage(this.localStore);
  }

  async clearAllDrafts(): Promise<void> {
    if (this.useSupabase && supabase) {
      try {
        const { error } = await supabase
          .from("drafts")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        this.useSupabase = false;
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
          .select("account_id, amount")
          .eq("id", id)
          .single();

        const dbUpdates: Record<string, unknown> = {};
        if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
        if (updates.category !== undefined)
          dbUpdates.category = updates.category;
        if (updates.categoryId !== undefined)
          dbUpdates.category_id = updates.categoryId;
        if (updates.accountId !== undefined)
          dbUpdates.account_id = updates.accountId || null;
        if (updates.note !== undefined) dbUpdates.note = updates.note;
        if (updates.date !== undefined) dbUpdates.date = updates.date;

        const { error } = await supabase
          .from("expenses")
          .update(dbUpdates)
          .eq("id", id);

        if (error) throw error;

        // Handle account balance adjustments
        const user = await this.getCurrentUser();
        if (user && oldExpense) {
          const oldAccountId = oldExpense.account_id;
          const oldAmount = Number(oldExpense.amount);
          const newAccountId = updates.accountId !== undefined ? updates.accountId : oldAccountId;
          const newAmount = updates.amount !== undefined ? updates.amount : oldAmount;

          // Refund old account
          if (oldAccountId) {
            await supabase.from("account_transactions").insert({
              id: crypto.randomUUID(),
              user_id: user.id,
              to_account_id: oldAccountId,
              amount: oldAmount,
              transaction_type: "expense",
              month_key: monthKey,
              note: "Expense updated - old amount refunded",
            });
          }
          // Deduct from new account
          if (newAccountId) {
            await supabase.from("account_transactions").insert({
              id: crypto.randomUUID(),
              user_id: user.id,
              from_account_id: newAccountId,
              amount: newAmount,
              transaction_type: "expense",
              month_key: monthKey,
              note: "Expense updated - new amount deducted",
            });
          }
        }
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        this.useSupabase = false;
      }
    }

    const oldExpense = (this.localStore.expenses[monthKey] ?? []).find(
      (x) => x.id === id,
    );

    const list = (this.localStore.expenses[monthKey] ?? []).map((x) =>
      x.id === id ? { ...x, ...updates } : x,
    );
    this.localStore.expenses[monthKey] = list;

    // Handle account balance adjustments for localStorage
    if (oldExpense) {
      const oldAccountId = oldExpense.accountId;
      const oldAmount = oldExpense.amount;
      const newAccountId = updates.accountId !== undefined ? updates.accountId : oldAccountId;
      const newAmount = updates.amount !== undefined ? updates.amount : oldAmount;

      // Refund old account
      if (oldAccountId) {
        this.localStore.accounts = this.localStore.accounts.map((a) =>
          a.id === oldAccountId
            ? { ...a, currentBalance: a.currentBalance + oldAmount }
            : a,
        );
      }
      // Deduct from new account
      if (newAccountId) {
        this.localStore.accounts = this.localStore.accounts.map((a) =>
          a.id === newAccountId
            ? { ...a, currentBalance: a.currentBalance - newAmount }
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
        this.useSupabase = false;
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
          this.useSupabase = false;
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
        this.useSupabase = false;
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
        this.useSupabase = false;
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
        this.useSupabase = false;
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
    if (this.useSupabase && supabase) {
      try {
        const { error } = await supabase
          .from("categories")
          .delete()
          .eq("id", id);

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        this.useSupabase = false;
      }
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

        const accounts =
          data?.map((row) => ({
            id: row.id,
            name: row.name,
            accountType: row.account_type as Account["accountType"],
            initialBalance: Number(row.initial_balance),
            currentBalance: Number(row.current_balance),
            isDefault: row.is_default,
            color: row.color || undefined,
            icon: row.icon || undefined,
            sortOrder: row.sort_order,
          })) || [];

        this.localStore.accounts = accounts;
        saveStoreToLocalStorage(this.localStore);

        return accounts;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        this.useSupabase = false;
      }
    }

    return this.localStore.accounts ?? [];
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
          this.useSupabase = false;
        } else {
          const { error } = await supabase.from("accounts").insert({
            id,
            user_id: user.id,
            name: account.name,
            account_type: account.accountType,
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
        this.useSupabase = false;
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
        this.useSupabase = false;
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
        this.useSupabase = false;
      }
    }

    // Remove the account
    this.localStore.accounts = this.localStore.accounts.filter(
      (a) => a.id !== id,
    );

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
        this.useSupabase = false;
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

  async depositToAccount(
    accountId: string,
    amount: number,
    note?: string,
  ): Promise<void> {
    const id = crypto.randomUUID();
    const transaction: AccountTransaction = {
      id,
      toAccountId: accountId,
      amount,
      transactionType: "deposit",
      note,
      createdAt: new Date().toISOString(),
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
          transaction_type: "deposit",
          note,
        });

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        this.useSupabase = false;
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
  ): Promise<void> {
    const id = crypto.randomUUID();
    const transaction: AccountTransaction = {
      id,
      fromAccountId: fromId,
      toAccountId: toId,
      amount,
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
          transaction_type: "transfer",
          note,
        });

        if (error) throw error;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        this.useSupabase = false;
      }
    }

    // Update local balances
    this.localStore.accounts = this.localStore.accounts.map((a) => {
      if (a.id === fromId)
        return { ...a, currentBalance: a.currentBalance - amount };
      if (a.id === toId)
        return { ...a, currentBalance: a.currentBalance + amount };
      return a;
    });
    this.localStore.accountTransactions = [
      ...this.localStore.accountTransactions,
      transaction,
    ];
    saveStoreToLocalStorage(this.localStore);
  }

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
        `Insufficient balance: ${account.name} has $${account.currentBalance.toFixed(2)} but tried to allocate $${amount.toFixed(2)}`,
      );
    }

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
          // which correctly handles the difference
          await this.updateBudgetAllocation(
            accountId,
            monthKey,
            existing.amount + amount,
          );
          return;
        }

        // Create transaction (trigger will update account balance)
        const { error: txError } = await supabase
          .from("account_transactions")
          .insert({
            id: transactionId,
            user_id: user.id,
            from_account_id: accountId,
            amount,
            transaction_type: "budget_allocation",
            month_key: monthKey,
          });

        if (txError) throw txError;

        // Create new allocation (INSERT not UPSERT to avoid replacing)
        const { error: allocError } = await supabase
          .from("budget_allocations")
          .insert({
            id: allocationId,
            user_id: user.id,
            account_id: accountId,
            month_key: monthKey,
            amount,
          });

        if (allocError) throw allocError;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        this.useSupabase = false;
      }
    }

    // Deduct from account balance
    this.localStore.accounts = this.localStore.accounts.map((a) =>
      a.id === accountId
        ? { ...a, currentBalance: a.currentBalance - amount }
        : a,
    );

    // Update or create allocation
    const allocations = this.localStore.budgetAllocations[monthKey] ?? [];
    const existingIdx = allocations.findIndex((a) => a.accountId === accountId);
    if (existingIdx >= 0) {
      allocations[existingIdx] = {
        ...allocations[existingIdx],
        amount: allocations[existingIdx].amount + amount,
      };
    } else {
      allocations.push({ id: allocationId, accountId, monthKey, amount });
    }
    this.localStore.budgetAllocations[monthKey] = allocations;

    // Record transaction
    this.localStore.accountTransactions = [
      ...this.localStore.accountTransactions,
      {
        id: transactionId,
        fromAccountId: accountId,
        amount,
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
        this.useSupabase = false;
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
        this.useSupabase = false;
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
        this.useSupabase = false;
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

  async updateBudgetAllocation(
    accountId: string,
    monthKey: string,
    newAmount: number,
  ): Promise<void> {
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

        // Update the allocation
        const { error: allocError } = await supabase
          .from("budget_allocations")
          .update({ amount: newAmount })
          .eq("account_id", accountId)
          .eq("month_key", monthKey);

        if (allocError) throw allocError;

        // Create a transaction for the difference (if any)
        if (amountDifference !== 0) {
          const transactionId = crypto.randomUUID();
          const { error: txError } = await supabase
            .from("account_transactions")
            .insert({
              id: transactionId,
              user_id: user.id,
              from_account_id: amountDifference > 0 ? accountId : null,
              to_account_id: amountDifference < 0 ? accountId : null,
              amount: Math.abs(amountDifference),
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
        this.useSupabase = false;
      }
    }

    // Local storage fallback
    const allocations = this.localStore.budgetAllocations[monthKey] ?? [];
    const existingIdx = allocations.findIndex((a) => a.accountId === accountId);
    if (existingIdx >= 0) {
      const currentAmount = allocations[existingIdx].amount;
      const amountDifference = newAmount - currentAmount;

      // Update allocation
      allocations[existingIdx] = {
        ...allocations[existingIdx],
        amount: newAmount,
      };
      this.localStore.budgetAllocations[monthKey] = allocations;

      // Update account balance
      this.localStore.accounts = this.localStore.accounts.map((a) =>
        a.id === accountId
          ? { ...a, currentBalance: a.currentBalance - amountDifference }
          : a,
      );

      // Add transaction
      if (amountDifference !== 0) {
        this.localStore.accountTransactions = [
          ...this.localStore.accountTransactions,
          {
            id: crypto.randomUUID(),
            fromAccountId: amountDifference > 0 ? accountId : undefined,
            toAccountId: amountDifference < 0 ? accountId : undefined,
            amount: Math.abs(amountDifference),
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

        // Delete the allocation
        const { error: allocError } = await supabase
          .from("budget_allocations")
          .delete()
          .eq("account_id", accountId)
          .eq("month_key", monthKey);

        if (allocError) throw allocError;

        // Create a transaction to refund the amount back to the account
        const transactionId = crypto.randomUUID();
        const { error: txError } = await supabase
          .from("account_transactions")
          .insert({
            id: transactionId,
            user_id: user.id,
            to_account_id: accountId,
            amount: allocation.amount,
            transaction_type: "budget_allocation",
            month_key: monthKey,
            note: "Allocation removed - refunded to account",
          });

        if (txError) throw txError;

        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        this.useSupabase = false;
      }
    }

    // Local storage fallback
    const allocations = this.localStore.budgetAllocations[monthKey] ?? [];
    const allocation = allocations.find((a) => a.accountId === accountId);
    if (!allocation) return;

    // Remove allocation
    this.localStore.budgetAllocations[monthKey] = allocations.filter(
      (a) => a.accountId !== accountId,
    );

    // Refund to account
    this.localStore.accounts = this.localStore.accounts.map((a) =>
      a.id === accountId
        ? { ...a, currentBalance: a.currentBalance + allocation.amount }
        : a,
    );

    // Add refund transaction
    this.localStore.accountTransactions = [
      ...this.localStore.accountTransactions,
      {
        id: crypto.randomUUID(),
        toAccountId: accountId,
        amount: allocation.amount,
        transactionType: "budget_allocation",
        monthKey,
        note: "Allocation removed - refunded to account",
        createdAt: new Date().toISOString(),
      },
    ];

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
            transactionType:
              row.transaction_type as AccountTransaction["transactionType"],
            monthKey: row.month_key || undefined,
            savingsGoalId: row.savings_goal_id || undefined,
            note: row.note || undefined,
            createdAt: row.created_at,
          })) || []
        );
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        this.useSupabase = false;
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
        this.useSupabase = false;
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

    // Reverse the balance change.
    this.localStore.accounts = this.localStore.accounts.map((a) => {
      if (a.id === tx.fromAccountId) {
        return { ...a, currentBalance: a.currentBalance + tx.amount };
      }
      if (a.id === tx.toAccountId) {
        return { ...a, currentBalance: a.currentBalance - tx.amount };
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
            transactionType:
              row.transaction_type as AccountTransaction["transactionType"],
            monthKey: row.month_key || undefined,
            savingsGoalId: row.savings_goal_id || undefined,
            note: row.note || undefined,
            createdAt: row.created_at,
          })) || []
        );
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        this.useSupabase = false;
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
        this.useSupabase = false;
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
        this.useSupabase = false;
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
        this.useSupabase = false;
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
        this.useSupabase = false;
      }
    }

    this.localStore.savingsGoals = this.localStore.savingsGoals.filter(
      (g) => g.id !== id,
    );
    saveStoreToLocalStorage(this.localStore);
  }

  async contributeToSavingsGoal(
    goalId: string,
    accountId: string,
    amount: number,
    note?: string,
  ): Promise<void> {
    const contributionId = crypto.randomUUID();
    const transactionId = crypto.randomUUID();

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
            transaction_type: "savings_contribution",
            savings_goal_id: goalId,
            note,
          });

        if (txError) throw txError;

        // Create contribution (trigger will update goal current_amount)
        const { error: contribError } = await supabase
          .from("savings_contributions")
          .insert({
            id: contributionId,
            user_id: user.id,
            savings_goal_id: goalId,
            account_id: accountId,
            amount,
            note,
          });

        if (contribError) throw contribError;
        return;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        this.useSupabase = false;
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
      const newAmount = g.currentAmount + amount;
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
        amount,
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
        this.useSupabase = false;
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

        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("savings-goal-images")
          .upload(fileName, file);

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
            category: row.category || undefined,
            note: row.note || undefined,
          });
        }
        return result;
      } catch (error) {
        console.warn("Supabase error, falling back to localStorage:", error);
        this.useSupabase = false;
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
        this.useSupabase = false;
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
        this.useSupabase = false;
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
}

// Export singleton instance
export const dataService = new DataService();
