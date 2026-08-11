# Multi-Currency System — Specification (v2: wallet accounts)

Status: implemented (this document is the source of truth for the design).
Currencies: **USD**, **AED**, **LBP** (Lebanese Lira).

## 1. Model overview

Three ideas, kept deliberately separate:

1. **Wallet accounts** — an account holds a **set** of currencies
   (`accounts.currencies`) with an independent balance per currency
   (`account_balances`). This mirrors reality: a cash envelope ("masrof cash")
   holds lira bills and dollar bills side by side, and they don't mix.
   - The supported set is chosen at creation (checkboxes); at least one.
   - `accounts.currency` remains as the **primary** currency — the default
     selection for inputs, nothing more.
   - Accounts created before v2 hold **all three currencies** (migration
     backfills `currencies = {USD, AED, LBP}` and seeds their single existing
     balance under their old currency).
   - Every deposit, expense, transfer, allocation, or contribution names the
     currency it moves, and only that balance changes.
2. **Base currency** — one per user (`user_settings.base_currency`, default
   USD). The *planning domain* — monthly budgets, expenses, plans, drafts,
   budget allocations, savings goals, analytics, calendar, and the forecast —
   is displayed and stored in base. This is why "everything on the calendar and
   main page is in dollars" while inputs can be in any currency the account
   holds.
3. **Exchange rates** — user-entered, stored per currency as **units of
   currency per 1 USD** (`exchange_rates`; AED seeded 3.6725, LBP 89,500).
   Conversions pivot through USD:

   ```
   convert(x, from, to) = x * rate[to] / rate[from]
   toBase(x, c)         = convert(x, c, baseCurrency)
   ```

   Rates are *current* rates, editable in Settings. Historical accuracy never
   depends on the rate table: every cross-currency movement snapshots its
   amounts on the record at entry time (§3). Changing a rate later never
   rewrites history.

## 2. Database schema

v1 migration (`20260814000000_multi_currency.sql`): widened all DECIMAL(10,2)
money columns to (18,2), added `accounts.currency`, `user_settings`,
`exchange_rates`, `account_transactions.to_amount/base_amount`,
`expenses.original_amount/original_currency`, currency-aware balance triggers.

v2 migration (`20260815000000_multi_currency_wallets.sql`):

- `accounts.currencies TEXT[] NOT NULL DEFAULT '{USD,AED,LBP}'` — the supported
  set. The default makes every pre-existing account hold all three.
- `account_balances` — `(account_id, currency) PK, user_id, initial_balance,
  current_balance DECIMAL(18,2)`, RLS per user. Seeded from each account's old
  single-currency columns. `accounts.initial_balance/current_balance` are
  **frozen legacy columns** from v2 on — nothing reads or writes them.
- `account_transactions.currency TEXT` — denomination of the source-side
  `amount` (backfilled from the involved account's v1 currency).
  `account_transactions.to_currency TEXT` — destination-side denomination;
  NULL ⇒ same as `currency`. `to_amount` (v1) stays the destination-side
  amount.
- `update_account_balances()` / `reverse_account_balances_on_delete()`
  rewritten to upsert `account_balances` rows per (account, currency):
  source loses `amount` from its `currency` balance; destination gains
  `COALESCE(to_amount, amount)` on its `COALESCE(to_currency, currency)`
  balance.

## 3. Semantics per operation

Every movement names its currency; validation is per (account, currency)
balance.

| Operation | Denomination rules |
|---|---|
| **Deposit** | Pick a currency the account holds; that balance grows. `base_amount` snapshots the base value for month totals. |
| **Transfer** | Pick source currency and destination currency (each from its account's set — including two balances of the *same* account, e.g. exchanging LL for $ inside masrof cash is just a transfer to itself with different currencies). Same currency ⇒ one amount. Different ⇒ the dialog pre-fills the received amount from the rate table, user-editable (street rates differ); stored as `amount`/`currency` + `to_amount`/`to_currency` + `base_amount`. |
| **Expense** | Pick the paying account, then a currency it holds. Stored: `amount` = base value (budget math), `originalAmount`/`originalCurrency` = what was physically paid. The account transaction moves the native amount from that one balance. Base-currency entries store no original pair. *Edits* work on the displayed base amount; the native side is recomputed at the current rate in the original entry currency (or base if the account holds it). |
| **Budget allocation** | Pick a currency of the account; native leaves that balance, the allocation row gains the base equivalent. Refunds (remove/decrease/clear month) pay back **per currency** from the transaction snapshots (`netAllocatedByCurrency`) — never recomputed from current rates. |
| **Savings goal / contribution** | Goals are base-denominated. Contributing picks an account currency; that balance drops by native, the goal gains the base snapshot. |
| **Monthly budget, plans, drafts, forecast, analytics, calendar** | Base currency throughout (the "everything in dollars by default" rule). |
| **Spreadsheet** | Unchanged from v1 (per-column `currency` tags; DRHM column renders AED). |

Edge cases:

- **Insufficient funds** are judged against the specific (account, currency)
  balance being spent — holding $500 does not let you spend LL you don't have.
- **Zero balances**: an account displays every currency it *holds* (its set),
  including zeros, so the wallet's shape is always visible.
- **Missing rate**: helpers fall back to seeded defaults; Settings shows the
  editable rates.
- **Changing base currency**: relabels the planning domain without converting
  history (warned in Settings). Account balances are unaffected — native.
- **Local (no-Supabase) mode**: `Store` accounts carry
  `currencies`/`balances`/`initialBalances`; the loader migrates v1-shaped
  accounts (single `currentBalance`) into one seeded balance + all-currencies
  set, mirroring the SQL migration.
- **Legacy columns**: v1's `accounts.current_balance` and the mobile app /
  MCP server keep reading a frozen value; both need a follow-up to speak the
  wallet model (documented, out of scope here).

## 4. Formatting

Single source of truth: `src/lib/currency.ts` (unchanged from v1).

| | USD | AED | LBP |
|---|---|---|---|
| Symbol | `$` (prefix, no space) | `AED` (prefix, space) | `LBP` (prefix, space) |
| Decimals | up to 2, trimmed | up to 2, trimmed | **0** |
| Compact tiers | k / M | k / M | **k / M / B** |
| Input placeholder / step | `0.00` / `0.01` | `0.00` / `0.01` | `0` / `1` |

`formatCurrency(amount, code?)` (defaults to base), `formatCurrencyCompact`,
`currencySymbol`, `convert`/`toBase`, `CURRENCIES` registry with per-currency
quick-amount presets. `CurrencyProvider` primes a module-level snapshot and
remounts the subtree when Settings closes after currency changes.

## 5. UI behavior

- **AccountForm**: checkboxes for the currencies the account holds (≥1; first
  checked = primary), with a starting-balance input per checked currency.
  Editing shows the set read-only (balances have history; add currencies via a
  future "add currency" action rather than unchecking ones with balances).
- **Account displays** (card, row, group summary, transactions dialog): one
  line per held currency in native formatting, plus an `≈ $total` base line
  when more than one currency is held. Cross-account totals (Accounts page
  header, group bands) are base with `≈`.
- **Money dialogs** (Deposit, Transfer, Allocate, Link, Contribute, Expense):
  currency chips filtered to the chosen account's set (hidden when the account
  holds one currency); amount adornment, placeholder, step, and quick presets
  follow the chosen currency; non-base entries show a live `≈ base` hint.
- **Transactions dialog**: opening/closing balance and money in/out shown per
  currency; each transaction row in its own currency.
- **Settings → Preferences**: base currency + AED/LBP rate editors (v1).
