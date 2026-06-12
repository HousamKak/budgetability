import type { DB } from "../db";
import { audit, badRequest, money, newId, notFound } from "../lib/helpers";

/**
 * The Supabase deployment maintains account balances and savings progress
 * with Postgres triggers. Here the same rules are plain functions, always
 * called inside a better-sqlite3 transaction so a record and its balance
 * effect commit or roll back together.
 */

export type TransactionType =
  | "transfer"
  | "budget_allocation"
  | "savings_contribution"
  | "overdraft_coverage"
  | "deposit"
  | "expense";

export interface TxInput {
  fromAccountId?: string | null;
  toAccountId?: string | null;
  amount: number;
  type: TransactionType;
  monthKey?: string | null;
  savingsGoalId?: string | null;
  note?: string | null;
}

export function assertOwnAccount(db: DB, userId: string, accountId: string): void {
  const row = db
    .prepare(`SELECT id FROM accounts WHERE id = ? AND user_id = ?`)
    .get(accountId, userId);
  if (!row) throw notFound("Account");
}

/** Insert an account_transactions row and apply its balance effects. */
export function applyTransaction(db: DB, userId: string, tx: TxInput): string {
  const amount = money(tx.amount);
  if (!(amount > 0)) throw badRequest("amount must be > 0");
  if (tx.fromAccountId) assertOwnAccount(db, userId, tx.fromAccountId);
  if (tx.toAccountId) assertOwnAccount(db, userId, tx.toAccountId);

  const id = newId();
  db.prepare(
    `INSERT INTO account_transactions
       (id, user_id, from_account_id, to_account_id, amount, transaction_type, month_key, savings_goal_id, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    tx.fromAccountId ?? null,
    tx.toAccountId ?? null,
    amount,
    tx.type,
    tx.monthKey ?? null,
    tx.savingsGoalId ?? null,
    tx.note ?? null,
  );

  if (tx.fromAccountId) {
    db.prepare(
      `UPDATE accounts SET current_balance = ROUND(current_balance - ?, 2) WHERE id = ?`,
    ).run(amount, tx.fromAccountId);
  }
  if (tx.toAccountId) {
    db.prepare(
      `UPDATE accounts SET current_balance = ROUND(current_balance + ?, 2) WHERE id = ?`,
    ).run(amount, tx.toAccountId);
  }

  audit(db, userId, "account_transactions", id, "INSERT", undefined, { ...tx, amount });
  return id;
}

/**
 * Delete a transaction and reverse its balance effects. The Supabase RLS
 * policy only allows this for deposits and transfers — same rule here.
 */
export function reverseTransaction(db: DB, userId: string, txId: string): void {
  const row = db
    .prepare(
      `SELECT * FROM account_transactions WHERE id = ? AND user_id = ?`,
    )
    .get(txId, userId) as
    | {
        id: string;
        from_account_id: string | null;
        to_account_id: string | null;
        amount: number;
        transaction_type: TransactionType;
      }
    | undefined;
  if (!row) throw notFound("Transaction");
  if (row.transaction_type !== "deposit" && row.transaction_type !== "transfer") {
    throw badRequest("Only deposit and transfer transactions can be deleted");
  }

  if (row.from_account_id) {
    db.prepare(
      `UPDATE accounts SET current_balance = ROUND(current_balance + ?, 2) WHERE id = ?`,
    ).run(row.amount, row.from_account_id);
  }
  if (row.to_account_id) {
    db.prepare(
      `UPDATE accounts SET current_balance = ROUND(current_balance - ?, 2) WHERE id = ?`,
    ).run(row.amount, row.to_account_id);
  }
  db.prepare(`DELETE FROM account_transactions WHERE id = ?`).run(txId);
  audit(db, userId, "account_transactions", txId, "DELETE", row, undefined);
}

/** Refund an expense's deduction when the expense is removed or re-pointed. */
export function refundExpense(
  db: DB,
  userId: string,
  accountId: string,
  amount: number,
  note: string,
): void {
  applyTransaction(db, userId, {
    toAccountId: accountId,
    amount,
    type: "deposit",
    note,
  });
}
