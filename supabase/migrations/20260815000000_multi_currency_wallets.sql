-- ============================================
-- Multi-currency WALLET accounts (v2)
-- ============================================
-- v1 gave each account one currency. v2 makes an account a wallet holding a
-- SET of currencies with an independent balance per currency — a cash
-- envelope holds lira bills and dollar bills side by side.
--
--   * accounts.currencies      — the supported set (existing rows: all three)
--   * accounts.currency        — stays as the PRIMARY (default input) currency
--   * account_balances         — one row per (account, currency)
--   * account_transactions     — currency (source side) / to_currency (dest)
--   * accounts.initial_balance / current_balance are FROZEN legacy columns
--     from this migration on; triggers now maintain account_balances only.

-- ============================================
-- 1. SUPPORTED-CURRENCY SET
-- ============================================
-- Default '{USD,AED,LBP}' deliberately grandfathers every existing account
-- into holding all three currencies.
ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS currencies TEXT[] NOT NULL
    DEFAULT ARRAY['USD','AED','LBP'];

-- ============================================
-- 2. PER-CURRENCY BALANCES
-- ============================================
CREATE TABLE IF NOT EXISTS account_balances (
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
    currency TEXT NOT NULL CHECK (currency IN ('USD', 'AED', 'LBP')),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    initial_balance DECIMAL(18,2) NOT NULL DEFAULT 0,
    current_balance DECIMAL(18,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (account_id, currency)
);

ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account balances" ON account_balances
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own account balances" ON account_balances
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own account balances" ON account_balances
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own account balances" ON account_balances
    FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON account_balances TO authenticated;

CREATE INDEX IF NOT EXISTS idx_account_balances_user
    ON account_balances(user_id);

-- Seed each existing account's single-currency balance under its v1 currency.
INSERT INTO account_balances
    (account_id, currency, user_id, initial_balance, current_balance)
SELECT id, currency, user_id, initial_balance, current_balance
FROM accounts
ON CONFLICT (account_id, currency) DO NOTHING;

-- ============================================
-- 3. TRANSACTION DENOMINATIONS
-- ============================================
-- currency:    denomination of the source-side `amount`
-- to_currency: destination-side denomination (NULL = same as currency);
--              pairs with v1's to_amount.
ALTER TABLE account_transactions
    ADD COLUMN IF NOT EXISTS currency TEXT
        CHECK (currency IN ('USD', 'AED', 'LBP')),
    ADD COLUMN IF NOT EXISTS to_currency TEXT
        CHECK (to_currency IN ('USD', 'AED', 'LBP'));

-- Backfill from the involved accounts' v1 currency (source account wins;
-- deposits/refunds take the destination account's).
UPDATE account_transactions t
SET currency = COALESCE(
    (SELECT a.currency FROM accounts a WHERE a.id = t.from_account_id),
    (SELECT a.currency FROM accounts a WHERE a.id = t.to_account_id),
    'USD')
WHERE t.currency IS NULL;

UPDATE account_transactions t
SET to_currency = (SELECT a.currency FROM accounts a WHERE a.id = t.to_account_id)
WHERE t.to_currency IS NULL
  AND t.to_account_id IS NOT NULL
  AND (SELECT a.currency FROM accounts a WHERE a.id = t.to_account_id)
      IS DISTINCT FROM t.currency;

-- ============================================
-- 4. BALANCE TRIGGERS → account_balances
-- ============================================
-- The legacy accounts.current_balance column is intentionally no longer
-- touched; per-currency rows are the single source of truth.
CREATE OR REPLACE FUNCTION update_account_balances()
RETURNS TRIGGER AS $$
DECLARE
    src_currency TEXT := COALESCE(NEW.currency, 'USD');
    dst_currency TEXT := COALESCE(NEW.to_currency, NEW.currency, 'USD');
    dst_amount DECIMAL(18,2) := COALESCE(NEW.to_amount, NEW.amount);
BEGIN
    IF NEW.from_account_id IS NOT NULL THEN
        INSERT INTO account_balances
            (account_id, currency, user_id, initial_balance, current_balance)
        VALUES (NEW.from_account_id, src_currency, NEW.user_id, 0, -NEW.amount)
        ON CONFLICT (account_id, currency) DO UPDATE
        SET current_balance = account_balances.current_balance - NEW.amount,
            updated_at = NOW();
    END IF;

    IF NEW.to_account_id IS NOT NULL THEN
        INSERT INTO account_balances
            (account_id, currency, user_id, initial_balance, current_balance)
        VALUES (NEW.to_account_id, dst_currency, NEW.user_id, 0, dst_amount)
        ON CONFLICT (account_id, currency) DO UPDATE
        SET current_balance = account_balances.current_balance + dst_amount,
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reverse_account_balances_on_delete()
RETURNS TRIGGER AS $$
DECLARE
    src_currency TEXT := COALESCE(OLD.currency, 'USD');
    dst_currency TEXT := COALESCE(OLD.to_currency, OLD.currency, 'USD');
    dst_amount DECIMAL(18,2) := COALESCE(OLD.to_amount, OLD.amount);
BEGIN
    IF OLD.from_account_id IS NOT NULL THEN
        UPDATE account_balances
        SET current_balance = current_balance + OLD.amount,
            updated_at = NOW()
        WHERE account_id = OLD.from_account_id AND currency = src_currency;
    END IF;

    IF OLD.to_account_id IS NOT NULL THEN
        UPDATE account_balances
        SET current_balance = current_balance - dst_amount,
            updated_at = NOW()
        WHERE account_id = OLD.to_account_id AND currency = dst_currency;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
