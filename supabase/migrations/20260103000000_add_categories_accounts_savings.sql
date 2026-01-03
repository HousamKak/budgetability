-- Migration: Add Categories, Accounts, and Savings Goals System
-- This migration adds support for:
-- 1. Custom user-defined categories with colors and icons
-- 2. Account management with envelope budgeting
-- 3. Savings goals with image support

-- ============================================
-- CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,           -- Hex code: "#ef4444"
    icon TEXT NOT NULL,            -- Lucide icon name: "shopping-cart"
    sort_order INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- ============================================
-- ACCOUNTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS accounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'credit', 'cash', 'other')),
    initial_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    current_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_default BOOLEAN DEFAULT FALSE,   -- For overdraft coverage
    color TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- ============================================
-- SAVINGS GOALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS savings_goals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    target_amount DECIMAL(10,2) NOT NULL CHECK (target_amount > 0),
    current_amount DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
    image_url TEXT,              -- URL or Supabase Storage path
    deadline DATE,
    color TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ACCOUNT TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS account_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    from_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    to_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('transfer', 'budget_allocation', 'savings_contribution', 'overdraft_coverage', 'deposit')),
    month_key TEXT,                -- For budget allocations
    savings_goal_id UUID REFERENCES savings_goals(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BUDGET ALLOCATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS budget_allocations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
    month_key TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, account_id, month_key)
);

-- ============================================
-- SAVINGS CONTRIBUTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS savings_contributions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    savings_goal_id UUID REFERENCES savings_goals(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ALTER EXISTING TABLES
-- ============================================
-- Add category_id to expenses (keep TEXT category for backward compatibility)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Add category_id to plans (keep TEXT category for backward compatibility)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_contributions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - CATEGORIES
-- ============================================
CREATE POLICY "Users can view own categories" ON categories
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" ON categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" ON categories
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" ON categories
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES - ACCOUNTS
-- ============================================
CREATE POLICY "Users can view own accounts" ON accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts" ON accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" ON accounts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" ON accounts
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES - ACCOUNT TRANSACTIONS
-- ============================================
CREATE POLICY "Users can view own account transactions" ON account_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own account transactions" ON account_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- No update/delete on transactions (immutable audit trail)

-- ============================================
-- RLS POLICIES - BUDGET ALLOCATIONS
-- ============================================
CREATE POLICY "Users can view own budget allocations" ON budget_allocations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budget allocations" ON budget_allocations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budget allocations" ON budget_allocations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own budget allocations" ON budget_allocations
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES - SAVINGS GOALS
-- ============================================
CREATE POLICY "Users can view own savings goals" ON savings_goals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own savings goals" ON savings_goals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own savings goals" ON savings_goals
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own savings goals" ON savings_goals
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES - SAVINGS CONTRIBUTIONS
-- ============================================
CREATE POLICY "Users can view own savings contributions" ON savings_contributions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own savings contributions" ON savings_contributions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- No update/delete on contributions (immutable audit trail)

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(user_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_default ON accounts(user_id, is_default);

CREATE INDEX IF NOT EXISTS idx_account_transactions_user ON account_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_from ON account_transactions(from_account_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_to ON account_transactions(to_account_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_month ON account_transactions(month_key);

CREATE INDEX IF NOT EXISTS idx_budget_allocations_user_month ON budget_allocations(user_id, month_key);
CREATE INDEX IF NOT EXISTS idx_budget_allocations_account ON budget_allocations(account_id);

CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_completed ON savings_goals(user_id, is_completed);

CREATE INDEX IF NOT EXISTS idx_savings_contributions_goal ON savings_contributions(savings_goal_id);
CREATE INDEX IF NOT EXISTS idx_savings_contributions_account ON savings_contributions(account_id);

CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_plans_category_id ON plans(category_id);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_budget_allocations_updated_at BEFORE UPDATE ON budget_allocations
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_savings_goals_updated_at BEFORE UPDATE ON savings_goals
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================
-- AUDIT TRIGGERS
-- ============================================
CREATE TRIGGER audit_categories_trigger
    AFTER INSERT OR UPDATE OR DELETE ON categories
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_accounts_trigger
    AFTER INSERT OR UPDATE OR DELETE ON accounts
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_account_transactions_trigger
    AFTER INSERT ON account_transactions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_budget_allocations_trigger
    AFTER INSERT OR UPDATE OR DELETE ON budget_allocations
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_savings_goals_trigger
    AFTER INSERT OR UPDATE OR DELETE ON savings_goals
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_savings_contributions_trigger
    AFTER INSERT ON savings_contributions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON accounts TO authenticated;
GRANT SELECT, INSERT ON account_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON budget_allocations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON savings_goals TO authenticated;
GRANT SELECT, INSERT ON savings_contributions TO authenticated;

-- ============================================
-- HELPER FUNCTION: Ensure only one default account per user
-- ============================================
CREATE OR REPLACE FUNCTION ensure_single_default_account()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        -- Unset is_default for all other accounts of this user
        UPDATE accounts
        SET is_default = FALSE
        WHERE user_id = NEW.user_id AND id != NEW.id AND is_default = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_account_trigger
    BEFORE INSERT OR UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION ensure_single_default_account();

-- ============================================
-- HELPER FUNCTION: Update savings goal current_amount on contribution
-- ============================================
CREATE OR REPLACE FUNCTION update_savings_goal_amount()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE savings_goals
    SET current_amount = current_amount + NEW.amount,
        is_completed = (current_amount + NEW.amount >= target_amount),
        completed_at = CASE
            WHEN current_amount + NEW.amount >= target_amount AND completed_at IS NULL
            THEN NOW()
            ELSE completed_at
        END
    WHERE id = NEW.savings_goal_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_savings_goal_on_contribution
    AFTER INSERT ON savings_contributions
    FOR EACH ROW EXECUTE FUNCTION update_savings_goal_amount();

-- ============================================
-- HELPER FUNCTION: Update account balance on transaction
-- ============================================
CREATE OR REPLACE FUNCTION update_account_balances()
RETURNS TRIGGER AS $$
BEGIN
    -- Decrease balance of source account
    IF NEW.from_account_id IS NOT NULL THEN
        UPDATE accounts
        SET current_balance = current_balance - NEW.amount
        WHERE id = NEW.from_account_id;
    END IF;

    -- Increase balance of destination account
    IF NEW.to_account_id IS NOT NULL THEN
        UPDATE accounts
        SET current_balance = current_balance + NEW.amount
        WHERE id = NEW.to_account_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_account_balances_on_transaction
    AFTER INSERT ON account_transactions
    FOR EACH ROW EXECUTE FUNCTION update_account_balances();
