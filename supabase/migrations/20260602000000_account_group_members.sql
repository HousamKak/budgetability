-- Migration: Many-to-many account ↔ group memberships
-- Replaces the single accounts.group_id link with a join table so an account
-- can belong to several groups at once (overlapping aggregates), e.g. "Cash"
-- counted in both "Liquid" and "Global Savings".

-- ============================================
-- JOIN TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS account_group_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES account_groups(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, account_id)
);

-- ============================================
-- BACKFILL from the old single-membership column
-- ============================================
INSERT INTO account_group_members (user_id, group_id, account_id)
SELECT user_id, group_id, id
FROM accounts
WHERE group_id IS NOT NULL
ON CONFLICT (group_id, account_id) DO NOTHING;

-- ============================================
-- DROP the deprecated single FK (memberships now live in the join table)
-- ============================================
ALTER TABLE accounts DROP COLUMN IF EXISTS group_id;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE account_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own group members" ON account_group_members
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own group members" ON account_group_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own group members" ON account_group_members
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_agm_user ON account_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_agm_group ON account_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_agm_account ON account_group_members(account_id);

-- ============================================
-- AUDIT TRIGGER
-- ============================================
CREATE TRIGGER audit_account_group_members_trigger
    AFTER INSERT OR DELETE ON account_group_members
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ============================================
-- GRANTS
-- ============================================
GRANT SELECT, INSERT, DELETE ON account_group_members TO authenticated;
