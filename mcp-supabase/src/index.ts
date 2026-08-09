#!/usr/bin/env node
/**
 * Budgetability MCP server — LIVE Supabase edition (stdio).
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

// ----------------------------------------------------------- row mappers

const expenseJson = (r: Record<string, unknown>) => ({
  id: r.id,
  monthKey: r.month_key,
  date: r.date,
  amount: Number(r.amount),
  category: r.category ?? undefined,
  categoryId: r.category_id ?? undefined,
  accountId: r.account_id ?? undefined,
  note: r.note ?? undefined,
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
    // Deposits only — a DB check constraint rejects the flag on other types.
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
    const byCategory = new Map<string, { total: number; count: number }>();
    for (const e of expenses) {
      const name =
        (e.category_id && catName.get(e.category_id)) || e.category || "Uncategorized";
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
  "Edit a planned (unpaid) expense in place — change its amount, category, account, week, target date, or note. No balance effects (a plan only moves money when marked paid). Omitted fields are left unchanged.",
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

// ----------------------------------------------------------------- accounts

tool(
  "list_accounts",
  "List accounts with their current balances.",
  {},
  async () => {
    const userId = await ensureUserId();
    const { data, error } = await supabase
      .from("accounts")
      .select("id, name, account_type, current_balance, is_default, color, icon")
      .eq("user_id", userId)
      .order("sort_order");
    check(error, "Loading accounts failed");
    return json({
      accounts: (data ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        accountType: a.account_type,
        currentBalance: Number(a.current_balance),
        isDefault: !!a.is_default,
        color: a.color ?? undefined,
        icon: a.icon ?? undefined,
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
  "Deposit money into an account. This is the app's income event.",
  {
    accountId: z.string().uuid(),
    amount: z.number().positive(),
    note: z.string().optional(),
    inForecast: z
      .boolean()
      .optional()
      .describe(
        "Mark 'Show in Forecast': the income also appears on the Forecast page as an inflow in the month it's recorded. Off unless set.",
      ),
  },
  async ({ accountId, amount, note, inForecast }) => {
    const userId = await ensureUserId();
    const txId = await insertTx(userId, {
      toAccountId: accountId,
      amount,
      type: "deposit",
      note: note ?? "Deposit",
      inForecast,
    });
    return json({ transactionId: txId });
  },
);

tool(
  "transfer",
  "Transfer money between two accounts.",
  {
    fromAccountId: z.string().uuid(),
    toAccountId: z.string().uuid(),
    amount: z.number().positive(),
    note: z.string().optional(),
  },
  async ({ fromAccountId, toAccountId, amount, note }) => {
    if (fromAccountId === toAccountId) throw new Error("Cannot transfer to the same account");
    const userId = await ensureUserId();
    const txId = await insertTx(userId, {
      fromAccountId,
      toAccountId,
      amount,
      type: "transfer",
      note: note ?? "Transfer",
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
    if (monthKey) q = q.eq("month_key", monthKey);
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
        transactionType: r.transaction_type,
        monthKey: r.month_key ?? undefined,
        savingsGoalId: r.savings_goal_id ?? undefined,
        note: r.note ?? undefined,
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
    // transaction (DB trigger deducts the balance) — the app's order.
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

tool(
  "list_forecast_flows",
  "List cash-flow forecast entries (recurring ins/outs by year and month, with uncertainty ranges).",
  { year: z.number().int().optional() },
  async ({ year }) => {
    const userId = await ensureUserId();
    let q = supabase.from("forecast_flows").select("*").eq("user_id", userId);
    if (year !== undefined) q = q.eq("year", year);
    const { data, error } = await q.order("sort_order");
    check(error, "Loading forecast flows failed");
    return json({
      flows: (data ?? []).map((r) => ({
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
      })),
    });
  },
);

tool(
  "add_forecast_flow",
  "Add a forecast cash flow: money in or out, in specific months of a year, certain (value) or uncertain (lowValue..highValue).",
  {
    year: z.number().int(),
    months: z.array(z.number().int().min(1).max(12)).describe("Months 1-12 the flow occurs in"),
    type: z.enum(["in", "out"]),
    name: z.string().optional(),
    value: z.number().optional().describe("Certain amount"),
    uncertain: z.boolean().optional(),
    lowValue: z.number().optional(),
    highValue: z.number().optional(),
  },
  async (b) => {
    const userId = await ensureUserId();
    const id = newId();
    const { error } = await supabase.from("forecast_flows").insert({
      id,
      user_id: userId,
      year: b.year,
      months: b.months,
      type: b.type,
      name: b.name ?? null,
      uncertain: b.uncertain ?? false,
      value: b.value ?? null,
      low_value: b.lowValue ?? null,
      high_value: b.highValue ?? null,
    });
    check(error, "Creating forecast flow failed");
    return json({ id, ...b });
  },
);

// -------------------------------------------------------------------- start

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("budgetability-live MCP server running (stdio, Supabase backend)");

// Register with H exactly like comms-hub: announce the stdio launch spec to H's
// MCP registry on startup + on a TTL timer. H then spawns this server into every
// agent/terminal, and each spawned instance re-announces — so the entry stays
// `up` resiliently instead of dying with one standalone heartbeat process.
startHAnnounce(3600);

// Generic MCP registry announce (no-op unless MCP_REGISTRY_URL is set).
startRegistryAnnouncer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
  description:
    "Budgetability live MCP server — operates on the production Supabase backend as the signed-in user (RLS enforced). Budgets, expenses, plans, envelope accounts, savings goals, forecast.",
  tags: ["budgetability", "budget", "finance", "supabase", "live"],
  env: [
    { name: "SUPABASE_EMAIL", required: true, description: "Budgetability account email" },
    { name: "SUPABASE_PASSWORD", required: true, secret: true, description: "Budgetability account password" },
    { name: "SUPABASE_URL", required: false, description: "Defaults to the production project" },
    { name: "SUPABASE_PUBLISHABLE_KEY", required: false, description: "Defaults to the production key" },
  ],
  tools: toolMetas,
});
