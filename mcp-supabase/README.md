# Budgetability MCP Server — Live (Supabase)

An MCP server (stdio) that operates on the **production Budgetability
backend** — the same Supabase project the web app (budgetability.app) and
the Android app use. Changes made through these tools appear in the apps
immediately, and vice versa.

It signs in as **your real user** with email + password; every query runs
under Supabase Row-Level Security, exactly like the apps. The Supabase URL
and publishable key are public client values (already shipped in both app
bundles) and are baked in as defaults.

> There is a second, separate MCP server at `backend/mcp` that targets the
> standalone (not wired) backend in `backend/api`. The two expose the same
> tool names, so workflows are portable between them.

## Setup

```bash
cd mcp-supabase
npm install && npm run build
```

Register with an MCP client (e.g. Claude Code):

```bash
claude mcp add budgetability-live \
  -e SUPABASE_EMAIL=you@example.com \
  -e SUPABASE_PASSWORD=your-password \
  -- node <absolute path>/mcp-supabase/dist/index.js
```

Optional env: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (defaults point at
the production project).

## How writes behave

The server performs the same operations as the apps' `data-service.ts`:
balance effects flow through `account_transactions` rows, and the database
triggers (`update_account_balances`, `update_savings_goal_amount`,
`reverse_account_balances_on_delete`) maintain account balances and savings
progress. Allocation rows are written before their balance transaction —
the same ordering fix the apps received.

## Tools

| Tool | What it does |
|---|---|
| `get_month_summary` | Budget, spent, planned, left now / left after, category breakdown |
| `set_budget` | Set a month's budget |
| `list_expenses` / `add_expense` / `update_expense` / `delete_expense` | Expense CRUD with automatic account-balance effects |
| `search_expenses` | Cross-month text search |
| `list_plans` / `add_plan` / `mark_plan_paid` / `delete_plan` | Planner; mark-paid converts plan → expense (future months blocked) |
| `list_categories` / `create_category` | Category management |
| `list_accounts` / `create_account` / `deposit` / `transfer` | Envelope accounts |
| `list_transactions` / `undo_transaction` | History; undo deposits/transfers with balance reversal |
| `allocate_to_budget` | Move account money into a month's budget |
| `list_savings_goals` / `create_savings_goal` / `contribute_to_goal` | Savings goals with progress |
| `list_forecast_flows` / `add_forecast_flow` | Cash-flow forecast entries |

Months are `"YYYY-MM"` and default to the current month. **These tools write
to your real data** — there is no sandbox; prefer the `backend/` system for
experiments.

## Registry self-registration

When `MCP_REGISTRY_URL` is set, the server announces itself on startup
(identity, stdio transport, env requirements, and every tool with its JSON
Schema) via `POST {url}/register`, heartbeats every
`MCP_REGISTRY_HEARTBEAT_SECONDS` (default 300, `0` off), and posts
`{url}/unregister` on shutdown. Optional `MCP_REGISTRY_TOKEN` is sent as a
bearer token. Unset = disabled; a failing registry never affects the
server. Full contract: [docs/MCP-REGISTRY.md](../docs/MCP-REGISTRY.md).

## Registering with the H orchestrator (self-announce, like comms-hub)

Budgetability stays an external, standalone MCP server — it does **not** live
inside H. It registers itself the **same way comms-hub does**: on startup (and on
a TTL timer) it POSTs its **launch spec** to H's registry at
`POST {H}/api/mcp-servers/announce` (auth: `x-api-key`) with a 1-hour TTL. H then
merges every *live* registry server into the MCP config of every terminal/agent
it spawns — and **spawns this server itself** (`node dist/index.js`) per consumer.
Each spawned instance re-announces on startup, so the entry stays `up`
resiliently (many short-lived registrars on a long TTL), instead of dying with a
single standalone heartbeat process.

So you no longer launch through a hook — just run the server directly, exactly
like comms-hub's `node dist/mcp.js`:

```bash
SUPABASE_EMAIL=you@example.com SUPABASE_PASSWORD=your-password \
  node dist/index.js          # serves stdio AND self-registers with H
```

Run it once (leave the terminal open, or let it re-announce every 30 min to keep
itself `up`); once it's `up`, H respawns it into every agent/terminal on demand.
The first launch's `SUPABASE_*` creds travel **inside the launch spec's env**, so
every H-spawned instance can sign in and re-announce without re-supplying them.

Config (all optional, env overrides): `H_API_BASE` (default
`http://127.0.0.1:3100`), `H_API_KEY` / `H_MCP_KEY_FILE` (default reads
`D:\dev\H\data\mcp-api-key`), `H_REGISTER=0` to disable. Against the desktop app
set `H_API_BASE=http://127.0.0.1:4100`. Registration is best-effort — if H is
unreachable the MCP server still runs normally, only discovery is lost.

> The old `scripts/h-announce.mjs` hook (single process, short TTL) is now
> obsolete — the server self-announces. Wiring it into a Claude client still
> works the same, just point at `dist/index.js`:
>
> ```bash
> claude mcp add budgetability-live \
>   -e SUPABASE_EMAIL=you@example.com -e SUPABASE_PASSWORD=your-password \
>   -- node <absolute path>/mcp-supabase/dist/index.js
> ```
