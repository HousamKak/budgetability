# Budgetability — Feature Roadmap

*Drafted 2026-06-12. Covers both the web app (this repo) and the mobile app
([HousamKak/budgetability-mobile](https://github.com/HousamKak/budgetability-mobile)),
which share the Supabase backend and a ported data layer.*

## Product thesis

Budgetability is **calendar-first with a planned-vs-spent split**. The
"left now / left after planned" distinction is the most useful number in
personal budgeting, and months are first-class objects (chapters in a
notebook), not just date filters.

We cannot beat bank-sync apps at automation, so we don't try. The winning
identity is **the fastest, most pleasant deliberate ledger** — manual entry
as intentional journaling, made near-instant. Every feature below must pass
the test: *does this still feel like a notebook?*

---

## 1. Recurring expenses & plans

**Priority: highest. The single biggest functional gap.**

Rent, subscriptions, salary — users currently re-type the same plans every
month, which is especially glaring in a planner-centric app.

- **UX:** when creating a plan or expense, a "repeats monthly" toggle
  (later: weekly / every N months / until date). When a new month is first
  opened, recurring items are auto-stamped into it as plans. "Mark paid"
  converts plan → expense, exactly like today.
- **Data:** new `recurring_items` table (user_id, kind expense|plan, amount,
  category_id, account_id, note, day_of_month, cadence, start/end month_key,
  active). Stamping happens lazily in the data layer on first
  `getPlans(monthKey)` for a month ≥ start — no cron needed. Stamped rows
  carry a `recurring_id` so editing one occurrence vs. the series is
  distinguishable.
- **Free byproduct:** a **Subscriptions view** — list of active recurrences
  with total monthly burn. People genuinely love this screen; it costs
  almost nothing once recurrences exist.
- **Platforms:** data layer in both apps; UI = one toggle in
  ExpenseDialog/ExpenseSheet + a settings-style list to manage the series.

## 2. Month rollover ritual

**Priority: high. Cheap, on-brand, re-engages users exactly when they
usually quit (the new month).**

Closing a month should be a moment, not silence.

- **UX:** when a user first visits a new month (or taps "Close June"), a
  guided dialog: *"June closed: spent $X of $Y. These plans were never
  paid — carry them to July? Roll the $Z leftover into savings?"* One
  screen, two or three checkboxes, done.
- **Data:** no schema needed for v1 — it composes existing operations
  (copy unpaid plans to next month_key, optional `contributeToGoal` /
  `allocateToBudget` for the leftover). A small `month_closed` flag in the
  budgets table if we want the "closed" state to persist visually.
- **Notebook angle:** a closed month gets a stamped/torn "closed" look in
  the calendar — chapters end.

## 3. Two-tap capture on the phone

**Priority: high. The entire retention battle is entry friction.**

Target: amount → category → done, under three seconds.

- **Android app shortcuts** (long-press launcher icon → "Add expense")
  deep-linking straight into ExpenseSheet via the existing `budgetability://`
  scheme (expo-quick-actions).
- **End-of-day nudge** via expo-notifications: "Log today's spending?" —
  opt-in, configurable time, opens the day sheet for today. Also "you
  planned $X for today" morning reminders, derived from plans.
- **PWA share target / quick add** on web mobile: the installed PWA
  registers a shortcut to the quick-add dialog.
- **Scope note:** real Android home-screen *widgets* are painful in Expo —
  app shortcuts + notifications deliver 90% of the value for 10% of the
  effort. Revisit widgets only if demand shows up.

## 4. Search + "last time I paid this"

**Priority: medium-high. Real question people ask monthly; almost no
budget app answers it well.**

- **UX:** a search box (web: header; mobile: More tab) over note, category,
  and amount across all months. Result rows show date, month, amount —
  tapping jumps to that day. A "history" mini-view when viewing any
  expense: previous occurrences of similar notes ("Mechanic — last paid
  $140 in March").
- **Data:** one cross-month query; `getExpensesForMonthRange` already
  exists in both data layers — this is mostly UI plus an index on
  expenses(user_id, note).

## 5. CSV export, then CSV import

**Priority: export = trivial trust-builder; import = adoption unlock.**

- **Export (do first, ~an afternoon):** "Download my data" in Settings —
  expenses/plans/accounts/goals as CSV (and a full JSON dump). It's a trust
  feature: *it's my data, I can leave.*
- **Import (bigger):** upload a bank-statement CSV → column-mapping step →
  rows land as expenses with date/amount/note, category left for the user.
  This is the pragmatic middle ground between manual entry and Plaid-style
  sync (expensive, region-locked, and against the product thesis). Import
  alone makes the app viable for 100+ transaction/month users.

## 6. Receipt photo on expenses

**Priority: medium. Plumbing already exists.**

The savings-goal image picker/upload (mobile) and the storage bucket are
already built — attach the same flow to expenses (`receipt_url` column,
thumbnail on the expense row, full view in the day sheet). Pairs with the
notebook feel: a photo taped to the page. Storage policy: reuse the
existing bucket pattern but keep the extension whitelist; consider signed
URLs if receipts are more sensitive than goal images.

## 7. Shared / household budgets

**Priority: the v2 flagship — biggest differentiator, biggest lift.**

Couples budgeting together are underserved and are exactly the demographic
that logs expenses manually.

- **Scope:** invite by email → both users read/write the same budget space;
  per-item "who spent it" attribution; everything else stays identical.
- **Why it's last:** it breaks the `auth.uid() = user_id` RLS model — needs
  a `household_id` indirection on every table, membership policies, invite
  flow, and conflict thinking. Don't start it casually; design the RLS
  migration first.

---

## Deliberate non-features

- **AI spending insights** — every app has them, nobody acts on them.
- **Gamification / streaks** — fights the calm journal identity.
- **Full bank sync (Plaid etc.)** — months of work and ongoing cost,
  competing exactly where we're weakest. CSV import is our answer.

## Suggested order of attack

1. Recurring items + Subscriptions view (data layer first, both apps)
2. Month rollover ritual (composes existing ops)
3. CSV export (one afternoon, ship with #2)
4. Phone capture: app shortcuts + daily nudge
5. Search / payment history
6. CSV import
7. Receipt photos
8. Household budgets (design doc + RLS migration plan before any code)

The first two together change the product's nature: from *"a ledger I fill
in"* to *"a system that prepares my month for me"* — the moment it becomes
a habit instead of a chore.
