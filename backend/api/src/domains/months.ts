import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { getDb } from "../db";
import {
  audit,
  badRequest,
  isDateString,
  isMonthKey,
  money,
  monthKeyParam,
  newId,
  notFound,
  validateBody,
} from "../lib/helpers";
import { applyTransaction } from "./balances";

/**
 * Month-scoped resources: budget, expenses, plans, the month summary, and
 * the clear-month composite. Mirrors data-service.ts behaviour, with the
 * balance side-effects done transactionally.
 */

interface ExpenseRow {
  id: string;
  month_key: string;
  date: string;
  amount: number;
  category: string | null;
  category_id: string | null;
  account_id: string | null;
  note: string | null;
}
const expenseJson = (r: ExpenseRow) => ({
  id: r.id,
  monthKey: r.month_key,
  date: r.date,
  amount: r.amount,
  category: r.category ?? undefined,
  categoryId: r.category_id ?? undefined,
  accountId: r.account_id ?? undefined,
  note: r.note ?? undefined,
});

interface PlanRow {
  id: string;
  month_key: string;
  week_index: number;
  amount: number;
  category: string | null;
  category_id: string | null;
  account_id: string | null;
  note: string | null;
  target_date: string | null;
  is_completed: number;
}
const planJson = (r: PlanRow) => ({
  id: r.id,
  monthKey: r.month_key,
  weekIndex: r.week_index,
  amount: r.amount,
  category: r.category ?? undefined,
  categoryId: r.category_id ?? undefined,
  accountId: r.account_id ?? undefined,
  note: r.note ?? undefined,
  targetDate: r.target_date ?? undefined,
  isCompleted: !!r.is_completed,
});

const dateField = z
  .string()
  .refine(isDateString, 'date must be "YYYY-MM-DD"');

const expenseBody = z.object({
  date: dateField,
  amount: z.number().positive(),
  category: z.string().max(120).optional(),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
});

const planBody = z.object({
  weekIndex: z.number().int().min(0).max(4).default(0),
  amount: z.number().positive(),
  category: z.string().max(120).optional(),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
  targetDate: dateField.optional(),
});

export const monthsRouter = Router();

// -------------------------------------------------------------- budget

monthsRouter.get("/:monthKey/budget", (req, res) => {
  const mk = monthKeyParam(req);
  const row = getDb()
    .prepare(`SELECT amount FROM budgets WHERE user_id = ? AND month_key = ?`)
    .get(req.userId, mk) as { amount: number } | undefined;
  res.json({ monthKey: mk, amount: row?.amount ?? 0 });
});

monthsRouter.put(
  "/:monthKey/budget",
  validateBody(z.object({ amount: z.number().min(0) })),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const mk = monthKeyParam(req);
      const amount = money(req.body.amount);
      const db = getDb();
      db.transaction(() => {
        const existing = db
          .prepare(`SELECT id, amount FROM budgets WHERE user_id = ? AND month_key = ?`)
          .get(req.userId, mk) as { id: string; amount: number } | undefined;
        if (existing) {
          db.prepare(
            `UPDATE budgets SET amount = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
          ).run(amount, existing.id);
          audit(db, req.userId, "budgets", existing.id, "UPDATE", existing, { amount });
        } else {
          const id = newId();
          db.prepare(
            `INSERT INTO budgets (id, user_id, month_key, amount) VALUES (?, ?, ?, ?)`,
          ).run(id, req.userId, mk, amount);
          audit(db, req.userId, "budgets", id, "INSERT", undefined, { monthKey: mk, amount });
        }
      })();
      res.json({ monthKey: mk, amount });
    } catch (e) {
      next(e);
    }
  },
);

// ------------------------------------------------------------- summary

monthsRouter.get("/:monthKey/summary", (req, res) => {
  const mk = monthKeyParam(req);
  const db = getDb();
  const budget =
    (
      db
        .prepare(`SELECT amount FROM budgets WHERE user_id = ? AND month_key = ?`)
        .get(req.userId, mk) as { amount: number } | undefined
    )?.amount ?? 0;
  const spent =
    (
      db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS n FROM expenses WHERE user_id = ? AND month_key = ?`,
        )
        .get(req.userId, mk) as { total: number; n: number }
    ) ?? { total: 0, n: 0 };
  const planned =
    (
      db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS n FROM plans WHERE user_id = ? AND month_key = ?`,
        )
        .get(req.userId, mk) as { total: number; n: number }
    ) ?? { total: 0, n: 0 };
  const byCategory = db
    .prepare(
      `SELECT COALESCE(c.name, e.category, 'Uncategorized') AS category,
              ROUND(SUM(e.amount), 2) AS total, COUNT(*) AS count
       FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
       WHERE e.user_id = ? AND e.month_key = ?
       GROUP BY 1 ORDER BY total DESC`,
    )
    .all(req.userId, mk);

  res.json({
    monthKey: mk,
    budget,
    totalSpent: money(spent.total),
    totalPlanned: money(planned.total),
    leftNow: money(Math.max(0, budget - spent.total)),
    leftAfterPlanned: money(budget - spent.total - planned.total),
    expenseCount: spent.n,
    planCount: planned.n,
    byCategory,
  });
});

// ---------------------------------------------------------- clear month

monthsRouter.delete("/:monthKey", (req, res, next) => {
  try {
    const mk = monthKeyParam(req);
    const db = getDb();
    db.transaction(() => {
      // Refund every budget allocation back to its account first.
      const allocations = db
        .prepare(
          `SELECT id, account_id, amount FROM budget_allocations WHERE user_id = ? AND month_key = ?`,
        )
        .all(req.userId, mk) as { id: string; account_id: string; amount: number }[];
      for (const alloc of allocations) {
        if (alloc.amount > 0) {
          applyTransaction(db, req.userId, {
            toAccountId: alloc.account_id,
            amount: alloc.amount,
            type: "budget_allocation",
            monthKey: mk,
            note: "Month cleared - allocation refunded",
          });
        }
      }
      for (const table of ["budget_allocations", "budgets", "expenses", "plans"]) {
        db.prepare(`DELETE FROM ${table} WHERE user_id = ? AND month_key = ?`).run(
          req.userId,
          mk,
        );
      }
      audit(db, req.userId, "budgets", mk, "DELETE", { monthKey: mk, cleared: true });
    })();
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ------------------------------------------------------------ expenses

monthsRouter.get("/:monthKey/expenses", (req, res) => {
  const mk = monthKeyParam(req);
  const rows = getDb()
    .prepare(
      `SELECT * FROM expenses WHERE user_id = ? AND month_key = ? ORDER BY date ASC`,
    )
    .all(req.userId, mk) as ExpenseRow[];
  res.json({ expenses: rows.map(expenseJson) });
});

monthsRouter.post(
  "/:monthKey/expenses",
  validateBody(expenseBody),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const mk = monthKeyParam(req);
      const b = req.body;
      const db = getDb();
      const id = newId();
      db.transaction(() => {
        db.prepare(
          `INSERT INTO expenses (id, user_id, month_key, date, amount, category, category_id, account_id, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          req.userId,
          mk,
          b.date,
          money(b.amount),
          b.category ?? null,
          b.categoryId ?? null,
          b.accountId ?? null,
          b.note ?? null,
        );
        if (b.accountId) {
          applyTransaction(db, req.userId, {
            fromAccountId: b.accountId,
            amount: b.amount,
            type: "expense",
            monthKey: mk,
            note: b.note ?? b.category ?? "Expense",
          });
        }
        audit(db, req.userId, "expenses", id, "INSERT", undefined, b);
      })();
      const row = db.prepare(`SELECT * FROM expenses WHERE id = ?`).get(id) as ExpenseRow;
      res.status(201).json(expenseJson(row));
    } catch (e) {
      next(e);
    }
  },
);

monthsRouter.patch(
  "/:monthKey/expenses/:id",
  validateBody(expenseBody.partial()),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const mk = monthKeyParam(req);
      const db = getDb();
      const old = db
        .prepare(`SELECT * FROM expenses WHERE id = ? AND user_id = ? AND month_key = ?`)
        .get(req.params.id, req.userId, mk) as ExpenseRow | undefined;
      if (!old) throw notFound("Expense");
      const b = req.body;
      const next_ = {
        date: b.date ?? old.date,
        amount: b.amount !== undefined ? money(b.amount) : old.amount,
        category: b.category !== undefined ? b.category : old.category,
        category_id: b.categoryId !== undefined ? b.categoryId : old.category_id,
        account_id: b.accountId !== undefined ? b.accountId : old.account_id,
        note: b.note !== undefined ? b.note : old.note,
      };
      db.transaction(() => {
        // Reconcile account balances if amount or account changed.
        const accountChanged = next_.account_id !== old.account_id;
        const amountChanged = next_.amount !== old.amount;
        if ((accountChanged || amountChanged) && (old.account_id || next_.account_id)) {
          if (old.account_id) {
            applyTransaction(db, req.userId, {
              toAccountId: old.account_id,
              amount: old.amount,
              type: "expense",
              monthKey: mk,
              note: "Expense updated - refund",
            });
          }
          if (next_.account_id) {
            applyTransaction(db, req.userId, {
              fromAccountId: next_.account_id,
              amount: next_.amount,
              type: "expense",
              monthKey: mk,
              note: next_.note ?? next_.category ?? "Expense updated",
            });
          }
        }
        db.prepare(
          `UPDATE expenses SET date = ?, amount = ?, category = ?, category_id = ?, account_id = ?, note = ?,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE id = ?`,
        ).run(
          next_.date,
          next_.amount,
          next_.category,
          next_.category_id,
          next_.account_id,
          next_.note,
          old.id,
        );
        audit(db, req.userId, "expenses", old.id, "UPDATE", old, next_);
      })();
      const row = db.prepare(`SELECT * FROM expenses WHERE id = ?`).get(old.id) as ExpenseRow;
      res.json(expenseJson(row));
    } catch (e) {
      next(e);
    }
  },
);

monthsRouter.delete("/:monthKey/expenses/:id", (req, res, next) => {
  try {
    const mk = monthKeyParam(req);
    const db = getDb();
    const old = db
      .prepare(`SELECT * FROM expenses WHERE id = ? AND user_id = ? AND month_key = ?`)
      .get(req.params.id, req.userId, mk) as ExpenseRow | undefined;
    if (!old) throw notFound("Expense");
    db.transaction(() => {
      if (old.account_id) {
        applyTransaction(db, req.userId, {
          toAccountId: old.account_id,
          amount: old.amount,
          type: "expense",
          monthKey: mk,
          note: "Expense deleted - refund",
        });
      }
      db.prepare(`DELETE FROM expenses WHERE id = ?`).run(old.id);
      audit(db, req.userId, "expenses", old.id, "DELETE", old, undefined);
    })();
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// --------------------------------------------------------------- plans

monthsRouter.get("/:monthKey/plans", (req, res) => {
  const mk = monthKeyParam(req);
  const rows = getDb()
    .prepare(
      `SELECT * FROM plans WHERE user_id = ? AND month_key = ? ORDER BY week_index, created_at`,
    )
    .all(req.userId, mk) as PlanRow[];
  res.json({ plans: rows.map(planJson) });
});

monthsRouter.post(
  "/:monthKey/plans",
  validateBody(planBody),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const mk = monthKeyParam(req);
      const b = req.body;
      const db = getDb();
      const id = newId();
      db.prepare(
        `INSERT INTO plans (id, user_id, month_key, week_index, amount, category, category_id, account_id, note, target_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        req.userId,
        mk,
        b.weekIndex,
        money(b.amount),
        b.category ?? null,
        b.categoryId ?? null,
        b.accountId ?? null,
        b.note ?? null,
        b.targetDate ?? null,
      );
      audit(db, req.userId, "plans", id, "INSERT", undefined, b);
      const row = db.prepare(`SELECT * FROM plans WHERE id = ?`).get(id) as PlanRow;
      res.status(201).json(planJson(row));
    } catch (e) {
      next(e);
    }
  },
);

monthsRouter.patch(
  "/:monthKey/plans/:id",
  validateBody(planBody.partial()),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const mk = monthKeyParam(req);
      const db = getDb();
      const old = db
        .prepare(`SELECT * FROM plans WHERE id = ? AND user_id = ? AND month_key = ?`)
        .get(req.params.id, req.userId, mk) as PlanRow | undefined;
      if (!old) throw notFound("Plan");
      const b = req.body;
      db.prepare(
        `UPDATE plans SET week_index = ?, amount = ?, category = ?, category_id = ?, account_id = ?, note = ?, target_date = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?`,
      ).run(
        b.weekIndex ?? old.week_index,
        b.amount !== undefined ? money(b.amount) : old.amount,
        b.category !== undefined ? b.category : old.category,
        b.categoryId !== undefined ? b.categoryId : old.category_id,
        b.accountId !== undefined ? b.accountId : old.account_id,
        b.note !== undefined ? b.note : old.note,
        b.targetDate !== undefined ? b.targetDate : old.target_date,
        old.id,
      );
      audit(db, req.userId, "plans", old.id, "UPDATE", old, b);
      const row = db.prepare(`SELECT * FROM plans WHERE id = ?`).get(old.id) as PlanRow;
      res.json(planJson(row));
    } catch (e) {
      next(e);
    }
  },
);

monthsRouter.delete("/:monthKey/plans/:id", (req, res, next) => {
  try {
    const mk = monthKeyParam(req);
    const db = getDb();
    const old = db
      .prepare(`SELECT * FROM plans WHERE id = ? AND user_id = ? AND month_key = ?`)
      .get(req.params.id, req.userId, mk) as PlanRow | undefined;
    if (!old) throw notFound("Plan");
    db.prepare(`DELETE FROM plans WHERE id = ?`).run(old.id);
    audit(db, req.userId, "plans", old.id, "DELETE", old, undefined);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

/**
 * Mark a plan as paid: atomically create the expense (with balance
 * deduction) and remove the plan — the composite the apps do client-side.
 */
monthsRouter.post(
  "/:monthKey/plans/:id/mark-paid",
  validateBody(z.object({ date: dateField.optional() }).default({})),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const mk = monthKeyParam(req);
      const db = getDb();
      const plan = db
        .prepare(`SELECT * FROM plans WHERE id = ? AND user_id = ? AND month_key = ?`)
        .get(req.params.id, req.userId, mk) as PlanRow | undefined;
      if (!plan) throw notFound("Plan");
      const date: string =
        req.body.date ?? plan.target_date ?? new Date().toISOString().slice(0, 10);
      const expenseMonth = date.slice(0, 7);
      if (!isMonthKey(expenseMonth)) throw badRequest("Invalid date");

      const expenseId = newId();
      db.transaction(() => {
        db.prepare(
          `INSERT INTO expenses (id, user_id, month_key, date, amount, category, category_id, account_id, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          expenseId,
          req.userId,
          expenseMonth,
          date,
          plan.amount,
          plan.category,
          plan.category_id,
          plan.account_id,
          plan.note,
        );
        if (plan.account_id) {
          applyTransaction(db, req.userId, {
            fromAccountId: plan.account_id,
            amount: plan.amount,
            type: "expense",
            monthKey: expenseMonth,
            note: plan.note ?? plan.category ?? "Plan paid",
          });
        }
        db.prepare(`DELETE FROM plans WHERE id = ?`).run(plan.id);
        audit(db, req.userId, "plans", plan.id, "DELETE", plan, { paidAs: expenseId });
      })();
      const row = db
        .prepare(`SELECT * FROM expenses WHERE id = ?`)
        .get(expenseId) as ExpenseRow;
      res.status(201).json(expenseJson(row));
    } catch (e) {
      next(e);
    }
  },
);

// --------------------------------------------- cross-month expense search

export const expensesSearchRouter = Router();

expensesSearchRouter.get("/", (req, res, next) => {
  try {
    const { from, to, q } = req.query as Record<string, string | undefined>;
    if (from && !isMonthKey(from)) throw badRequest('from must be "YYYY-MM"');
    if (to && !isMonthKey(to)) throw badRequest('to must be "YYYY-MM"');
    const clauses = ["user_id = ?"];
    const params: unknown[] = [req.userId];
    if (from) {
      clauses.push("month_key >= ?");
      params.push(from);
    }
    if (to) {
      clauses.push("month_key <= ?");
      params.push(to);
    }
    if (q) {
      clauses.push("(note LIKE ? COLLATE NOCASE OR category LIKE ? COLLATE NOCASE)");
      params.push(`%${q}%`, `%${q}%`);
    }
    const rows = getDb()
      .prepare(
        `SELECT * FROM expenses WHERE ${clauses.join(" AND ")} ORDER BY date DESC LIMIT 500`,
      )
      .all(...params) as ExpenseRow[];
    res.json({ expenses: rows.map(expenseJson) });
  } catch (e) {
    next(e);
  }
});
