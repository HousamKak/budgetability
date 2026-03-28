-- Add account_id column to expenses table to track which account paid for the expense
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON expenses(account_id);

-- Add 'expense' to the allowed transaction_type values
ALTER TABLE account_transactions DROP CONSTRAINT IF EXISTS account_transactions_transaction_type_check;
ALTER TABLE account_transactions ADD CONSTRAINT account_transactions_transaction_type_check
  CHECK (transaction_type = ANY (ARRAY['transfer','budget_allocation','savings_contribution','overdraft_coverage','deposit','expense']));
