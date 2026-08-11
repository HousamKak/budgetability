# Multi-Currency System — Specification

Status: implemented (this document is the source of truth for the design).
Currencies: **USD**, **AED**, **LBP** (Lebanese Lira).

## 1. Model overview

Three ideas, kept deliberately separate:

1. **Account currency** — every account is denominated in exactly one currency
   (`accounts.currency`). Its balance, deposits, and the account side of every
   transaction are always in that native currency. Existing accounts default to USD.
2. **Base currency** — one per user (`user_settings.base_currency`, default USD).
   The *planning domain* — monthly budgets, expenses, plans, drafts, budget
   allocations, savings goals, analytics, and the forecast — is denominated in the
   base currency. This keeps every existing aggregation (budget math, charts,
   forecast bands) single-currency and correct.
3. **Exchange rates** — user-entered, stored per currency as **units of currency
   per 1 USD** (`exchange_rates`). USD is the anchor (rate 1, implicit).
   Conversions between any two currencies pivot through USD:

   ```
   convert(x, from, to) = x * rate[to] / rate[from]
   toBase(x, c)         = convert(x, c, baseCurrency)
   ```

   Rates are *current* rates, editable in Settings. Historical accuracy does not
   depend on the rate table: every cross-currency movement snapshots the amounts
   on the record itself at entry time (see §3). Changing a rate later never
   rewrites history.

Why per-account + base rather than "everything multi-currency": the app's budget
engine sums bare numbers in ~40 places (planner, calendar, analytics, forecast
rules). Denominating that domain in one currency keeps all of it correct by
construction; the currency boundary is crossed exactly where money moves between
an account and the plan, and that crossing is recorded explicitly.

## 2. Database schema (migration `20260814000000_multi_currency.sql`)

- `accounts.currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','AED','LBP'))`
- `user_settings` — `(user_id PK, base_currency TEXT DEFAULT 'USD', updated_at)`, RLS per user.
- `exchange_rates` — `(user_id, currency) PK, rate DECIMAL(18,6) CHECK (rate > 0), updated_at`,
  RLS per user. Seeded lazily from the app (AED 3.6725 — the peg; LBP 89,500 —
  editable market rate).
- `account_transactions`:
  - `to_amount DECIMAL(18,2)` — destination-side amount for cross-currency
    transfers. NULL ⇒ same as `amount` (same-currency movement).
  - `base_amount DECIMAL(18,2)` — the movement's value in the user's base
    currency at entry time. NULL ⇒ same as `amount`.
- `expenses.original_amount DECIMAL(18,2)`, `expenses.original_currency TEXT` —
  what was physically paid when the paying account is not base-denominated
  (`amount` itself is ALWAYS base). NULL ⇒ paid in base.
- Widen every `DECIMAL(10,2)` money column to `DECIMAL(18,2)`:
  `budgets.amount`, `expenses.amount`, `plans.amount`, `drafts.amount`,
  `accounts.initial_balance`, `accounts.current_balance`,
  `savings_goals.target_amount`, `savings_goals.current_amount`,
  `savings_contributions.amount`, `account_transactions.amount`,
  `budget_allocations.amount`. (Rationale: DECIMAL(10,2) caps at 99,999,999.99 —
  about $1,100 worth of LBP. `forecast_flows` is already (14,2); `spreadsheet_entries.value`
  is unbounded NUMERIC.)
- `get_budget_summary` recreated with widened return types.
- `update_account_balances()` trigger: source side subtracts `NEW.amount`
  (native to the source account); destination side adds
  `COALESCE(NEW.to_amount, NEW.amount)` (native to the destination account).
  The reversal paths (deposit delete, transfer revert) mirror this.

## 3. Semantics per operation

| Operation | Denomination rules |
|---|---|
| **Deposit** | Entered and stored in the account's native currency. `base_amount` snapshots the base value for month in/out totals. |
| **Transfer (same currency)** | Unchanged: one `amount`. |
| **Transfer (cross-currency)** | User enters the source amount; the dialog shows the live-converted destination amount (editable — the *effective rate* is whatever the user confirms, since street rates differ from table rates). Stored: `amount` (source native), `to_amount` (destination native), `base_amount`. |
| **Expense** | *New* expenses are entered in the paying account's currency. Stored: `amount` = base value (budget math), `originalAmount`/`originalCurrency` = native (display + provenance). The account-balance transaction uses the native amount. Expenses with no account are entered in base. *Edits* work on the displayed base amount (continuity with what the list shows); the native side is recomputed at the current rate. |
| **Budget allocation** | Budget side (`budget_allocations.amount`) is base. Account side deducts native; the transaction row stores native `amount` + `base_amount`. Refunds (remove/decrease allocation) credit back proportionally in native using the stored snapshot — never recomputed from the current rate. |
| **Savings goal / contribution** | Goals are base-denominated (target/current). Contributing from a non-base account converts at the current rate: account loses native, goal gains base; both stored on the transaction. |
| **Monthly budget, plans, drafts** | Base currency, unchanged mechanically. |
| **Forecast** | Entirely base currency. Grounding ("start amount" from accounts) converts each account balance to base at current rates. |
| **Spreadsheet** | Columns gain an optional `currency` tag on `ColumnDef` — `savings_drhm` renders as AED, `savings_dollar`/computed as USD (fixes the live bug where dirhams display with `$`). Buy/sell rate columns stay plain numbers. |

Edge cases:

- **Missing rate**: conversion helpers fall back to rate 1 and the UI flags the
  amount with `≈?`. Settings nudges the user to set rates when any non-USD
  account exists. Seeding inserts defaults on first read so this is rare.
- **Changing base currency**: relabels the planning domain; historical planning
  records are NOT converted (a $500 March budget becomes an AED 500 budget).
  The Settings UI warns about exactly this before applying. Account balances are
  unaffected (they are native). This is the honest, reversible behavior; bulk
  conversion of history is explicitly out of scope.
- **Rounding**: all stored amounts round half-up to 2 dp (LBP included — legal
  tender has no subunits in practice but 2 dp storage is harmless); conversion
  happens once per record, at entry.
- **Local (no-Supabase) mode**: `settings` and `exchangeRates` keys are added to
  the localStorage `Store` with the same shapes and defaults.
- **Legacy data**: every new column is nullable or defaulted, so existing rows,
  the MCP server (`mcp-supabase`), and the mobile app keep working unchanged and
  are implicitly USD/base. MCP tool schemas gaining explicit currency params is
  a documented follow-up, not part of this change.

## 4. Formatting

Single source of truth: `src/lib/currency.ts`.

| | USD | AED | LBP |
|---|---|---|---|
| Symbol | `$` (prefix, no space) | `AED` (prefix, space) | `LBP` (prefix, space) |
| Decimals | up to 2, trailing zeros trimmed | up to 2, trimmed | **0** |
| Example | `$1,234.5` | `AED 1,234.5` | `LBP 1,500,000` |
| Compact tiers | k / M | k / M | **k / M / B** |
| Compact example | `$12.4k` | `AED 3.4M` | `LBP 89.5M`, `LBP 1.2B` |
| Input placeholder | `0.00` | `0.00` | `0` |
| Input step | `0.01` | `0.01` | `1` |

API:

- `formatCurrency(amount, currency?)` — full format; `currency` defaults to the
  active base. Preserves the historic trim-trailing-zeros behavior.
- `formatCurrencyCompact(amount, currency?)` — chart axes / tight badges.
- `currencySymbol(currency?)` and `currencyInputProps(currency)` — for input
  adornments and placeholders/steps.
- `convert(amount, from, to)` / `toBase(amount, from)` — pure, rate-table based.
- `CURRENCIES` registry — code, name, symbol, decimals, compact tiers.

React integration: `CurrencyProvider` loads settings + rates at startup, primes
a module-level snapshot (so the pure helpers work without prop drilling), and
remounts its subtree (`key = version`) when base currency or rates change —
a rare event, so a full remount is acceptable and guarantees consistency.
`formatCurrency` in `src/lib/utils.ts` re-exports from `currency.ts`; the two
duplicate formatter definitions (`utils/analytics.ts`, `AllocateToBudgetDialog`)
are deleted.

## 5. UI behavior

- **AccountForm**: currency selector (USD/AED/LBP) on create; shown read-only on
  edit (changing an account's denomination would corrupt its history — create a
  new account and transfer instead).
- **Account displays** (card, row, transactions dialog, deposit dialog): native
  currency formatting throughout.
- **Mixed-currency totals** (Accounts page header, group bands, group summary):
  converted to base at current rates, marked with `≈` to signal conversion.
  Single-currency groups show that currency exactly (no `≈`).
- **TransferDialog**: cross-currency transfers show rate + editable converted
  destination amount; same-currency unchanged.
- **ExpenseDialog**: amount field adorned with the selected account's currency;
  non-base entries show the base equivalent live under the field.
- **Settings → Preferences**: base currency select (functional, Coming Soon badge
  removed) + rate editor rows for AED and LBP with "per 1 USD" convention labeled.
- **Charts** (analytics ticks, forecast bars/chart): compact base formatting.
- **All hardcoded `$`** glyphs, `($)` labels, `$${…}` template literals, and the
  data-service error message are replaced with currency-aware equivalents.
