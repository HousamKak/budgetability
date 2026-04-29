-- ============================================
-- Allow deleting deposit transactions
-- ============================================
-- Deposits are ad-hoc, user-added entries with no other anchor in the
-- system, so they can be safely removed. Other transaction types
-- (transfer, expense, budget_allocation, savings_contribution,
-- overdraft_coverage) remain immutable because they back state managed
-- elsewhere in the app.

-- Reverse balances when a deposit transaction is deleted.
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
        SET current_balance = current_balance - OLD.amount
        WHERE id = OLD.to_account_id;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reverse_account_balances_on_transaction_delete
    AFTER DELETE ON account_transactions
    FOR EACH ROW EXECUTE FUNCTION reverse_account_balances_on_delete();

-- RLS: only deposits owned by the user can be deleted.
CREATE POLICY "Users can delete own deposit transactions" ON account_transactions
    FOR DELETE USING (
        auth.uid() = user_id
        AND transaction_type = 'deposit'
    );

GRANT DELETE ON account_transactions TO authenticated;
