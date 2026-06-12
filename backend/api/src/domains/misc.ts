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
import { applyTransaction, assertOwnAccount } from "./balances";

// ============================ budget allocations ============================

export const allocationsByMonthRouter = Router();

allocationsByMonthRouter.get("/:monthKey/allocations", (req, res) => {
  const mk = monthKeyParam(req);
  const rows = getDb()
    .prepare(
      `SELECT * FROM budget_allocations WHERE user_id = ? AND month_key = ? ORDER BY created_at`,
    )
    .all(req.userId, mk) as Record<string, unknown>[];
  res.json({
    allocations: rows.map((r) => ({
      id: r.id,
      accountId: r.account_id,
      monthKey: r.month_key,
      amount: r.amount,
    })),
  });
});

/**
 * Allocate money from an account into the month's budget. Allocation row
 * and balance deduction commit together (the ordering bug class the
 * Supabase path had is structurally impossible here).
 */
allocationsByMonthRouter.post(
  "/:monthKey/allocations",
  validateBody(z.object({ accountId: z.string().uuid(), amount: z.number().positive() })),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const mk = monthKeyParam(req);
      const { accountId } = req.body;
      const amount = money(req.body.amount);
      const db = getDb();
      assertOwnAccount(db, req.userId, accountId);
      let id = "";
      db.transaction(() => {
        const existing = db
          .prepare(
            `SELECT id, amount FROM budget_allocations WHERE user_id = ? AND account_id = ? AND month_key = ?`,
          )
          .get(req.userId, accountId, mk) as { id: string; amount: number } | undefined;
        if (existing) {
          id = existing.id;
          db.prepare(
            `UPDATE budget_allocations SET amount = ROUND(amount + ?, 2),
                   updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
             WHERE id = ?`,
          ).run(amount, existing.id);
        } else {
          id = newId();
          db.prepare(
            `INSERT INTO budget_allocations (id, user_id, account_id, month_key, amount) VALUES (?, ?, ?, ?, ?)`,
          ).run(id, req.userId, accountId, mk, amount);
        }
        applyTransaction(db, req.userId, {
          fromAccountId: accountId,
          amount,
          type: "budget_allocation",
          monthKey: mk,
          note: `Allocated to ${mk} budget`,
        });
        audit(db, req.userId, "budget_allocations", id, existing ? "UPDATE" : "INSERT", existing, {
          accountId,
          monthKey: mk,
          amount,
        });
      })();
      res.status(201).json({ id, accountId, monthKey: mk });
    } catch (e) {
      next(e);
    }
  },
);

export const allocationsRouter = Router();

/** Set an allocation to a new amount; the difference moves between account and budget. */
allocationsRouter.patch(
  "/:id",
  validateBody(z.object({ amount: z.number().min(0) })),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb();
      const old = db
        .prepare(`SELECT * FROM budget_allocations WHERE id = ? AND user_id = ?`)
        .get(req.params.id, req.userId) as
        | { id: string; account_id: string; month_key: string; amount: number }
        | undefined;
      if (!old) throw notFound("Allocation");
      const target = money(req.body.amount);
      const diff = money(target - old.amount);
      db.transaction(() => {
        db.prepare(
          `UPDATE budget_allocations SET amount = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
        ).run(target, old.id);
        if (diff > 0) {
          applyTransaction(db, req.userId, {
            fromAccountId: old.account_id,
            amount: diff,
            type: "budget_allocation",
            monthKey: old.month_key,
            note: "Allocation increased",
          });
        } else if (diff < 0) {
          applyTransaction(db, req.userId, {
            toAccountId: old.account_id,
            amount: -diff,
            type: "budget_allocation",
            monthKey: old.month_key,
            note: "Allocation decreased - refund",
          });
        }
        audit(db, req.userId, "budget_allocations", old.id, "UPDATE", old, { amount: target });
      })();
      res.json({ id: old.id, amount: target });
    } catch (e) {
      next(e);
    }
  },
);

/** Remove an allocation, refunding the full amount to the account. */
allocationsRouter.delete("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const old = db
      .prepare(`SELECT * FROM budget_allocations WHERE id = ? AND user_id = ?`)
      .get(req.params.id, req.userId) as
      | { id: string; account_id: string; month_key: string; amount: number }
      | undefined;
    if (!old) throw notFound("Allocation");
    db.transaction(() => {
      if (old.amount > 0) {
        applyTransaction(db, req.userId, {
          toAccountId: old.account_id,
          amount: old.amount,
          type: "budget_allocation",
          monthKey: old.month_key,
          note: "Allocation removed - refund",
        });
      }
      db.prepare(`DELETE FROM budget_allocations WHERE id = ?`).run(old.id);
      audit(db, req.userId, "budget_allocations", old.id, "DELETE", old, undefined);
    })();
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ================================ categories ================================

const categoryBody = z.object({
  name: z.string().min(1).max(120),
  color: z.string().min(1).max(20),
  icon: z.string().min(1).max(60),
  sortOrder: z.number().int().default(0),
  isDefault: z.boolean().default(false),
});

export const categoriesRouter = Router();

categoriesRouter.get("/", (req, res) => {
  const rows = getDb()
    .prepare(`SELECT * FROM categories WHERE user_id = ? ORDER BY sort_order, name`)
    .all(req.userId) as Record<string, unknown>[];
  res.json({
    categories: rows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      icon: r.icon,
      sortOrder: r.sort_order,
      isDefault: !!r.is_default,
    })),
  });
});

categoriesRouter.post(
  "/",
  validateBody(categoryBody),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const b = req.body;
      const db = getDb();
      const id = newId();
      db.prepare(
        `INSERT INTO categories (id, user_id, name, color, icon, sort_order, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, req.userId, b.name, b.color, b.icon, b.sortOrder, b.isDefault ? 1 : 0);
      audit(db, req.userId, "categories", id, "INSERT", undefined, b);
      res.status(201).json({ id, ...b });
    } catch (e) {
      next(e);
    }
  },
);

categoriesRouter.patch(
  "/:id",
  validateBody(categoryBody.partial()),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb();
      const old = db
        .prepare(`SELECT * FROM categories WHERE id = ? AND user_id = ?`)
        .get(req.params.id, req.userId) as Record<string, unknown> | undefined;
      if (!old) throw notFound("Category");
      const b = req.body;
      db.prepare(
        `UPDATE categories SET name = ?, color = ?, icon = ?, sort_order = ?, is_default = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?`,
      ).run(
        b.name ?? old.name,
        b.color ?? old.color,
        b.icon ?? old.icon,
        b.sortOrder ?? old.sort_order,
        b.isDefault !== undefined ? (b.isDefault ? 1 : 0) : old.is_default,
        req.params.id,
      );
      audit(db, req.userId, "categories", req.params.id, "UPDATE", old, b);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

categoriesRouter.delete("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const old = db
      .prepare(`SELECT * FROM categories WHERE id = ? AND user_id = ?`)
      .get(req.params.id, req.userId);
    if (!old) throw notFound("Category");
    db.transaction(() => {
      // ON DELETE SET NULL detaches expenses/plans; keep their legacy text.
      db.prepare(`DELETE FROM categories WHERE id = ?`).run(req.params.id);
      audit(db, req.userId, "categories", req.params.id, "DELETE", old, undefined);
    })();
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ================================== drafts ==================================

const draftBody = z.object({
  note: z.string().min(1).max(500),
  amount: z.number().positive().optional(),
  category: z.string().max(120).optional(),
  accountId: z.string().uuid().optional(),
  date: z.string().refine(isDateString, 'date must be "YYYY-MM-DD"').optional(),
});

export const draftsRouter = Router();

draftsRouter.get("/", (req, res) => {
  const rows = getDb()
    .prepare(`SELECT * FROM drafts WHERE user_id = ? ORDER BY created_at DESC`)
    .all(req.userId) as Record<string, unknown>[];
  res.json({
    drafts: rows.map((r) => ({
      id: r.id,
      note: r.note,
      amount: r.amount ?? undefined,
      category: r.category ?? undefined,
      accountId: r.account_id ?? undefined,
      date: r.date ?? undefined,
      createdAt: r.created_at,
    })),
  });
});

draftsRouter.post(
  "/",
  validateBody(draftBody),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const b = req.body;
      const id = newId();
      getDb()
        .prepare(
          `INSERT INTO drafts (id, user_id, note, amount, category, account_id, date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          req.userId,
          b.note,
          b.amount !== undefined ? money(b.amount) : null,
          b.category ?? null,
          b.accountId ?? null,
          b.date ?? null,
        );
      res.status(201).json({ id, ...b });
    } catch (e) {
      next(e);
    }
  },
);

draftsRouter.patch(
  "/:id",
  validateBody(draftBody.partial()),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb();
      const old = db
        .prepare(`SELECT * FROM drafts WHERE id = ? AND user_id = ?`)
        .get(req.params.id, req.userId) as Record<string, unknown> | undefined;
      if (!old) throw notFound("Draft");
      const b = req.body;
      db.prepare(
        `UPDATE drafts SET note = ?, amount = ?, category = ?, account_id = ?, date = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?`,
      ).run(
        b.note ?? old.note,
        b.amount !== undefined ? money(b.amount) : old.amount,
        b.category !== undefined ? b.category : old.category,
        b.accountId !== undefined ? b.accountId : old.account_id,
        b.date !== undefined ? b.date : old.date,
        req.params.id,
      );
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

draftsRouter.delete("/:id", (req, res, next) => {
  try {
    const r = getDb()
      .prepare(`DELETE FROM drafts WHERE id = ? AND user_id = ?`)
      .run(req.params.id, req.userId);
    if (r.changes === 0) throw notFound("Draft");
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

draftsRouter.delete("/", (req, res) => {
  getDb().prepare(`DELETE FROM drafts WHERE user_id = ?`).run(req.userId);
  res.status(204).end();
});

// ============================== forecast flows ==============================

const flowBody = z.object({
  year: z.number().int().min(2000).max(2200),
  months: z.array(z.number().int().min(1).max(12)).default([]),
  type: z.enum(["in", "out"]),
  name: z.string().max(200).optional(),
  uncertain: z.boolean().default(false),
  value: z.number().optional(),
  lowValue: z.number().optional(),
  highValue: z.number().optional(),
  isGhost: z.boolean().default(false),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const flowJson = (r: Record<string, unknown>) => ({
  id: r.id,
  year: r.year,
  months: JSON.parse(String(r.months ?? "[]")),
  type: r.type,
  name: r.name ?? undefined,
  uncertain: !!r.uncertain,
  value: r.value ?? undefined,
  lowValue: r.low_value ?? undefined,
  highValue: r.high_value ?? undefined,
  isGhost: !!r.is_ghost,
  enabled: !!r.enabled,
  sortOrder: r.sort_order,
});

export const forecastRouter = Router();

forecastRouter.get("/", (req, res, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    if (req.query.year && !Number.isInteger(year)) throw badRequest("year must be an integer");
    const rows = (
      year !== undefined
        ? getDb()
            .prepare(
              `SELECT * FROM forecast_flows WHERE user_id = ? AND year = ? ORDER BY sort_order, created_at`,
            )
            .all(req.userId, year)
        : getDb()
            .prepare(`SELECT * FROM forecast_flows WHERE user_id = ? ORDER BY year, sort_order`)
            .all(req.userId)
    ) as Record<string, unknown>[];
    res.json({ flows: rows.map(flowJson) });
  } catch (e) {
    next(e);
  }
});

forecastRouter.post(
  "/",
  validateBody(flowBody),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const b = req.body;
      const id = newId();
      getDb()
        .prepare(
          `INSERT INTO forecast_flows (id, user_id, year, months, type, name, uncertain, value, low_value, high_value, is_ghost, enabled, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          req.userId,
          b.year,
          JSON.stringify(b.months),
          b.type,
          b.name ?? null,
          b.uncertain ? 1 : 0,
          b.value ?? null,
          b.lowValue ?? null,
          b.highValue ?? null,
          b.isGhost ? 1 : 0,
          b.enabled ? 1 : 0,
          b.sortOrder,
        );
      const row = getDb()
        .prepare(`SELECT * FROM forecast_flows WHERE id = ?`)
        .get(id) as Record<string, unknown>;
      res.status(201).json(flowJson(row));
    } catch (e) {
      next(e);
    }
  },
);

forecastRouter.patch(
  "/:id",
  validateBody(flowBody.partial()),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb();
      const old = db
        .prepare(`SELECT * FROM forecast_flows WHERE id = ? AND user_id = ?`)
        .get(req.params.id, req.userId) as Record<string, unknown> | undefined;
      if (!old) throw notFound("Forecast flow");
      const b = req.body;
      db.prepare(
        `UPDATE forecast_flows SET year = ?, months = ?, type = ?, name = ?, uncertain = ?, value = ?, low_value = ?, high_value = ?, is_ghost = ?, enabled = ?, sort_order = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?`,
      ).run(
        b.year ?? old.year,
        b.months !== undefined ? JSON.stringify(b.months) : old.months,
        b.type ?? old.type,
        b.name !== undefined ? b.name : old.name,
        b.uncertain !== undefined ? (b.uncertain ? 1 : 0) : old.uncertain,
        b.value !== undefined ? b.value : old.value,
        b.lowValue !== undefined ? b.lowValue : old.low_value,
        b.highValue !== undefined ? b.highValue : old.high_value,
        b.isGhost !== undefined ? (b.isGhost ? 1 : 0) : old.is_ghost,
        b.enabled !== undefined ? (b.enabled ? 1 : 0) : old.enabled,
        b.sortOrder ?? old.sort_order,
        req.params.id,
      );
      const row = db
        .prepare(`SELECT * FROM forecast_flows WHERE id = ?`)
        .get(req.params.id) as Record<string, unknown>;
      res.json(flowJson(row));
    } catch (e) {
      next(e);
    }
  },
);

forecastRouter.delete("/:id", (req, res, next) => {
  try {
    const r = getDb()
      .prepare(`DELETE FROM forecast_flows WHERE id = ? AND user_id = ?`)
      .run(req.params.id, req.userId);
    if (r.changes === 0) throw notFound("Forecast flow");
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ============================ spreadsheet entries ===========================

export const spreadsheetRouter = Router();

spreadsheetRouter.get("/", (req, res, next) => {
  try {
    const { from, to } = req.query as Record<string, string | undefined>;
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
    const rows = getDb()
      .prepare(
        `SELECT month_key, column_key, value FROM spreadsheet_entries WHERE ${clauses.join(" AND ")}`,
      )
      .all(...params) as { month_key: string; column_key: string; value: number }[];
    res.json({
      entries: rows.map((r) => ({
        monthKey: r.month_key,
        columnKey: r.column_key,
        value: r.value,
      })),
    });
  } catch (e) {
    next(e);
  }
});

spreadsheetRouter.put(
  "/",
  validateBody(
    z.object({
      monthKey: z.string().refine(isMonthKey, 'monthKey must be "YYYY-MM"'),
      columnKey: z.string().min(1).max(80),
      value: z.number(),
    }),
  ),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { monthKey, columnKey, value } = req.body;
      getDb()
        .prepare(
          `INSERT INTO spreadsheet_entries (id, user_id, month_key, column_key, value)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (user_id, month_key, column_key) DO UPDATE SET value = excluded.value`,
        )
        .run(newId(), req.userId, monthKey, columnKey, money(value));
      res.json({ monthKey, columnKey, value: money(value) });
    } catch (e) {
      next(e);
    }
  },
);
