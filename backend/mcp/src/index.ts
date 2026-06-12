#!/usr/bin/env node
/**
 * Budgetability MCP server (stdio).
 *
 * Exposes budget, expense, plan, account, savings, and forecast tools on
 * top of the standalone Budgetability API (backend/api). Configure with:
 *   BUDGETABILITY_API_URL   (default http://localhost:8787)
 *   BUDGETABILITY_TOKEN     personal access token, or
 *   BUDGETABILITY_EMAIL / BUDGETABILITY_PASSWORD
 */
import { McpServer, type ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { api, currentMonthKey } from "./client.js";
import { startRegistryAnnouncer, type ToolMeta } from "./registry.js";

const SERVER_NAME = "budgetability";
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

// ------------------------------------------------------------- month / budget

tool(
  "get_month_summary",
  "Get the full summary for a month: budget, total spent, total planned, money left now, money left after planned expenses, and spending grouped by category.",
  { monthKey: monthKeySchema },
  async ({ monthKey }) => json(await api("GET", `/months/${mk(monthKey)}/summary`)),
);

tool(
  "set_budget",
  "Set the total budget amount for a month.",
  { monthKey: monthKeySchema, amount: z.number().min(0).describe("Budget amount") },
  async ({ monthKey, amount }) =>
    json(await api("PUT", `/months/${mk(monthKey)}/budget`, { amount })),
);

// ----------------------------------------------------------------- expenses

tool(
  "list_expenses",
  "List all expenses recorded in a month.",
  { monthKey: monthKeySchema },
  async ({ monthKey }) => json(await api("GET", `/months/${mk(monthKey)}/expenses`)),
);

tool(
  "add_expense",
  "Record an expense. If accountId is given, the amount is deducted from that account's balance.",
  {
    date: dateSchema,
    amount: z.number().positive(),
    category: z.string().optional().describe("Category name (free text)"),
    categoryId: z.string().uuid().optional().describe("Category id (preferred when known)"),
    accountId: z.string().uuid().optional().describe("Account to pay from"),
    note: z.string().optional(),
  },
  async (args) =>
    json(await api("POST", `/months/${args.date.slice(0, 7)}/expenses`, args)),
);

tool(
  "update_expense",
  "Update an existing expense. Account balances are reconciled automatically when amount or account changes.",
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
  async ({ monthKey, expenseId, ...updates }) =>
    json(await api("PATCH", `/months/${mk(monthKey)}/expenses/${expenseId}`, updates)),
);

tool(
  "delete_expense",
  "Delete an expense. If it was paid from an account, the amount is refunded to that account.",
  { monthKey: monthKeySchema, expenseId: z.string().uuid() },
  async ({ monthKey, expenseId }) => {
    await api("DELETE", `/months/${mk(monthKey)}/expenses/${expenseId}`);
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
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (fromMonth) params.set("from", fromMonth);
    if (toMonth) params.set("to", toMonth);
    return json(await api("GET", `/expenses?${params.toString()}`));
  },
);

// -------------------------------------------------------------------- plans

tool(
  "list_plans",
  "List planned (not yet paid) expenses for a month.",
  { monthKey: monthKeySchema },
  async ({ monthKey }) => json(await api("GET", `/months/${mk(monthKey)}/plans`)),
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
  },
  async ({ monthKey, ...body }) =>
    json(await api("POST", `/months/${mk(monthKey)}/plans`, body)),
);

tool(
  "mark_plan_paid",
  "Convert a plan into a real expense (atomically: creates the expense, deducts the account if set, removes the plan).",
  {
    monthKey: monthKeySchema,
    planId: z.string().uuid(),
    date: dateSchema.optional().describe("Payment date; defaults to the plan's target date or today"),
  },
  async ({ monthKey, planId, date }) =>
    json(await api("POST", `/months/${mk(monthKey)}/plans/${planId}/mark-paid`, { date })),
);

tool(
  "delete_plan",
  "Delete a planned expense.",
  { monthKey: monthKeySchema, planId: z.string().uuid() },
  async ({ monthKey, planId }) => {
    await api("DELETE", `/months/${mk(monthKey)}/plans/${planId}`);
    return json({ deleted: planId });
  },
);

// --------------------------------------------------------------- categories

tool(
  "list_categories",
  "List the user's expense categories (id, name, color, icon).",
  {},
  async () => json(await api("GET", "/categories")),
);

tool(
  "create_category",
  "Create an expense category.",
  {
    name: z.string().min(1),
    color: z.string().describe('Hex color, e.g. "#ef4444"'),
    icon: z.string().describe('Lucide icon name, e.g. "shopping-cart"'),
  },
  async (body) => json(await api("POST", "/categories", body)),
);

// ----------------------------------------------------------------- accounts

tool(
  "list_accounts",
  "List accounts with their current balances.",
  {},
  async () => json(await api("GET", "/accounts")),
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
  async (body) => json(await api("POST", "/accounts", body)),
);

tool(
  "deposit",
  "Deposit money into an account.",
  {
    accountId: z.string().uuid(),
    amount: z.number().positive(),
    note: z.string().optional(),
  },
  async ({ accountId, ...body }) =>
    json(await api("POST", `/accounts/${accountId}/deposit`, body)),
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
  async (body) => json(await api("POST", "/accounts/transfer", body)),
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
    const params = new URLSearchParams();
    if (accountId) params.set("accountId", accountId);
    if (type) params.set("type", type);
    if (monthKey) params.set("monthKey", monthKey);
    if (limit) params.set("limit", String(limit));
    return json(await api("GET", `/transactions?${params.toString()}`));
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
  async ({ monthKey, ...body }) =>
    json(await api("POST", `/months/${mk(monthKey)}/allocations`, body)),
);

// ------------------------------------------------------------------ savings

tool(
  "list_savings_goals",
  "List savings goals with target, progress, and completion state.",
  {},
  async () => json(await api("GET", "/savings-goals")),
);

tool(
  "create_savings_goal",
  "Create a savings goal.",
  {
    name: z.string().min(1),
    targetAmount: z.number().positive(),
    deadline: dateSchema.optional(),
  },
  async (body) => json(await api("POST", "/savings-goals", body)),
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
  async ({ goalId, ...body }) =>
    json(await api("POST", `/savings-goals/${goalId}/contributions`, body)),
);

// ----------------------------------------------------------------- forecast

tool(
  "list_forecast_flows",
  "List cash-flow forecast entries (recurring ins/outs by year and month, with uncertainty ranges).",
  { year: z.number().int().optional() },
  async ({ year }) =>
    json(await api("GET", `/forecast-flows${year ? `?year=${year}` : ""}`)),
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
  async (body) => json(await api("POST", "/forecast-flows", body)),
);

// -------------------------------------------------------------------- start

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("budgetability MCP server running (stdio)");

// Announce to the MCP registry (no-op unless MCP_REGISTRY_URL is set).
startRegistryAnnouncer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
  description:
    "Budgetability MCP server — standalone backend (backend/api, Express + SQLite). Budgets, expenses, plans, envelope accounts, savings goals, forecast. Safe sandbox: not wired to the production apps.",
  tags: ["budgetability", "budget", "finance", "standalone", "sandbox"],
  env: [
    { name: "BUDGETABILITY_API_URL", required: false, description: "Defaults to http://localhost:8787" },
    { name: "BUDGETABILITY_TOKEN", required: false, secret: true, description: "Personal access token (bat_...)" },
    { name: "BUDGETABILITY_EMAIL", required: false, description: "Alternative to the token" },
    { name: "BUDGETABILITY_PASSWORD", required: false, secret: true, description: "Alternative to the token" },
  ],
  tools: toolMetas,
});
