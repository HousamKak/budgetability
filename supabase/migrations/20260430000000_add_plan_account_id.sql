-- Add account_id to plans (and drafts) so a plan can remember which
-- account will fund it. This is metadata only — balances are not
-- touched until the plan is marked paid (which creates an expense
-- with the same account_id, and the existing expense flow debits the
-- account at that moment).

ALTER TABLE plans
    ADD COLUMN IF NOT EXISTS account_id uuid
    REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_plans_account_id ON plans(account_id);

ALTER TABLE drafts
    ADD COLUMN IF NOT EXISTS account_id uuid
    REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_drafts_account_id ON drafts(account_id);
