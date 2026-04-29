-- Allow reverting transfer transactions in addition to deposits.
-- The existing AFTER DELETE trigger (reverse_account_balances_on_delete)
-- already handles both from_account_id and to_account_id, so deleting a
-- transfer row will refund the source and debit the destination — i.e.
-- exactly undo the original move. Only the RLS policy needs to be
-- broadened.

DROP POLICY IF EXISTS "Users can delete own deposit transactions" ON account_transactions;

CREATE POLICY "Users can revert own deposit or transfer transactions"
    ON account_transactions
    FOR DELETE USING (
        auth.uid() = user_id
        AND transaction_type IN ('deposit', 'transfer')
    );
