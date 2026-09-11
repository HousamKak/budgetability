#!/usr/bin/env node
/**
 * Budgetability MCP server - LIVE Supabase edition (stdio).
 *
 * Operates on the production backend the web and mobile apps use, signed in
 * as your user, under RLS. Mirrors the apps' data-service semantics: balance
 * effects happen via account_transactions rows (DB triggers maintain account
 * balances and savings progress).
 *
 * Tool names match backend/mcp so either server can back the same workflows.
 */
import { McpServer, type ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  check,
  currentMonthKey,
  ensureUserId,
  money,
  newId,
  sanitizeLike,
  supabase,
} from "./client.js";
import { startRegistryAnnouncer, type ToolMeta } from "./registry.js";
import { startHAnnounce } from "./h-register.js";

const SERVER_NAME = "budgetability-live";
const SERVER_VERSION = "0.1.0";

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
});

/**
 * Register a tool on the MCP server AND record its metadata so the server
 * can announce its components to an MCP registry (see registry.ts).
 */
const toolMetas: ToolMeta[] = [];
function tool<Args extends z.ZodRawShape>(
  name: string,
  description: string,
  shape: Args,
  handler: ToolCallback<Args>,
): void {
  toolMetas.push({
    name,
    description,
    inputSchema: zodToJsonSchema(z.object(shape)),
  });
  server.tool(name, description, shape, handler);
}

const monthKeySchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'format "YYYY-MM"')
  .optional()
  .describe('Month in "YYYY-MM" format. Defaults to the current month.');

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'format "YYYY-MM-DD"')
  .describe('Date in "YYYY-MM-DD" format');

const json = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

const mk = (m?: string) => m ?? currentMonthKey();

/** First day of the month after a "YYYY-MM" key, as an ISO date string. */
function nextMonthStart(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

// ----------------------------------------------------------- row mappers

const expenseJson = (r: Record<string, unknown>) => ({
  id: r.id,
  monthKey: r.month_key,
  date: r.date,
  amount: Number(r.amount), // always in the base display currency
  // What was really paid, when it was not the base currency
  originalAmount: r.original_amount !== null ? Number(r.original_amount) : undefined,
  originalCurrency: r.original_currency ?? undefined,
  exchangeRate: r.exchange_rate !== null ? Number(r.exchange_rate) : undefined,
  category: r.category ?? undefined,
  categoryId: r.category_id ?? undefined,
  accountId: r.account_id ?? undefined,
  note: r.note ?? undefined,
  inForecast: r.in_forecast ? true : undefined,
});

const planJson = (r: Record<string, unknown>) => ({
  id: r.id,
  monthKey: r.month_key,
  weekIndex: r.week_index,
  amount: Number(r.amount),
  category: r.category ?? undefined,
  categoryId: r.category_id ?? undefined,
  accountId: r.account_id ?? undefined,
  note: r.note ?? undefined,
  targetDate: r.target_date ?? undefined,
});

// ----------------------------------------------------- transaction helper

/** Insert an account_transactions row; DB triggers apply the balance effects. */
async function insertTx(
  userId: string,
  tx: {
    fromAccountId?: string;
    toAccountId?: string;
    amount: number;
    type: string;
    monthKey?: string;
    savingsGoalId?: string;
    note?: string;
    inForecast?: boolean;
    // Wallet currency snapshot: `currency` denominates `amount` (the balance
    // it left); on cross-currency movements toAmount/toCurrency describe the
    // destination side; baseAmount freezes the base-currency value at entry;
    // exchangeRate is target units per 1 source unit.
    currency?: string;
    toAmount?: number;
    toCurrency?: string;
    baseAmount?: number;
    exchangeRate?: number;
  },
): Promise<string> {
  const id = newId();
  const { error } = await supabase.from("account_transactions").insert({
    id,
    user_id: userId,
    from_account_id: tx.fromAccountId ?? null,
    to_account_id: tx.toAccountId ?? null,
    amount: money(tx.amount),
    transaction_type: tx.type,
    month_key: tx.monthKey ?? null,
    savings_goal_id: tx.savingsGoalId ?? null,
    note: tx.note ?? null,
    currency: tx.currency ?? null,
    to_amount: tx.toAmount !== undefined ? money(tx.toAmount) : null,
    to_currency: tx.toCurrency ?? null,
    base_amount: tx.baseAmount !== undefined ? money(tx.baseAmount) : null,
    exchange_rate: tx.exchangeRate ?? null,
    // Deposits only - a DB check constraint rejects the flag on other types.
    in_forecast: tx.inForecast ?? false,
  });
  check(error, "Recording account transaction failed");
  return id;
}

// ------------------------------------------------------------- month / budget

tool(
  "get_month_summary",
  "Get the full summary for a month: budget, total spent, total planned, money left now, money left after planned expenses, and spending grouped by category.",
  { monthKey: monthKeySchema },
  async ({ monthKey }) => {
    const userId = await ensureUserId();
    const m = mk(monthKey);
    const [budgetRes, expRes, planRes, catRes] = await Promise.all([
      supabase.from("budgets").select("amount").eq("user_id", userId).eq("month_key", m).maybeSingle(),
      supabase.from("expenses").select("*").eq("user_id", userId).eq("month_key", m),
      supabase.from("plans").select("amount").eq("user_id", userId).eq("month_key", m),
      supabase.from("categories").select("id, name").eq("user_id", userId),
    ]);
    check(budgetRes.error, "Loading budget failed");
    check(expRes.error, "Loading expenses failed");
    check(planRes.error, "Loading plans failed");
    check(catRes.error, "Loading categories failed");

    const budget = Number(budgetRes.data?.amount ?? 0);
    const expenses = expRes.data ?? [];
    const totalSpent = money(expenses.reduce((s, e) => s + Number(e.amount), 0));
    const totalPlanned = money((planRes.data ?? []).reduce((s, p) => s + Number(p.amount), 0));
    const catName = new Map((catRes.data ?? []).map((c) => [c.id as string, c.name as string]));
    // Old expenses carry free-text categories in mixed case ("groceries" vs
    // "Groceries"). Fold case-insensitively and prefer the registry's casing.
    const canonical = new Map(
      (catRes.data ?? []).map((c) => [(c.name as string).toLowerCase(), c.name as string]),
    );
    const byCategory = new Map<string, { total: number; count: number }>();
    for (const e of expenses) {
      const raw =
        (e.category_id && catName.get(e.category_id)) || e.category || "Uncategorized";
      const name = canonical.get(String(raw).toLowerCase()) ?? raw;
      const cur = byCategory.get(name) ?? { total: 0, count: 0 };
      cur.total = money(cur.total + Number(e.amount));
      cur.count += 1;
      byCategory.set(name, cur);
    }
    return json({
      monthKey: m,
      budget,
      totalSpent,
      totalPlanned,
      leftNow: money(Math.max(0, budget - totalSpent)),
      leftAfterPlanned: money(budget - totalSpent - totalPlanned),
      expenseCount: expenses.length,
      planCount: planRes.data?.length ?? 0,
      byCategory: [...byCategory.entries()]
        .map(([category, v]) => ({ category, ...v }))
        .sort((a, b) => b.total - a.total),
    });
  },
);

tool(
  "set_budget",
  "Set the total budget amount for a month.",
  { monthKey: monthKeySchema, amount: z.number().min(0).describe("Budget amount") },
  async ({ monthKey, amount }) => {
    const userId = await ensureUserId();
    const m = mk(monthKey);
    const { error } = await supabase
      .from("budgets")
      .upsert(
        { user_id: userId, month_key: m, amount: money(amount) },
        { onConflict: "user_id,month_key" },
      );
    check(error, "Saving budget failed");
    return json({ monthKey: m, amount: money(amount) });
  },
);

// ----------------------------------------------------------------- expenses

tool(
  "list_expenses",
  "List all expenses recorded in a month.",
  { monthKey: monthKeySchema },
  async ({ monthKey }) => {
    const userId = await ensureUserId();
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .eq("month_key", mk(monthKey))
      .order("date", { ascending: true });
    check(error, "Loading expenses failed");
    return json({ expenses: (data ?? []).map(expenseJson) });
  },
);

tool(
  "add_expense",
  "Record an expense in the live app. If accountId is given, the amount is deducted from that account's balance (visible immediately in the apps).",
  {
    date: dateSchema,
    amount: z.number().positive(),
    category: z.string().optional().describe("Category name (free text)"),
    categoryId: z.string().uuid().optional().describe("Category id (preferred when known)"),
    accountId: z.string().uuid().optional().describe("Account to pay from"),
    note: z.string().optional(),
    inForecast: z
      .boolean()
      .optional()
      .describe(
        "Mark 'Show in Forecast': the expense also appears on the Forecast page as an outflow in its month. Off unless set.",
      ),
  },
  async (args) => {
    const userId = await ensureUserId();
    const monthKey = args.date.slice(0, 7);
    const id = newId();
    const { error } = await supabase.from("expenses").insert({
      id,
      user_id: userId,
      month_key: monthKey,
      date: args.date,
      amount: money(args.amount),
      category: args.category ?? null,
      category_id: args.categoryId ?? null,
      account_id: args.accountId ?? null,
      note: args.note ?? null,
      in_forecast: args.inForecast ?? false,
    });
    check(error, "Adding expense failed");
    if (args.accountId) {
      await insertTx(userId, {
        fromAccountId: args.accountId,
        amount: args.amount,
        type: "expense",
        monthKey,
        note: args.note ?? args.category ?? "Expense",
      });
    }
    return json({ id, monthKey, ...args, amount: money(args.amount) });
  },
);

tool(
  "update_expense",
  "Update an existing expense. Account balances are reconciled automatically when the amount or account changes.",
  {
    monthKey: monthKeySchema,
    expenseId: z.string().uuid(),
    date: dateSchema.optional(),
    amount: z.number().positive().optional(),
    category: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    accountId: z.string().uuid().optional(),
    note: z.string().optional(),
  },
  async ({ monthKey, expenseId, ...u }) => {
    const userId = await ensureUserId();
    const m = mk(monthKey);
    const { data: old, error: oldErr } = await supabase
      .from("expenses")
      .select("*")
      .eq("id", expenseId)
      .eq("user_id", userId)
      .eq("month_key", m)
      .maybeSingle();
    check(oldErr, "Loading expense failed");
    if (!old) throw new Error("Expense not found");

    const nextAmount = u.amount !== undefined ? money(u.amount) : Number(old.amount);
    const nextAccount = u.accountId !== undefined ? u.accountId : old.account_id;
    const balanceChange =
      nextAmount !== Number(old.amount) || nextAccount !== old.account_id;

    if (balanceChange && old.account_id) {
      await insertTx(userId, {
        toAccountId: old.account_id,
        amount: Number(old.amount),
        type: "expense",
        monthKey: m,
        note: "Expense updated - refund",
      });
    }
    if (balanceChange && nextAccount) {
      await insertTx(userId, {
        fromAccountId: nextAccount,
        amount: nextAmount,
        type: "expense",
        monthKey: m,
        note: u.note ?? old.note ?? "Expense updated",
      });
    }

    const { error } = await supabase
      .from("expenses")
      .update({
        date: u.date ?? old.date,
        amount: nextAmount,
        category: u.category !== undefined ? u.category : old.category,
        category_id: u.categoryId !== undefined ? u.categoryId : old.category_id,
        account_id: nextAccount,
        note: u.note !== undefined ? u.note : old.note,
      })
      .eq("id", expenseId)
      .eq("user_id", userId);
    check(error, "Updating expense failed");
    return json({ updated: expenseId });
  },
);

tool(
  "delete_expense",
  "Delete an expense. If it was paid from an account, the amount is refunded to that account.",
  { monthKey: monthKeySchema, expenseId: z.string().uuid() },
  async ({ monthKey, expenseId }) => {
    const userId = await ensureUserId();
    const m = mk(monthKey);
    const { data: old, error: oldErr } = await supabase
      .from("expenses")
      .select("*")
      .eq("id", expenseId)
      .eq("user_id", userId)
      .eq("month_key", m)
      .maybeSingle();
    check(oldErr, "Loading expense failed");
    if (!old) throw new Error("Expense not found");
    if (old.account_id) {
      await insertTx(userId, {
        toAccountId: old.account_id,
        amount: Number(old.amount),
        type: "expense",
        monthKey: m,
        note: "Expense deleted - refund",
      });
    }
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expenseId)
      .eq("user_id", userId);
    check(error, "Deleting expense failed");
    return json({ deleted: expenseId });
  },
);

tool(
  "search_expenses",
  'Search expenses across months by note/category text (e.g. "when did I last pay the mechanic"). Returns newest first.',
  {
    query: z.string().optional().describe("Text to match in note or category"),
    fromMonth: monthKeySchema.describe('Earliest month "YYYY-MM" (inclusive)'),
    toMonth: monthKeySchema.describe('Latest month "YYYY-MM" (inclusive)'),
  },
  async ({ query, fromMonth, toMonth }) => {
    const userId = await ensureUserId();
    let q = supabase.from("expenses").select("*").eq("user_id", userId);
    if (fromMonth) q = q.gte("month_key", fromMonth);
    if (toMonth) q = q.lte("month_key", toMonth);
    if (query) {
      const t = sanitizeLike(query);
      if (t) q = q.or(`note.ilike.%${t}%,category.ilike.%${t}%`);
    }
    const { data, error } = await q.order("date", { ascending: false }).limit(500);
    check(error, "Searching expenses failed");
    return json({ expenses: (data ?? []).map(expenseJson) });
  },
);

// -------------------------------------------------------------------- plans

tool(
  "list_plans",
  "List planned (not yet paid) expenses for a month.",
  { monthKey: monthKeySchema },
  async ({ monthKey }) => {
    const userId = await ensureUserId();
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .eq("user_id", userId)
      .eq("month_key", mk(monthKey))
      .order("week_index");
    check(error, "Loading plans failed");
    return json({ plans: (data ?? []).map(planJson) });
  },
);

tool(
  "add_plan",
  "Add a planned expense to a month (something you intend to pay but haven't yet).",
  {
    monthKey: monthKeySchema,
    amount: z.number().positive(),
    weekIndex: z.number().int().min(0).max(4).optional().describe("Week of the month, 0-4"),
    targetDate: dateSchema.optional(),
    category: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    accountId: z.string().uuid().optional().describe("Account it will be paid from"),
    note: z.string().optional(),
    inForecast: z
      .boolean()
      .optional()
      .describe(
        "Mark 'Show in Forecast': the plan appears on the Forecast page as an outflow, and stays there once it's marked paid. Off unless set.",
      ),
  },
  async ({ monthKey, ...b }) => {
    const userId = await ensureUserId();
    const id = newId();
    const { error } = await supabase.from("plans").insert({
      id,
      user_id: userId,
      month_key: mk(monthKey),
      week_index: b.weekIndex ?? 0,
      amount: money(b.amount),
      category: b.category ?? null,
      category_id: b.categoryId ?? null,
      account_id: b.accountId ?? null,
      note: b.note ?? null,
      target_date: b.targetDate ?? null,
      in_forecast: b.inForecast ?? false,
    });
    check(error, "Adding plan failed");
    return json({ id, monthKey: mk(monthKey), ...b, amount: money(b.amount) });
  },
);

tool(
  "update_plan",
  "Edit a planned (unpaid) expense in place - change its amount, category, account, week, target date, or note. No balance effects (a plan only moves money when marked paid). Omitted fields are left unchanged.",
  {
    monthKey: monthKeySchema,
    planId: z.string().uuid(),
    amount: z.number().positive().optional(),
    weekIndex: z.number().int().min(0).max(4).optional().describe("Week of the month, 0-4"),
    targetDate: dateSchema.optional(),
    category: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    accountId: z.string().uuid().optional().describe("Account it will be paid from"),
    note: z.string().optional(),
  },
  async ({ monthKey, planId, ...u }) => {
    const userId = await ensureUserId();
    const m = mk(monthKey);
    const { data: old, error: oldErr } = await supabase
      .from("plans")
      .select("*")
      .eq("id", planId)
      .eq("user_id", userId)
      .eq("month_key", m)
      .maybeSingle();
    check(oldErr, "Loading plan failed");
    if (!old) throw new Error("Plan not found");

    const { error } = await supabase
      .from("plans")
      .update({
        amount: u.amount !== undefined ? money(u.amount) : Number(old.amount),
        week_index: u.weekIndex !== undefined ? u.weekIndex : old.week_index,
        target_date: u.targetDate !== undefined ? u.targetDate : old.target_date,
        category: u.category !== undefined ? u.category : old.category,
        category_id: u.categoryId !== undefined ? u.categoryId : old.category_id,
        account_id: u.accountId !== undefined ? u.accountId : old.account_id,
        note: u.note !== undefined ? u.note : old.note,
      })
      .eq("id", planId)
      .eq("user_id", userId)
      .eq("month_key", m);
    check(error, "Updating plan failed");
    return json({ updated: planId });
  },
);

tool(
  "mark_plan_paid",
  "Convert a plan into a real expense (creates the expense, deducts the account if set, removes the plan). Future-month plans cannot be marked paid.",
  {
    monthKey: monthKeySchema,
    planId: z.string().uuid(),
    date: dateSchema.optional().describe("Payment date; defaults to the plan's target date or today"),
  },
  async ({ monthKey, planId, date }) => {
    const userId = await ensureUserId();
    const m = mk(monthKey);
    const { data: plan, error: planErr } = await supabase
      .from("plans")
      .select("*")
      .eq("id", planId)
      .eq("user_id", userId)
      .eq("month_key", m)
      .maybeSingle();
    check(planErr, "Loading plan failed");
    if (!plan) throw new Error("Plan not found");

    const payDate: string =
      date ?? plan.target_date ?? new Date().toISOString().slice(0, 10);
    const expenseMonth = payDate.slice(0, 7);
    if (expenseMonth > currentMonthKey()) {
      throw new Error("Cannot mark a future-month plan as paid");
    }

    const expenseId = newId();
    const { error: insErr } = await supabase.from("expenses").insert({
      id: expenseId,
      user_id: userId,
      month_key: expenseMonth,
      date: payDate,
      amount: Number(plan.amount),
      category: plan.category,
      category_id: plan.category_id,
      account_id: plan.account_id,
      note: plan.note,
    });
    check(insErr, "Creating expense from plan failed");
    if (plan.account_id) {
      await insertTx(userId, {
        fromAccountId: plan.account_id,
        amount: Number(plan.amount),
        type: "expense",
        monthKey: expenseMonth,
        note: plan.note ?? plan.category ?? "Plan paid",
      });
    }
    const { error: delErr } = await supabase
      .from("plans")
      .delete()
      .eq("id", planId)
      .eq("user_id", userId);
    check(delErr, "Removing paid plan failed");
    return json({ expenseId, date: payDate, amount: Number(plan.amount) });
  },
);

tool(
  "delete_plan",
  "Delete a planned expense.",
  { monthKey: monthKeySchema, planId: z.string().uuid() },
  async ({ monthKey, planId }) => {
    const userId = await ensureUserId();
    const { error } = await supabase
      .from("plans")
      .delete()
      .eq("id", planId)
      .eq("user_id", userId)
      .eq("month_key", mk(monthKey));
    check(error, "Deleting plan failed");
    return json({ deleted: planId });
  },
);

// --------------------------------------------------------------- categories

tool(
  "list_categories",
  "List the user's expense categories (id, name, color, icon).",
  {},
  async () => {
    const userId = await ensureUserId();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, color, icon, sort_order, is_default")
      .eq("user_id", userId)
      .order("sort_order");
    check(error, "Loading categories failed");
    return json({ categories: data ?? [] });
  },
);

tool(
  "create_category",
  "Create an expense category.",
  {
    name: z.string().min(1),
    color: z.string().describe('Hex color, e.g. "#ef4444"'),
    icon: z.string().describe('Lucide icon name, e.g. "shopping-cart"'),
  },
  async (b) => {
    const userId = await ensureUserId();
    const id = newId();
    const { error } = await supabase
      .from("categories")
      .insert({ id, user_id: userId, name: b.name, color: b.color, icon: b.icon });
    check(error, "Creating category failed");
    return json({ id, ...b });
  },
);

tool(
  "update_category",
  "Rename a category or change its color/icon. Expenses keep pointing at it by id.",
  {
    categoryId: z.string().uuid(),
    name: z.string().min(1).optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
  },
  async ({ categoryId, ...u }) => {
    const userId = await ensureUserId();
    const patch: Record<string, unknown> = {};
    if (u.name !== undefined) patch.name = u.name;
    if (u.color !== undefined) patch.color = u.color;
    if (u.icon !== undefined) patch.icon = u.icon;
    if (Object.keys(patch).length === 0) throw new Error("Nothing to update");
    const { error, count } = await supabase
      .from("categories")
      .update(patch, { count: "exact" })
      .eq("id", categoryId)
      .eq("user_id", userId);
    check(error, "Updating category failed");
    if (!count) throw new Error("Category not found");
    return json({ updated: categoryId });
  },
);

tool(
  "normalize_expense_categories",
  "Bulk cleanup: attach expenses that only carry free-text categories to the matching registry category (case-insensitive), fixing splits like 'groceries' vs 'Groceries'. Optionally remap named categories to another (e.g. everything texted 'food' onto Groceries). Dry-run by default; pass apply: true to write.",
  {
    fromMonth: monthKeySchema.describe('Earliest month "YYYY-MM" (inclusive); defaults to all history'),
    toMonth: monthKeySchema.describe('Latest month "YYYY-MM" (inclusive)'),
    remap: z
      .record(z.string())
      .optional()
      .describe('Extra text-to-category mappings, e.g. {"food": "Groceries"} (values are registry category names)'),
    apply: z.boolean().optional().describe("Actually write the changes (default false: report only)"),
  },
  async ({ fromMonth, toMonth, remap, apply }) => {
    const userId = await ensureUserId();
    const { data: cats, error: catErr } = await supabase
      .from("categories")
      .select("id, name")
      .eq("user_id", userId);
    check(catErr, "Loading categories failed");
    const byLower = new Map(
      (cats ?? []).map((c) => [(c.name as string).toLowerCase(), { id: c.id as string, name: c.name as string }]),
    );
    for (const [from, to] of Object.entries(remap ?? {})) {
      const target = byLower.get(to.toLowerCase());
      if (!target) throw new Error(`remap target "${to}" is not a category`);
      byLower.set(from.toLowerCase(), target);
    }

    let q = supabase
      .from("expenses")
      .select("id, month_key, category, category_id")
      .eq("user_id", userId)
      .is("category_id", null)
      .not("category", "is", null);
    if (fromMonth) q = q.gte("month_key", fromMonth);
    if (toMonth) q = q.lte("month_key", toMonth);
    const { data: rows, error } = await q.limit(5000);
    check(error, "Loading expenses failed");

    const planned = new Map<string, { name: string; ids: string[] }>();
    const unmatched = new Map<string, number>();
    for (const r of rows ?? []) {
      const target = byLower.get(String(r.category).toLowerCase());
      if (!target) {
        const key = String(r.category);
        unmatched.set(key, (unmatched.get(key) ?? 0) + 1);
        continue;
      }
      const cur = planned.get(target.id) ?? { name: target.name, ids: [] };
      cur.ids.push(r.id as string);
      planned.set(target.id, cur);
    }

    if (apply) {
      for (const [categoryId, { name, ids }] of planned) {
        // Chunk the id list so the request stays well under URL limits.
        for (let i = 0; i < ids.length; i += 100) {
          const chunk = ids.slice(i, i + 100);
          const { error: upErr } = await supabase
            .from("expenses")
            .update({ category_id: categoryId, category: name })
            .eq("user_id", userId)
            .in("id", chunk);
          check(upErr, `Normalizing to ${name} failed`);
        }
      }
    }

    return json({
      applied: !!apply,
      scanned: rows?.length ?? 0,
      changes: [...planned.entries()].map(([categoryId, v]) => ({
        categoryId,
        category: v.name,
        expenses: v.ids.length,
      })),
      unmatchedTexts: [...unmatched.entries()].map(([text, count]) => ({ text, count })),
    });
  },
);

// ----------------------------------------------------------------- accounts

tool(
  "list_accounts",
  "List wallet accounts: the currencies each holds, its balance per currency, and the total converted to the base display currency at the user's exchange rates.",
  {},
  async () => {
    const userId = await ensureUserId();
    const [accRes, balRes, setRes, rateRes] = await Promise.all([
      supabase
        .from("accounts")
        .select("id, name, account_type, currency, currencies, is_default, color, icon")
        .eq("user_id", userId)
        .order("sort_order"),
      supabase
        .from("account_balances")
        .select("account_id, currency, current_balance, initial_balance")
        .eq("user_id", userId),
      supabase.from("user_settings").select("base_currency").eq("user_id", userId).maybeSingle(),
      supabase.from("exchange_rates").select("currency, rate").eq("user_id", userId),
    ]);
    check(accRes.error, "Loading accounts failed");
    check(balRes.error, "Loading account balances failed");
    check(setRes.error, "Loading settings failed");
    check(rateRes.error, "Loading exchange rates failed");

    const baseCurrency = (setRes.data?.base_currency as string) ?? "USD";
    // rate = units of the currency per 1 base unit; base itself is 1.
    const perBase = new Map<string, number>([[baseCurrency, 1]]);
    for (const r of rateRes.data ?? []) perBase.set(r.currency as string, Number(r.rate));

    const byAccount = new Map<string, Record<string, number>>();
    for (const b of balRes.data ?? []) {
      const cur = byAccount.get(b.account_id as string) ?? {};
      cur[b.currency as string] = Number(b.current_balance);
      byAccount.set(b.account_id as string, cur);
    }

    return json({
      baseCurrency,
      accounts: (accRes.data ?? []).map((a) => {
        const balances = byAccount.get(a.id as string) ?? {};
        let baseTotal = 0;
        for (const [cur, amt] of Object.entries(balances)) {
          const rate = perBase.get(cur);
          baseTotal += rate ? amt / rate : 0;
        }
        return {
          id: a.id,
          name: a.name,
          accountType: a.account_type,
          primaryCurrency: a.currency,
          currencies: a.currencies ?? [a.currency],
          balances, // native amount per currency
          baseBalance: money(baseTotal), // everything converted to baseCurrency
          isDefault: !!a.is_default,
          color: a.color ?? undefined,
          icon: a.icon ?? undefined,
        };
      }),
    });
  },
);

tool(
  "get_currency_settings",
  "Get the base display currency and the user's default exchange rates (units of each currency per 1 base unit). Per-transaction rate overrides are snapshotted on the transactions themselves.",
  {},
  async () => {
    const userId = await ensureUserId();
    const [setRes, rateRes] = await Promise.all([
      supabase.from("user_settings").select("base_currency").eq("user_id", userId).maybeSingle(),
      supabase.from("exchange_rates").select("currency, rate, updated_at").eq("user_id", userId),
    ]);
    check(setRes.error, "Loading settings failed");
    check(rateRes.error, "Loading exchange rates failed");
    return json({
      baseCurrency: (setRes.data?.base_currency as string) ?? "USD",
      rates: (rateRes.data ?? []).map((r) => ({
        currency: r.currency,
        ratePerBase: Number(r.rate),
        updatedAt: r.updated_at ?? undefined,
      })),
    });
  },
);

tool(
  "create_account",
  "Create an account (checking, savings, credit, cash, or other) with an opening balance.",
  {
    name: z.string().min(1),
    accountType: z.enum(["checking", "savings", "credit", "cash", "other"]),
    initialBalance: z.number().optional(),
    isDefault: z.boolean().optional().describe("Default account for overdraft coverage"),
  },
  async (b) => {
    const userId = await ensureUserId();
    const id = newId();
    const bal = money(b.initialBalance ?? 0);
    const { error } = await supabase.from("accounts").insert({
      id,
      user_id: userId,
      name: b.name,
      account_type: b.accountType,
      initial_balance: bal,
      current_balance: bal,
      is_default: b.isDefault ?? false,
    });
    check(error, "Creating account failed");
    return json({ id, ...b, currentBalance: bal });
  },
);

tool(
  "deposit",
  "Deposit money into an account. This is the app's income event. Amount is in `currency` (defaults to the account's primary currency in a wallet, or the base currency).",
  {
    accountId: z.string().uuid(),
    amount: z.number().positive(),
    currency: z
      .string()
      .length(3)
      .optional()
      .describe('Currency of the amount, e.g. "USD", "AED", "LBP". Must be one the account holds.'),
    exchangeRate: z
      .number()
      .positive()
      .optional()
      .describe(
        "Override rate for this transaction: base units per 1 unit of `currency` (e.g. ~0.2717 for AED when 1 USD = 3.68 AED). Defaults to the Settings rate.",
      ),
    note: z.string().optional(),
    inForecast: z
      .boolean()
      .optional()
      .describe(
        "Mark 'Show in Forecast': the income also appears on the Forecast page as an inflow in the month it's recorded. Off unless set.",
      ),
  },
  async ({ accountId, amount, currency, exchangeRate, note, inForecast }) => {
    const userId = await ensureUserId();
    // Snapshot the base value at entry, so later rate edits never rewrite
    // history. Stored exchange_rate follows the app's convention: target
    // (base) units per 1 source (currency) unit.
    let baseAmount: number | undefined;
    if (currency) {
      const [setRes, rateRes] = await Promise.all([
        supabase.from("user_settings").select("base_currency").eq("user_id", userId).maybeSingle(),
        supabase.from("exchange_rates").select("rate").eq("user_id", userId).eq("currency", currency).maybeSingle(),
      ]);
      const base = (setRes.data?.base_currency as string) ?? "USD";
      // Settings store currency-per-base; invert to base-per-currency.
      const settingsRate = rateRes.data ? 1 / Number(rateRes.data.rate) : undefined;
      const rate = currency === base ? 1 : exchangeRate ?? settingsRate;
      if (!rate) throw new Error(`No exchange rate known for ${currency}; pass exchangeRate`);
      exchangeRate = rate;
      baseAmount = amount * rate;
    }
    const txId = await insertTx(userId, {
      toAccountId: accountId,
      amount,
      type: "deposit",
      note: note ?? "Deposit",
      inForecast,
      currency,
      baseAmount,
      exchangeRate,
    });
    return json({ transactionId: txId, baseAmount: baseAmount !== undefined ? money(baseAmount) : undefined });
  },
);

tool(
  "transfer",
  "Transfer money between two accounts, or between two currencies of the same wallet account (pass the same account with different currency/toCurrency). Amount is in `currency`; toAmount in `toCurrency` for cross-currency moves.",
  {
    fromAccountId: z.string().uuid(),
    toAccountId: z.string().uuid(),
    amount: z.number().positive(),
    currency: z.string().length(3).optional().describe("Currency the amount leaves in"),
    toAmount: z
      .number()
      .positive()
      .optional()
      .describe("Amount arriving on the destination side (cross-currency moves)"),
    toCurrency: z.string().length(3).optional().describe("Currency the money arrives in"),
    exchangeRate: z
      .number()
      .positive()
      .optional()
      .describe("Rate used for this transaction: toCurrency units per 1 source unit"),
    note: z.string().optional(),
  },
  async ({ fromAccountId, toAccountId, amount, currency, toAmount, toCurrency, exchangeRate, note }) => {
    const crossCurrency = toCurrency !== undefined && toCurrency !== currency;
    if (fromAccountId === toAccountId && !crossCurrency)
      throw new Error("Cannot transfer to the same account (same-account moves must change currency)");
    if (crossCurrency && toAmount === undefined && exchangeRate === undefined)
      throw new Error("Cross-currency transfer needs toAmount or exchangeRate");
    const userId = await ensureUserId();
    const txId = await insertTx(userId, {
      fromAccountId,
      toAccountId,
      amount,
      type: "transfer",
      note: note ?? "Transfer",
      currency,
      toCurrency,
      toAmount: crossCurrency ? toAmount ?? money(amount * exchangeRate!) : undefined,
      exchangeRate,
    });
    return json({ transactionId: txId });
  },
);

tool(
  "list_transactions",
  "List account transactions (deposits, transfers, expenses, allocations, contributions), newest first.",
  {
    accountId: z.string().uuid().optional(),
    type: z
      .enum([
        "transfer",
        "budget_allocation",
        "savings_contribution",
        "overdraft_coverage",
        "deposit",
        "expense",
      ])
      .optional(),
    monthKey: monthKeySchema,
    limit: z.number().int().positive().max(1000).optional(),
  },
  async ({ accountId, type, monthKey, limit }) => {
    const userId = await ensureUserId();
    let q = supabase.from("account_transactions").select("*").eq("user_id", userId);
    if (accountId) q = q.or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`);
    if (type) q = q.eq("transaction_type", type);
    // Deposits and transfers carry no month_key; match them by created_at so a
    // month filter actually returns the month's income.
    if (monthKey) {
      q = q.or(
        `month_key.eq.${monthKey},and(month_key.is.null,created_at.gte.${monthKey}-01,created_at.lt.${nextMonthStart(monthKey)})`,
      );
    }
    const { data, error } = await q
      .order("created_at", { ascending: false })
      .limit(limit ?? 200);
    check(error, "Loading transactions failed");
    return json({
      transactions: (data ?? []).map((r) => ({
        id: r.id,
        fromAccountId: r.from_account_id ?? undefined,
        toAccountId: r.to_account_id ?? undefined,
        amount: Number(r.amount),
        currency: r.currency ?? undefined,
        toAmount: r.to_amount !== null ? Number(r.to_amount) : undefined,
        toCurrency: r.to_currency ?? undefined,
        baseAmount: r.base_amount !== null ? Number(r.base_amount) : undefined,
        exchangeRate: r.exchange_rate !== null ? Number(r.exchange_rate) : undefined,
        transactionType: r.transaction_type,
        monthKey: r.month_key ?? undefined,
        savingsGoalId: r.savings_goal_id ?? undefined,
        note: r.note ?? undefined,
        inForecast: r.in_forecast ? true : undefined,
        createdAt: r.created_at,
      })),
    });
  },
);

tool(
  "undo_transaction",
  "Undo a deposit or transfer (the only transaction types the app allows deleting). Balances are reversed automatically.",
  { transactionId: z.string().uuid() },
  async ({ transactionId }) => {
    const userId = await ensureUserId();
    const { error, count } = await supabase
      .from("account_transactions")
      .delete({ count: "exact" })
      .eq("id", transactionId)
      .eq("user_id", userId)
      .in("transaction_type", ["deposit", "transfer"]);
    check(error, "Undoing transaction failed");
    if (!count) throw new Error("Transaction not found or not undoable (only deposits/transfers)");
    return json({ undone: transactionId });
  },
);

tool(
  "allocate_to_budget",
  "Move money from an account into a month's budget envelope (deducts the account, records the allocation).",
  {
    monthKey: monthKeySchema,
    accountId: z.string().uuid(),
    amount: z.number().positive(),
  },
  async ({ monthKey, accountId, amount }) => {
    const userId = await ensureUserId();
    const m = mk(monthKey);
    const amt = money(amount);
    const { data: existing, error: exErr } = await supabase
      .from("budget_allocations")
      .select("id, amount")
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .eq("month_key", m)
      .maybeSingle();
    check(exErr, "Loading allocation failed");

    // Allocation row first, balance-mutating transaction second (same
    // ordering fix the app received).
    if (existing) {
      const { error } = await supabase
        .from("budget_allocations")
        .update({ amount: money(Number(existing.amount) + amt) })
        .eq("id", existing.id);
      check(error, "Updating allocation failed");
    } else {
      const { error } = await supabase.from("budget_allocations").insert({
        id: newId(),
        user_id: userId,
        account_id: accountId,
        month_key: m,
        amount: amt,
      });
      check(error, "Creating allocation failed");
    }
    await insertTx(userId, {
      fromAccountId: accountId,
      amount: amt,
      type: "budget_allocation",
      monthKey: m,
      note: `Allocated to ${m} budget`,
    });
    return json({ monthKey: m, accountId, allocated: amt });
  },
);

// ------------------------------------------------------------------ savings

tool(
  "list_savings_goals",
  "List savings goals with target, progress, and completion state.",
  {},
  async () => {
    const userId = await ensureUserId();
    const { data, error } = await supabase
      .from("savings_goals")
      .select("id, name, target_amount, current_amount, deadline, is_completed")
      .eq("user_id", userId)
      .order("created_at");
    check(error, "Loading savings goals failed");
    return json({
      goals: (data ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        targetAmount: Number(g.target_amount),
        currentAmount: Number(g.current_amount),
        deadline: g.deadline ?? undefined,
        isCompleted: !!g.is_completed,
      })),
    });
  },
);

tool(
  "create_savings_goal",
  "Create a savings goal.",
  {
    name: z.string().min(1),
    targetAmount: z.number().positive(),
    deadline: dateSchema.optional(),
  },
  async (b) => {
    const userId = await ensureUserId();
    const id = newId();
    const { error } = await supabase.from("savings_goals").insert({
      id,
      user_id: userId,
      name: b.name,
      target_amount: money(b.targetAmount),
      deadline: b.deadline ?? null,
    });
    check(error, "Creating savings goal failed");
    return json({ id, ...b });
  },
);

tool(
  "contribute_to_goal",
  "Contribute money from an account to a savings goal (deducts the account, advances the goal, flips completion when the target is reached).",
  {
    goalId: z.string().uuid(),
    accountId: z.string().uuid(),
    amount: z.number().positive(),
    note: z.string().optional(),
  },
  async ({ goalId, accountId, amount, note }) => {
    const userId = await ensureUserId();
    const amt = money(amount);
    // Contribution row (DB trigger advances the goal), then the account
    // transaction (DB trigger deducts the balance) - the app's order.
    const { error } = await supabase.from("savings_contributions").insert({
      id: newId(),
      user_id: userId,
      savings_goal_id: goalId,
      account_id: accountId,
      amount: amt,
      note: note ?? null,
    });
    check(error, "Recording contribution failed");
    await insertTx(userId, {
      fromAccountId: accountId,
      amount: amt,
      type: "savings_contribution",
      savingsGoalId: goalId,
      note: note ?? "Savings contribution",
    });
    return json({ goalId, contributed: amt });
  },
);

// ----------------------------------------------------------------- forecast

const forecastFlowJson = (r: Record<string, unknown>) => ({
  id: r.id,
  year: r.year,
  months: r.months ?? [],
  type: r.type,
  name: r.name ?? undefined,
  uncertain: !!r.uncertain,
  value: r.value !== null ? Number(r.value) : undefined,
  lowValue: r.low_value !== null ? Number(r.low_value) : undefined,
  highValue: r.high_value !== null ? Number(r.high_value) : undefined,
  isGhost: !!r.is_ghost,
  enabled: !!r.enabled,
  // Computed (rule) flows: no stored amount, the months are totalled from real
  // records instead. rule.targetValue is the committed monthly plan number
  // that drives the forecast from the current month on.
  rule: r.rule_source
    ? {
        source: r.rule_source,
        accountIds: r.rule_account_ids ?? [],
        categoryIds: r.rule_category_ids ?? [],
        excludeLinked: r.rule_exclude_linked !== false,
        projection: r.rule_projection ?? "none",
        projectionWindow: Number(r.rule_projection_window ?? 3),
        fixedValue: r.rule_fixed_value !== null ? Number(r.rule_fixed_value) : undefined,
        targetValue: r.rule_target_value !== null ? Number(r.rule_target_value) : undefined,
      }
    : undefined,
});

const ruleShape = {
  ruleSource: z
    .enum(["expenses", "deposits", "plans", "picked"])
    .optional()
    .describe("Makes this a computed flow: total real records per month instead of typing an amount"),
  ruleAccountIds: z.array(z.string().uuid()).optional().describe("Restrict the rule to these accounts (empty = all)"),
  ruleCategoryIds: z.array(z.string().uuid()).optional().describe("Restrict the rule to these categories (empty = all)"),
  ruleExcludeLinked: z.boolean().optional().describe("Skip records already marked on the forecast individually (default true)"),
  ruleProjection: z.enum(["none", "average", "median", "last", "fixed"]).optional(),
  ruleProjectionWindow: z.number().int().min(1).max(24).optional(),
  ruleFixedValue: z.number().optional(),
  ruleTargetValue: z
    .number()
    .optional()
    .describe("Committed monthly plan number: drives the forecast and graph from the current month on, with the real total shown beside it"),
};

function ruleColumns(b: {
  ruleSource?: string;
  ruleAccountIds?: string[];
  ruleCategoryIds?: string[];
  ruleExcludeLinked?: boolean;
  ruleProjection?: string;
  ruleProjectionWindow?: number;
  ruleFixedValue?: number;
  ruleTargetValue?: number;
}): Record<string, unknown> {
  if (!b.ruleSource) return {};
  return {
    rule_source: b.ruleSource,
    rule_account_ids: b.ruleAccountIds ?? [],
    rule_category_ids: b.ruleCategoryIds ?? [],
    rule_exclude_linked: b.ruleExcludeLinked ?? true,
    rule_projection: b.ruleProjection ?? "none",
    rule_projection_window: b.ruleProjectionWindow ?? 3,
    rule_fixed_value: b.ruleFixedValue ?? null,
    rule_target_value: b.ruleTargetValue ?? null,
  };
}

tool(
  "list_forecast_flows",
  "List cash-flow forecast entries for a year: typed flows, computed (rule) flows with their rule spec and monthly target, and the real records linked onto the forecast (expenses, plans, deposits marked 'Show in Forecast').",
  { year: z.number().int().optional() },
  async ({ year }) => {
    const userId = await ensureUserId();
    const y = year ?? new Date().getFullYear();
    let q = supabase.from("forecast_flows").select("*").eq("user_id", userId).eq("year", y);
    const [flowRes, expRes, planRes, depRes] = await Promise.all([
      q.order("sort_order"),
      supabase
        .from("expenses")
        .select("id, date, amount, note, category, forecast_enabled")
        .eq("user_id", userId)
        .eq("in_forecast", true)
        .gte("month_key", `${y}-01`)
        .lte("month_key", `${y}-12`),
      supabase
        .from("plans")
        .select("id, month_key, target_date, amount, note, category, forecast_enabled")
        .eq("user_id", userId)
        .eq("in_forecast", true)
        .gte("month_key", `${y}-01`)
        .lte("month_key", `${y}-12`),
      supabase
        .from("account_transactions")
        .select("id, amount, base_amount, note, created_at, forecast_enabled")
        .eq("user_id", userId)
        .eq("transaction_type", "deposit")
        .eq("in_forecast", true)
        .gte("created_at", `${y}-01-01`)
        .lt("created_at", `${y + 1}-01-01`),
    ]);
    check(flowRes.error, "Loading forecast flows failed");
    check(expRes.error, "Loading linked expenses failed");
    check(planRes.error, "Loading linked plans failed");
    check(depRes.error, "Loading linked deposits failed");
    return json({
      year: y,
      flows: (flowRes.data ?? []).map(forecastFlowJson),
      linked: [
        ...(expRes.data ?? []).map((r) => ({
          kind: "expense",
          id: r.id,
          month: Number(String(r.date).slice(5, 7)),
          type: "out",
          amount: Number(r.amount),
          name: r.note ?? r.category ?? "Expense",
          enabled: r.forecast_enabled !== false,
        })),
        ...(planRes.data ?? []).map((r) => ({
          kind: "plan",
          id: r.id,
          month: Number(String(r.target_date ?? `${r.month_key}-01`).slice(5, 7)),
          type: "out",
          amount: Number(r.amount),
          name: r.note ?? r.category ?? "Plan",
          enabled: r.forecast_enabled !== false,
        })),
        ...(depRes.data ?? []).map((r) => ({
          kind: "deposit",
          id: r.id,
          month: Number(String(r.created_at).slice(5, 7)),
          type: "in",
          amount: r.base_amount !== null ? Number(r.base_amount) : Number(r.amount),
          name: r.note ?? "Income",
          enabled: r.forecast_enabled !== false,
        })),
      ],
    });
  },
);

tool(
  "add_forecast_flow",
  "Add a forecast cash flow: money in or out, in specific months of a year, certain (value) or uncertain (lowValue..highValue). Pass ruleSource to create a computed flow that totals real records per month instead (with an optional monthly target).",
  {
    year: z.number().int(),
    months: z.array(z.number().int().min(1).max(12)).describe("Months 1-12 the flow occurs in"),
    type: z.enum(["in", "out"]),
    name: z.string().optional(),
    value: z.number().optional().describe("Certain amount (ignored for computed flows)"),
    uncertain: z.boolean().optional(),
    lowValue: z.number().optional(),
    highValue: z.number().optional(),
    isGhost: z.boolean().optional().describe("Hypothetical what-if flow"),
    ...ruleShape,
  },
  async (b) => {
    const userId = await ensureUserId();
    const id = newId();
    const computed = !!b.ruleSource;
    const { error } = await supabase.from("forecast_flows").insert({
      id,
      user_id: userId,
      year: b.year,
      months: b.months,
      type: b.type,
      name: b.name ?? null,
      uncertain: computed ? false : b.uncertain ?? false,
      value: computed ? null : b.value ?? null,
      low_value: computed ? null : b.lowValue ?? null,
      high_value: computed ? null : b.highValue ?? null,
      is_ghost: b.isGhost ?? false,
      ...ruleColumns(b),
    });
    check(error, "Creating forecast flow failed");
    return json({ id, ...b });
  },
);

tool(
  "update_forecast_flow",
  "Update a forecast flow: amount, months, name, on/off, or its rule settings (including the monthly target). Omitted fields are left unchanged.",
  {
    flowId: z.string().uuid(),
    months: z.array(z.number().int().min(1).max(12)).optional(),
    name: z.string().optional(),
    value: z.number().optional(),
    lowValue: z.number().optional(),
    highValue: z.number().optional(),
    enabled: z.boolean().optional(),
    ...ruleShape,
  },
  async ({ flowId, ...u }) => {
    const userId = await ensureUserId();
    const patch: Record<string, unknown> = {};
    if (u.months !== undefined) patch.months = u.months;
    if (u.name !== undefined) patch.name = u.name;
    if (u.value !== undefined) patch.value = money(u.value);
    if (u.lowValue !== undefined) patch.low_value = money(u.lowValue);
    if (u.highValue !== undefined) patch.high_value = money(u.highValue);
    if (u.enabled !== undefined) patch.enabled = u.enabled;
    // Rule fields patch individually so a target can be set without restating
    // the whole rule.
    if (u.ruleSource !== undefined) patch.rule_source = u.ruleSource;
    if (u.ruleAccountIds !== undefined) patch.rule_account_ids = u.ruleAccountIds;
    if (u.ruleCategoryIds !== undefined) patch.rule_category_ids = u.ruleCategoryIds;
    if (u.ruleExcludeLinked !== undefined) patch.rule_exclude_linked = u.ruleExcludeLinked;
    if (u.ruleProjection !== undefined) patch.rule_projection = u.ruleProjection;
    if (u.ruleProjectionWindow !== undefined) patch.rule_projection_window = u.ruleProjectionWindow;
    if (u.ruleFixedValue !== undefined) patch.rule_fixed_value = u.ruleFixedValue;
    if (u.ruleTargetValue !== undefined) patch.rule_target_value = u.ruleTargetValue;
    if (Object.keys(patch).length === 0) throw new Error("Nothing to update");
    const { error, count } = await supabase
      .from("forecast_flows")
      .update(patch, { count: "exact" })
      .eq("id", flowId)
      .eq("user_id", userId);
    check(error, "Updating forecast flow failed");
    if (!count) throw new Error("Forecast flow not found");
    return json({ updated: flowId });
  },
);

tool(
  "delete_forecast_flow",
  "Delete a forecast flow (typed or computed). Real records a rule was totalling are not touched.",
  { flowId: z.string().uuid() },
  async ({ flowId }) => {
    const userId = await ensureUserId();
    const { error, count } = await supabase
      .from("forecast_flows")
      .delete({ count: "exact" })
      .eq("id", flowId)
      .eq("user_id", userId);
    check(error, "Deleting forecast flow failed");
    if (!count) throw new Error("Forecast flow not found");
    return json({ deleted: flowId });
  },
);

// -------------------------------------------------------------------- start

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("budgetability-live MCP server running (stdio, Supabase backend)");

// Register with H exactly like comms-hub: announce the stdio launch spec to H's
// MCP registry on startup + on a TTL timer. H then spawns this server into every
// agent/terminal, and each spawned instance re-announces - so the entry stays
// `up` resiliently instead of dying with one standalone heartbeat process.
startHAnnounce(3600);

// Generic MCP registry announce (no-op unless MCP_REGISTRY_URL is set).
startRegistryAnnouncer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
  description:
    "Budgetability live MCP server - operates on the production Supabase backend as the signed-in user (RLS enforced). Budgets, expenses, plans, envelope accounts, savings goals, forecast.",
  tags: ["budgetability", "budget", "finance", "supabase", "live"],
  env: [
    { name: "SUPABASE_EMAIL", required: true, description: "Budgetability account email" },
    { name: "SUPABASE_PASSWORD", required: true, secret: true, description: "Budgetability account password" },
    { name: "SUPABASE_URL", required: false, description: "Defaults to the production project" },
    { name: "SUPABASE_PUBLISHABLE_KEY", required: false, description: "Defaults to the production key" },
  ],
  tools: toolMetas,
});
