-- Migration: Add Account Groups ("mother accounts")
-- Groups let several real accounts (cash, checking, stock savings, ...) be
-- organized under one parent for a combined view. A group is NOT a transactable
-- account: it holds no balance of its own — its balance is always derived as the
-- sum of its member accounts' current_balance.

-- ============================================
-- ACCOUNT GROUPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS account_groups (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- ============================================
-- LINK ACCOUNTS TO A GROUP (nullable = ungrouped)
-- On group delete, members fall back to ungrouped (accounts are never deleted)
-- ============================================
ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES account_groups(id) ON DELETE SET NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE account_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account groups" ON account_groups
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own account groups" ON account_groups
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own account groups" ON account_groups
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own account groups" ON account_groups
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_account_groups_user ON account_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_account_groups_sort ON account_groups(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_accounts_group ON accounts(group_id);

-- ============================================
-- UPDATED_AT + AUDIT TRIGGERS
-- ============================================
CREATE TRIGGER update_account_groups_updated_at BEFORE UPDATE ON account_groups
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER audit_account_groups_trigger
    AFTER INSERT OR UPDATE OR DELETE ON account_groups
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ============================================
-- GRANTS
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON account_groups TO authenticated;
