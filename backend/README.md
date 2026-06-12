# Budgetability Backend (standalone — NOT wired)

A complete, self-contained backend for Budgetability plus an MCP server on
top of it. **Neither the web app nor the mobile app uses this yet** — both
remain wired to Supabase. This system exists in the repo, ready to be wired
in later (or used on its own via the MCP server).

```
backend/
  api/   REST API — TypeScript + Express + SQLite (better-sqlite3)
  mcp/   MCP server (stdio) exposing budget tools over the API
```

## Design

- **Schema parity with Supabase.** `api/src/db/schema.sql` is a SQLite port
  of `supabase/migrations/*` — same tables, columns, and constraints
  (snake_case preserved), so swapping the apps' data layer over later is a
  mechanical mapping, and data can be copied table-for-table.
- **Trigger logic as transactions.** Supabase updates account balances and
  savings-goal progress via Postgres triggers. Here the same rules live in
  the service layer inside synchronous SQLite transactions — an expense and
  its balance deduction commit or roll back together (no partial writes).
- **Auth**: email+password → JWT access token (15 min) + rotating refresh
  token, plus **personal access tokens** (PATs) for machine clients like
  the MCP server. All financial mutations are written to `audit_logs`.
- **Storage**: a single SQLite file (`data/budgetability.db` by default,
  gitignored). Zero infrastructure to run.

## Run the API

```bash
cd backend/api
npm install
cp .env.example .env   # set JWT_SECRET
npm run dev            # http://localhost:8787
```

`GET /health` is public; everything else lives under `/api/v1` behind
`Authorization: Bearer <access token or PAT>`.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`, `POST/GET/DELETE /auth/tokens` (PATs) |
| Budget | `GET/PUT /months/:monthKey/budget`, `GET /months/:monthKey/summary`, `DELETE /months/:monthKey` (clear month) |
| Expenses | `GET/POST /months/:monthKey/expenses`, `PATCH/DELETE /months/:monthKey/expenses/:id`, `GET /expenses?from&to&q` (cross-month search) |
| Plans | `GET/POST /months/:monthKey/plans`, `PATCH/DELETE .../plans/:id`, `POST .../plans/:id/mark-paid` |
| Drafts | `GET/POST /drafts`, `PATCH/DELETE /drafts/:id`, `DELETE /drafts` |
| Categories | `GET/POST /categories`, `PATCH/DELETE /categories/:id` |
| Accounts | `GET/POST /accounts`, `PATCH/DELETE /accounts/:id`, `POST /accounts/:id/deposit`, `POST /accounts/transfer`, `GET /transactions`, `DELETE /transactions/:id` (deposit/transfer revert) |
| Groups | `GET/POST /account-groups`, `PATCH/DELETE /account-groups/:id`, `PUT /account-groups/:id/members` |
| Allocations | `GET/POST /months/:monthKey/allocations`, `PATCH/DELETE /allocations/:id` |
| Savings | `GET/POST /savings-goals`, `PATCH/DELETE /savings-goals/:id`, `GET/POST /savings-goals/:id/contributions` |
| Forecast | `GET/POST /forecast-flows`, `PATCH/DELETE /forecast-flows/:id` |
| Spreadsheet | `GET /spreadsheet-entries?from&to`, `PUT /spreadsheet-entries` |

API bodies use camelCase (matching the apps' TypeScript types); the DB uses
snake_case (matching Supabase).

## Run the MCP server

```bash
cd backend/mcp
npm install && npm run build
```

Create a PAT first (register/login, then `POST /api/v1/auth/tokens`), then
register the server with an MCP client (e.g. Claude Code):

```bash
claude mcp add budgetability \
  -e BUDGETABILITY_API_URL=http://localhost:8787 \
  -e BUDGETABILITY_TOKEN=<your PAT> \
  -- node backend/mcp/dist/index.js
```

Tools: month summary & category breakdown, set budget, expense CRUD +
cross-month search, plan CRUD + mark-paid, categories, accounts (create /
deposit / transfer), budget allocation, savings goals + contributions, and
forecast flows. See `mcp/README.md` for the full list.

## Wiring it in later (intentionally not done)

The apps' `data-service.ts` already isolates every operation behind one
class. To switch: implement the same method surface against this API and
swap the import — no UI changes. Until then, nothing references `backend/`.
