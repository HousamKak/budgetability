-- ============================================
-- Per-transaction exchange rates
-- ============================================
-- Settings rates are DEFAULTS. Any cross-currency movement can override the
-- rate at entry time, and the rate actually used is kept on the record so
-- history shows exactly what happened to the money.
--
--   account_transactions.exchange_rate
--     units of the TARGET currency per 1 unit of the source `currency`:
--       * transfers/exchanges: to_amount / amount   (to_currency per currency)
--       * everything else:     base_amount / amount (base per currency)
--     NULL = same-currency movement (rate 1, nothing to record).
--
--   expenses.exchange_rate
--     base per 1 unit of original_currency = amount / original_amount.
--     NULL = entered in the base currency.

ALTER TABLE account_transactions
    ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(18,8) CHECK (exchange_rate > 0);

ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(18,8) CHECK (exchange_rate > 0);

-- Backfill from the snapshots older rows already carry.
UPDATE account_transactions
SET exchange_rate = ROUND(to_amount / amount, 8)
WHERE exchange_rate IS NULL
  AND to_amount IS NOT NULL
  AND amount > 0
  AND to_currency IS NOT NULL
  AND to_currency IS DISTINCT FROM currency;

UPDATE account_transactions
SET exchange_rate = ROUND(base_amount / amount, 8)
WHERE exchange_rate IS NULL
  AND base_amount IS NOT NULL
  AND amount > 0
  AND base_amount <> amount;

UPDATE expenses
SET exchange_rate = ROUND(amount / original_amount, 8)
WHERE exchange_rate IS NULL
  AND original_amount IS NOT NULL
  AND original_amount > 0;
