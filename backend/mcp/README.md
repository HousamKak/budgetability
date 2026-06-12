# Budgetability MCP Server

A Model Context Protocol server (stdio) exposing Budgetability operations as
tools, on top of the standalone backend in `../api`. **Not wired to the
production apps** — those still use Supabase.

## Setup

1. Start the API: `cd ../api && npm install && cp .env.example .env && npm run dev`
2. Create a user + PAT:
   ```bash
   curl -s -X POST localhost:8787/api/v1/auth/register \
     -H 'content-type: application/json' \
     -d '{"email":"you@example.com","password":"a-strong-password"}'
   # take accessToken from the response, then:
   curl -s -X POST localhost:8787/api/v1/auth/tokens \
     -H "authorization: Bearer <accessToken>" \
     -H 'content-type: application/json' -d '{"name":"mcp"}'
   # -> { "token": "bat_..." }  (shown once)
   ```
3. Build this package: `npm install && npm run build`
4. Register with an MCP client, e.g. Claude Code:
   ```bash
   claude mcp add budgetability \
     -e BUDGETABILITY_API_URL=http://localhost:8787 \
     -e BUDGETABILITY_TOKEN=bat_... \
     -- node <absolute path>/backend/mcp/dist/index.js
   ```
   (Instead of a PAT you can set `BUDGETABILITY_EMAIL` + `BUDGETABILITY_PASSWORD`.)

## Tools

| Tool | What it does |
|---|---|
| `get_month_summary` | Budget, spent, planned, left now / left after, category breakdown |
| `set_budget` | Set a month's budget |
| `list_expenses` / `add_expense` / `update_expense` / `delete_expense` | Expense CRUD with automatic account-balance effects |
| `search_expenses` | Cross-month text search ("when did I last pay the mechanic") |
| `list_plans` / `add_plan` / `mark_plan_paid` / `delete_plan` | Planner; mark-paid converts plan → expense atomically |
| `list_categories` / `create_category` | Category management |
| `list_accounts` / `create_account` / `deposit` / `transfer` | Envelope accounts |
| `list_transactions` | Transaction history with filters |
| `allocate_to_budget` | Move account money into a month's budget |
| `list_savings_goals` / `create_savings_goal` / `contribute_to_goal` | Savings goals with progress |
| `list_forecast_flows` / `add_forecast_flow` | Cash-flow forecast entries |

All amounts are plain numbers (2-decimal money); months are `"YYYY-MM"` and
default to the current month when omitted.
