-- Migration: Forecast links
-- Lets a real record (an expense, a plan, or a deposit) opt in to appearing on
-- the Forecast page, instead of the forecast only holding hand-written flows.
--
-- Two independent flags, mirroring how manual `forecast_flows` already behave:
--   in_forecast      -- does this record show up on the Forecast page at all?
--                       Only unmarking removes it. Default FALSE: nothing is
--                       forecast unless explicitly marked.
--   forecast_enabled -- is it summed into the best/worst band right now?
--                       Toggling this off greys the card but keeps it listed,
--                       exactly like the on/off switch on a manual flow.
--
-- The linked flow is *derived* on read — there is no copied row in
-- forecast_flows. Editing the source updates the forecast, deleting the source
-- removes it from the forecast, and there is nothing to reconcile.

ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS in_forecast BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS forecast_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE plans
    ADD COLUMN IF NOT EXISTS in_forecast BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS forecast_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Only 'deposit' rows are ever markable here: transfers, budget allocations,
-- savings contributions and overdraft coverage are internal money movement, not
-- money entering or leaving the picture, so they must never reach the forecast.
-- The 'expense' rows in this table mirror the expenses table, which carries its
-- own flag — marking them too would double-count.
ALTER TABLE account_transactions
    ADD COLUMN IF NOT EXISTS in_forecast BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS forecast_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE account_transactions
    DROP CONSTRAINT IF EXISTS account_transactions_forecast_deposits_only;
ALTER TABLE account_transactions
    ADD CONSTRAINT account_transactions_forecast_deposits_only
    CHECK (in_forecast = FALSE OR transaction_type = 'deposit');

-- ============================================
-- INDEXES
-- ============================================
-- The forecast page reads every marked record across all months and years, so
-- these are partial indexes over the (small) marked subset rather than the
-- whole table.
CREATE INDEX IF NOT EXISTS idx_expenses_in_forecast
    ON expenses(user_id, date) WHERE in_forecast;
CREATE INDEX IF NOT EXISTS idx_plans_in_forecast
    ON plans(user_id, month_key) WHERE in_forecast;
CREATE INDEX IF NOT EXISTS idx_account_transactions_in_forecast
    ON account_transactions(user_id, created_at) WHERE in_forecast;
