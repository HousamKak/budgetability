import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { getDb } from "../db";
import {
  audit,
  badRequest,
  money,
  newId,
  notFound,
  validateBody,
} from "../lib/helpers";
import { applyTransaction, assertOwnAccount, reverseTransaction } from "./balances";

interface AccountRow {
  id: string;
  name: string;
  account_type: string;
  initial_balance: number;
  current_balance: number;
  is_default: number;
  color: string | null;
  icon: string | null;
  sort_order: number;
}
const accountJson = (r: AccountRow) => ({
  id: r.id,
  name: r.name,
  accountType: r.account_type,
  initialBalance: r.initial_balance,
  currentBalance: r.current_balance,
  isDefault: !!r.is_default,
  color: r.color ?? undefined,
  icon: r.icon ?? undefined,
  sortOrder: r.sort_order,
});

const accountBody = z.object({
  name: z.string().min(1).max(120),
  accountType: z.enum(["checking", "savings", "credit", "cash", "other"]),
  initialBalance: z.number().default(0),
  isDefault: z.boolean().default(false),
  color: z.string().max(20).optional(),
  icon: z.string().max(60).optional(),
  sortOrder: z.number().int().default(0),
});

export const accountsRouter = Router();

accountsRouter.get("/", (req, res) => {
  const rows = getDb()
    .prepare(`SELECT * FROM accounts WHERE user_id = ? ORDER BY sort_order, created_at`)
    .all(req.userId) as AccountRow[];
  res.json({ accounts: rows.map(accountJson) });
});

accountsRouter.post(
  "/",
  validateBody(accountBody),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const b = req.body;
      const db = getDb();
      const id = newId();
      db.transaction(() => {
        // Single default account per user (Supabase enforces this via trigger).
        if (b.isDefault) {
          db.prepare(`UPDATE accounts SET is_default = 0 WHERE user_id = ?`).run(req.userId);
        }
        db.prepare(
          `INSERT INTO accounts (id, user_id, name, account_type, initial_balance, current_balance, is_default, color, icon, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          req.userId,
          b.name,
          b.accountType,
          money(b.initialBalance),
          money(b.initialBalance),
          b.isDefault ? 1 : 0,
          b.color ?? null,
          b.icon ?? null,
          b.sortOrder,
        );
        audit(db, req.userId, "accounts", id, "INSERT", undefined, b);
      })();
      const row = db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(id) as AccountRow;
      res.status(201).json(accountJson(row));
    } catch (e) {
      next(e);
    }
  },
);

accountsRouter.patch(
  "/:id",
  validateBody(accountBody.partial()),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb();
      const old = db
        .prepare(`SELECT * FROM accounts WHERE id = ? AND user_id = ?`)
        .get(req.params.id, req.userId) as AccountRow | undefined;
      if (!old) throw notFound("Account");
      const b = req.body;
      db.transaction(() => {
        if (b.isDefault === true) {
          db.prepare(`UPDATE accounts SET is_default = 0 WHERE user_id = ?`).run(req.userId);
        }
        db.prepare(
          `UPDATE accounts SET name = ?, account_type = ?, is_default = ?, color = ?, icon = ?, sort_order = ?,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE id = ?`,
        ).run(
          b.name ?? old.name,
          b.accountType ?? old.account_type,
          b.isDefault !== undefined ? (b.isDefault ? 1 : 0) : old.is_default,
          b.color !== undefined ? b.color : old.color,
          b.icon !== undefined ? b.icon : old.icon,
          b.sortOrder ?? old.sort_order,
          old.id,
        );
        audit(db, req.userId, "accounts", old.id, "UPDATE", old, b);
      })();
      const row = db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(old.id) as AccountRow;
      res.json(accountJson(row));
    } catch (e) {
      next(e);
    }
  },
);

accountsRouter.delete("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const old = db
      .prepare(`SELECT * FROM accounts WHERE id = ? AND user_id = ?`)
      .get(req.params.id, req.userId) as AccountRow | undefined;
    if (!old) throw notFound("Account");
    db.transaction(() => {
      db.prepare(`DELETE FROM accounts WHERE id = ?`).run(old.id);
      audit(db, req.userId, "accounts", old.id, "DELETE", old, undefined);
    })();
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ------------------------------------------------------ deposit / transfer

accountsRouter.post(
  "/:id/deposit",
  validateBody(z.object({ amount: z.number().positive(), note: z.string().max(500).optional() })),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb();
      assertOwnAccount(db, req.userId, req.params.id);
      let txId = "";
      db.transaction(() => {
        txId = applyTransaction(db, req.userId, {
          toAccountId: req.params.id,
          amount: req.body.amount,
          type: "deposit",
          note: req.body.note ?? "Deposit",
        });
      })();
      res.status(201).json({ transactionId: txId });
    } catch (e) {
      next(e);
    }
  },
);

accountsRouter.post(
  "/transfer",
  validateBody(
    z.object({
      fromAccountId: z.string().uuid(),
      toAccountId: z.string().uuid(),
      amount: z.number().positive(),
      note: z.string().max(500).optional(),
    }),
  ),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fromAccountId, toAccountId, amount, note } = req.body;
      if (fromAccountId === toAccountId) {
        throw badRequest("Cannot transfer to the same account");
      }
      const db = getDb();
      let txId = "";
      db.transaction(() => {
        txId = applyTransaction(db, req.userId, {
          fromAccountId,
          toAccountId,
          amount,
          type: "transfer",
          note: note ?? "Transfer",
        });
      })();
      res.status(201).json({ transactionId: txId });
    } catch (e) {
      next(e);
    }
  },
);

// ------------------------------------------------------------ transactions

export const transactionsRouter = Router();

transactionsRouter.get("/", (req, res, next) => {
  try {
    const { accountId, type, monthKey, limit } = req.query as Record<string, string | undefined>;
    const clauses = ["user_id = ?"];
    const params: unknown[] = [req.userId];
    if (accountId) {
      clauses.push("(from_account_id = ? OR to_account_id = ?)");
      params.push(accountId, accountId);
    }
    if (type) {
      clauses.push("transaction_type = ?");
      params.push(type);
    }
    if (monthKey) {
      clauses.push("month_key = ?");
      params.push(monthKey);
    }
    const n = Math.min(Number(limit) || 200, 1000);
    const rows = getDb()
      .prepare(
        `SELECT * FROM account_transactions WHERE ${clauses.join(" AND ")}
         ORDER BY created_at DESC LIMIT ${n}`,
      )
      .all(...params) as Record<string, unknown>[];
    res.json({
      transactions: rows.map((r) => ({
        id: r.id,
        fromAccountId: r.from_account_id ?? undefined,
        toAccountId: r.to_account_id ?? undefined,
        amount: r.amount,
        transactionType: r.transaction_type,
        monthKey: r.month_key ?? undefined,
        savingsGoalId: r.savings_goal_id ?? undefined,
        note: r.note ?? undefined,
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    next(e);
  }
});

/** Deposit/transfer revert — mirrors the Supabase delete policy. */
transactionsRouter.delete("/:id", (req, res, next) => {
  try {
    const db = getDb();
    db.transaction(() => {
      reverseTransaction(db, req.userId, req.params.id);
    })();
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------------------- groups

const groupBody = z.object({
  name: z.string().min(1).max(120),
  color: z.string().max(20).optional(),
  icon: z.string().max(60).optional(),
  sortOrder: z.number().int().default(0),
});

export const groupsRouter = Router();

groupsRouter.get("/", (req, res) => {
  const db = getDb();
  const groups = db
    .prepare(`SELECT * FROM account_groups WHERE user_id = ? ORDER BY sort_order, created_at`)
    .all(req.userId) as Record<string, unknown>[];
  const members = db
    .prepare(`SELECT group_id, account_id FROM account_group_members WHERE user_id = ?`)
    .all(req.userId) as { group_id: string; account_id: string }[];
  res.json({
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color ?? undefined,
      icon: g.icon ?? undefined,
      sortOrder: g.sort_order,
      accountIds: members.filter((m) => m.group_id === g.id).map((m) => m.account_id),
    })),
  });
});

groupsRouter.post(
  "/",
  validateBody(groupBody),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const b = req.body;
      const id = newId();
      const db = getDb();
      db.prepare(
        `INSERT INTO account_groups (id, user_id, name, color, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(id, req.userId, b.name, b.color ?? null, b.icon ?? null, b.sortOrder);
      audit(db, req.userId, "account_groups", id, "INSERT", undefined, b);
      res.status(201).json({ id, ...b, accountIds: [] });
    } catch (e) {
      next(e);
    }
  },
);

groupsRouter.patch(
  "/:id",
  validateBody(groupBody.partial()),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb();
      const old = db
        .prepare(`SELECT * FROM account_groups WHERE id = ? AND user_id = ?`)
        .get(req.params.id, req.userId) as Record<string, unknown> | undefined;
      if (!old) throw notFound("Account group");
      const b = req.body;
      db.prepare(
        `UPDATE account_groups SET name = ?, color = ?, icon = ?, sort_order = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?`,
      ).run(
        b.name ?? old.name,
        b.color !== undefined ? b.color : old.color,
        b.icon !== undefined ? b.icon : old.icon,
        b.sortOrder ?? old.sort_order,
        req.params.id,
      );
      audit(db, req.userId, "account_groups", req.params.id, "UPDATE", old, b);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

groupsRouter.delete("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const r = db
      .prepare(`DELETE FROM account_groups WHERE id = ? AND user_id = ?`)
      .run(req.params.id, req.userId);
    if (r.changes === 0) throw notFound("Account group");
    audit(db, req.userId, "account_groups", req.params.id, "DELETE");
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

/** Replace a group's membership with the given account ids. */
groupsRouter.put(
  "/:id/members",
  validateBody(z.object({ accountIds: z.array(z.string().uuid()) })),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb();
      const group = db
        .prepare(`SELECT id FROM account_groups WHERE id = ? AND user_id = ?`)
        .get(req.params.id, req.userId);
      if (!group) throw notFound("Account group");
      const ids: string[] = req.body.accountIds;
      db.transaction(() => {
        for (const accountId of ids) assertOwnAccount(db, req.userId, accountId);
        db.prepare(`DELETE FROM account_group_members WHERE group_id = ?`).run(req.params.id);
        const ins = db.prepare(
          `INSERT INTO account_group_members (id, user_id, group_id, account_id) VALUES (?, ?, ?, ?)`,
        );
        for (const accountId of ids) ins.run(newId(), req.userId, req.params.id, accountId);
      })();
      res.json({ groupId: req.params.id, accountIds: ids });
    } catch (e) {
      next(e);
    }
  },
);
