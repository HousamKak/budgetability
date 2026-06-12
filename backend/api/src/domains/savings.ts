import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { getDb } from "../db";
import {
  audit,
  isDateString,
  money,
  newId,
  notFound,
  nowIso,
  validateBody,
} from "../lib/helpers";
import { applyTransaction } from "./balances";

interface GoalRow {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  image_url: string | null;
  deadline: string | null;
  color: string | null;
  is_completed: number;
  completed_at: string | null;
}
const goalJson = (r: GoalRow) => ({
  id: r.id,
  name: r.name,
  targetAmount: r.target_amount,
  currentAmount: r.current_amount,
  imageUrl: r.image_url ?? undefined,
  deadline: r.deadline ?? undefined,
  color: r.color ?? undefined,
  isCompleted: !!r.is_completed,
  completedAt: r.completed_at ?? undefined,
});

const goalBody = z.object({
  name: z.string().min(1).max(120),
  targetAmount: z.number().positive(),
  imageUrl: z.string().url().max(2000).optional(),
  deadline: z.string().refine(isDateString, 'deadline must be "YYYY-MM-DD"').optional(),
  color: z.string().max(20).optional(),
});

export const savingsRouter = Router();

savingsRouter.get("/", (req, res) => {
  const rows = getDb()
    .prepare(`SELECT * FROM savings_goals WHERE user_id = ? ORDER BY created_at`)
    .all(req.userId) as GoalRow[];
  res.json({ goals: rows.map(goalJson) });
});

savingsRouter.post(
  "/",
  validateBody(goalBody),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const b = req.body;
      const db = getDb();
      const id = newId();
      db.prepare(
        `INSERT INTO savings_goals (id, user_id, name, target_amount, image_url, deadline, color)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        req.userId,
        b.name,
        money(b.targetAmount),
        b.imageUrl ?? null,
        b.deadline ?? null,
        b.color ?? null,
      );
      audit(db, req.userId, "savings_goals", id, "INSERT", undefined, b);
      const row = db.prepare(`SELECT * FROM savings_goals WHERE id = ?`).get(id) as GoalRow;
      res.status(201).json(goalJson(row));
    } catch (e) {
      next(e);
    }
  },
);

savingsRouter.patch(
  "/:id",
  validateBody(goalBody.partial()),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb();
      const old = db
        .prepare(`SELECT * FROM savings_goals WHERE id = ? AND user_id = ?`)
        .get(req.params.id, req.userId) as GoalRow | undefined;
      if (!old) throw notFound("Savings goal");
      const b = req.body;
      const target = b.targetAmount !== undefined ? money(b.targetAmount) : old.target_amount;
      const completed = old.current_amount >= target;
      db.prepare(
        `UPDATE savings_goals SET name = ?, target_amount = ?, image_url = ?, deadline = ?, color = ?,
               is_completed = ?, completed_at = COALESCE(completed_at, ?),
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?`,
      ).run(
        b.name ?? old.name,
        target,
        b.imageUrl !== undefined ? b.imageUrl : old.image_url,
        b.deadline !== undefined ? b.deadline : old.deadline,
        b.color !== undefined ? b.color : old.color,
        completed ? 1 : 0,
        completed ? nowIso() : null,
        old.id,
      );
      audit(db, req.userId, "savings_goals", old.id, "UPDATE", old, b);
      const row = db
        .prepare(`SELECT * FROM savings_goals WHERE id = ?`)
        .get(old.id) as GoalRow;
      res.json(goalJson(row));
    } catch (e) {
      next(e);
    }
  },
);

savingsRouter.delete("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const old = db
      .prepare(`SELECT * FROM savings_goals WHERE id = ? AND user_id = ?`)
      .get(req.params.id, req.userId) as GoalRow | undefined;
    if (!old) throw notFound("Savings goal");
    db.prepare(`DELETE FROM savings_goals WHERE id = ?`).run(old.id);
    audit(db, req.userId, "savings_goals", old.id, "DELETE", old, undefined);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// --------------------------------------------------------- contributions

savingsRouter.get("/:id/contributions", (req, res, next) => {
  try {
    const db = getDb();
    const goal = db
      .prepare(`SELECT id FROM savings_goals WHERE id = ? AND user_id = ?`)
      .get(req.params.id, req.userId);
    if (!goal) throw notFound("Savings goal");
    const rows = db
      .prepare(
        `SELECT * FROM savings_contributions WHERE savings_goal_id = ? ORDER BY created_at DESC`,
      )
      .all(req.params.id) as Record<string, unknown>[];
    res.json({
      contributions: rows.map((r) => ({
        id: r.id,
        savingsGoalId: r.savings_goal_id,
        accountId: r.account_id,
        amount: r.amount,
        note: r.note ?? undefined,
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Contribute from an account: contribution row + balance deduction + goal
 * progress (incl. completion flip) in ONE transaction — the rules the
 * Supabase triggers `update_savings_goal_amount` and
 * `update_account_balances` apply, minus the partial-write window.
 */
savingsRouter.post(
  "/:id/contributions",
  validateBody(
    z.object({
      accountId: z.string().uuid(),
      amount: z.number().positive(),
      note: z.string().max(500).optional(),
    }),
  ),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb();
      const goal = db
        .prepare(`SELECT * FROM savings_goals WHERE id = ? AND user_id = ?`)
        .get(req.params.id, req.userId) as GoalRow | undefined;
      if (!goal) throw notFound("Savings goal");
      const amount = money(req.body.amount);
      const contribId = newId();
      db.transaction(() => {
        db.prepare(
          `INSERT INTO savings_contributions (id, user_id, savings_goal_id, account_id, amount, note)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          contribId,
          req.userId,
          goal.id,
          req.body.accountId,
          amount,
          req.body.note ?? null,
        );
        applyTransaction(db, req.userId, {
          fromAccountId: req.body.accountId,
          amount,
          type: "savings_contribution",
          savingsGoalId: goal.id,
          note: req.body.note ?? `Contribution to ${goal.name}`,
        });
        const newAmount = money(goal.current_amount + amount);
        const completed = newAmount >= goal.target_amount;
        db.prepare(
          `UPDATE savings_goals SET current_amount = ?, is_completed = ?,
                 completed_at = CASE WHEN ? AND completed_at IS NULL THEN ? ELSE completed_at END,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE id = ?`,
        ).run(newAmount, completed ? 1 : 0, completed ? 1 : 0, nowIso(), goal.id);
        audit(db, req.userId, "savings_contributions", contribId, "INSERT", undefined, {
          goalId: goal.id,
          amount,
        });
      })();
      const row = db
        .prepare(`SELECT * FROM savings_goals WHERE id = ?`)
        .get(goal.id) as GoalRow;
      res.status(201).json({ contributionId: contribId, goal: goalJson(row) });
    } catch (e) {
      next(e);
    }
  },
);
