-- ============================================
-- Multi-currency support (USD / AED / LBP)
-- ============================================
-- Design (docs/currency-spec.md):
--   * Every account is denominated in one currency; balances and the account
--     side of every transaction are native to it.
--   * The planning domain (budgets, expenses, plans, allocations, savings,
--     forecast) stays in the user's base currency (user_settings.base_currency).
--   * Rates are user-entered, stored as units of currency per 1 USD.
--   * Cross-currency movements snapshot amounts at entry time; changing a rate
--     later never rewrites history.

-- ============================================
-- 1. WIDEN MONEY COLUMNS
-- ============================================
-- DECIMAL(10,2) caps at 99,999,999.99 — roughly $1,100 worth of LBP.

ALTER TABLE budgets               ALTER COLUMN amount          TYPE DECIMAL(18,2);
ALTER TABLE expenses              ALTER COLUMN amount          TYPE DECIMAL(18,2);
ALTER TABLE plans                 ALTER COLUMN amount          TYPE DECIMAL(18,2);
ALTER TABLE drafts                ALTER COLUMN amount          TYPE DECIMAL(18,2);
ALTER TABLE accounts              ALTER COLUMN initial_balance TYPE DECIMAL(18,2);
ALTER TABLE accounts              ALTER COLUMN current_balance TYPE DECIMAL(18,2);
ALTER TABLE savings_goals         ALTER COLUMN target_amount   TYPE DECIMAL(18,2);
ALTER TABLE savings_goals         ALTER COLUMN current_amount  TYPE DECIMAL(18,2);
ALTER TABLE savings_contributions ALTER COLUMN amount          TYPE DECIMAL(18,2);
ALTER TABLE account_transactions  ALTER COLUMN amount          TYPE DECIMAL(18,2);
ALTER TABLE budget_allocations    ALTER COLUMN amount          TYPE DECIMAL(18,2);

-- Return type change requires drop + recreate (CREATE OR REPLACE cannot).
DROP FUNCTION IF EXISTS get_user_monthly_summary();
CREATE FUNCTION get_user_monthly_summary()
RETURNS TABLE (
    user_id UUID,
    month_key TEXT,
    budget_amount DECIMAL(18,2),
    total_expenses DECIMAL(18,2),
    remaining_budget DECIMAL(18,2),
    expense_count BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
    SELECT
        b.user_id,
        b.month_key,
        b.amount as budget_amount,
        COALESCE(SUM(e.amount), 0) as total_expenses,
        b.amount - COALESCE(SUM(e.amount), 0) as remaining_budget,
        COUNT(e.id) as expense_count
    FROM budgets b
    LEFT JOIN expenses e ON b.user_id = e.user_id AND b.month_key = e.month_key
    WHERE b.user_id = auth.uid()
    GROUP BY b.user_id, b.month_key, b.amount;
$$;
GRANT EXECUTE ON FUNCTION get_user_monthly_summary() TO authenticated;

-- ============================================
-- 2. ACCOUNT CURRENCY
-- ============================================
ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD'
    CHECK (currency IN ('USD', 'AED', 'LBP'));

-- ============================================
-- 3. USER SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    base_currency TEXT NOT NULL DEFAULT 'USD'
        CHECK (base_currency IN ('USD', 'AED', 'LBP')),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON user_settings
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON user_settings
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own settings" ON user_settings
    FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON user_settings TO authenticated;

-- ============================================
-- 4. EXCHANGE RATES (units of currency per 1 USD; USD itself is implicit 1)
-- ============================================
CREATE TABLE IF NOT EXISTS exchange_rates (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    currency TEXT NOT NULL CHECK (currency IN ('AED', 'LBP')),
    rate DECIMAL(18,6) NOT NULL CHECK (rate > 0),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, currency)
);

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rates" ON exchange_rates
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rates" ON exchange_rates
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rates" ON exchange_rates
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own rates" ON exchange_rates
    FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON exchange_rates TO authenticated;

-- ============================================
-- 5. CROSS-CURRENCY SNAPSHOTS ON MOVEMENTS
-- ============================================
-- account_transactions.amount stays native to the SOURCE account.
--   to_amount:   destination-side native amount (NULL = same as amount).
--   base_amount: value in the user's base currency at entry (NULL = same as amount).
ALTER TABLE account_transactions
    ADD COLUMN IF NOT EXISTS to_amount   DECIMAL(18,2) CHECK (to_amount > 0),
    ADD COLUMN IF NOT EXISTS base_amount DECIMAL(18,2) CHECK (base_amount > 0);

-- expenses.amount stays BASE currency (budget math). When paid from a non-base
-- account, original_amount/original_currency record what was physically paid.
ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS original_amount   DECIMAL(18,2) CHECK (original_amount > 0),
    ADD COLUMN IF NOT EXISTS original_currency TEXT
        CHECK (original_currency IN ('USD', 'AED', 'LBP'));

-- ============================================
-- 6. BALANCE TRIGGERS LEARN to_amount
-- ============================================
-- Source loses NEW.amount (its native); destination gains the destination-native
-- amount, which differs from NEW.amount only on cross-currency transfers.
CREATE OR REPLACE FUNCTION update_account_balances()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.from_account_id IS NOT NULL THEN
        UPDATE accounts
        SET current_balance = current_balance - NEW.amount
        WHERE id = NEW.from_account_id;
    END IF;

    IF NEW.to_account_id IS NOT NULL THEN
        UPDATE accounts
        SET current_balance = current_balance + COALESCE(NEW.to_amount, NEW.amount)
        WHERE id = NEW.to_account_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Mirror on reversal (deposit delete / transfer revert).
CREATE OR REPLACE FUNCTION reverse_account_balances_on_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.from_account_id IS NOT NULL THEN
        UPDATE accounts
        SET current_balance = current_balance + OLD.amount
        WHERE id = OLD.from_account_id;
    END IF;

    IF OLD.to_account_id IS NOT NULL THEN
        UPDATE accounts
        SET current_balance = current_balance - COALESCE(OLD.to_amount, OLD.amount)
        WHERE id = OLD.to_account_id;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
