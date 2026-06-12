import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import type { DB } from "../db";

export const newId = (): string => crypto.randomUUID();

/** Round to 2 decimal places — all money passes through this on write. */
export const money = (n: number): number => Math.round(n * 100) / 100;

export const nowIso = (): string => new Date().toISOString();

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isMonthKey = (s: string): boolean => MONTH_KEY_RE.test(s);
export const isDateString = (s: string): boolean => DATE_RE.test(s);

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new HttpError(404, `${what} not found`);
export const badRequest = (msg: string) => new HttpError(400, msg);

/** Validate req.body against a zod schema; replaces body with the parsed value. */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const msg = result.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      return next(badRequest(msg));
    }
    req.body = result.data;
    next();
  };
}

/** Assert and return a valid :monthKey route param. */
export function monthKeyParam(req: Request): string {
  const mk = req.params.monthKey;
  if (!mk || !isMonthKey(mk)) throw badRequest('monthKey must be "YYYY-MM"');
  return mk;
}

/** Write an audit_logs row (called inside the same transaction as the change). */
export function audit(
  db: DB,
  userId: string,
  table: string,
  recordId: string,
  action: "INSERT" | "UPDATE" | "DELETE",
  oldData?: unknown,
  newData?: unknown,
): void {
  db.prepare(
    `INSERT INTO audit_logs (id, table_name, record_id, action, old_data, new_data, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    table,
    recordId,
    action,
    oldData === undefined ? null : JSON.stringify(oldData),
    newData === undefined ? null : JSON.stringify(newData),
    userId,
  );
}

export const sha256 = (s: string): string =>
  crypto.createHash("sha256").update(s).digest("hex");
