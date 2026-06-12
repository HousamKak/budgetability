import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config";
import { getDb } from "../db";
import { HttpError, badRequest, newId, nowIso, sha256, validateBody } from "../lib/helpers";

// Express's Request is augmented with the authenticated user id.
declare module "express-serve-static-core" {
  interface Request {
    userId: string;
  }
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

const publicUser = (u: UserRow) => ({
  id: u.id,
  email: u.email,
  fullName: u.full_name,
  avatarUrl: u.avatar_url,
  createdAt: u.created_at,
});

// ---------------------------------------------------------------- tokens

function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: config.accessTokenTtl,
  });
}

function issueRefreshToken(userId: string): string {
  const raw = `rt_${crypto.randomBytes(32).toString("hex")}`;
  const expiresAt = new Date(Date.now() + config.refreshTokenTtl * 1000).toISOString();
  getDb()
    .prepare(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
    )
    .run(newId(), userId, sha256(raw), expiresAt);
  return raw;
}

function issueSession(user: UserRow) {
  return {
    user: publicUser(user),
    accessToken: signAccessToken(user.id),
    refreshToken: issueRefreshToken(user.id),
    expiresIn: config.accessTokenTtl,
  };
}

// ------------------------------------------------------------- middleware

/**
 * Bearer auth: accepts a JWT access token or a personal access token
 * (PATs start with "bat_" — budgetability api token).
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return next(new HttpError(401, "Missing bearer token"));

  if (token.startsWith("bat_")) {
    const row = getDb()
      .prepare(
        `SELECT id, user_id FROM api_tokens WHERE token_hash = ? AND revoked_at IS NULL`,
      )
      .get(sha256(token)) as { id: string; user_id: string } | undefined;
    if (!row) return next(new HttpError(401, "Invalid or revoked API token"));
    getDb()
      .prepare(`UPDATE api_tokens SET last_used_at = ? WHERE id = ?`)
      .run(nowIso(), row.id);
    req.userId = row.user_id;
    return next();
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload === "string" || !payload.sub) throw new Error("bad payload");
    req.userId = payload.sub;
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired access token"));
  }
}

// ---------------------------------------------------------------- routes

const credentialsSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(8, "password must be at least 8 characters"),
  fullName: z.string().max(120).optional(),
});

export const authRouter = Router();

authRouter.post(
  "/register",
  validateBody(credentialsSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, fullName } = req.body;
      const db = getDb();
      const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
      if (existing) throw new HttpError(409, "An account with this email already exists");
      const id = newId();
      db.prepare(
        `INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)`,
      ).run(id, email, bcrypt.hashSync(password, 10), fullName ?? null);
      const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow;
      res.status(201).json(issueSession(user));
    } catch (e) {
      next(e);
    }
  },
);

authRouter.post(
  "/login",
  validateBody(credentialsSchema.pick({ email: true, password: true })),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const user = getDb()
        .prepare(`SELECT * FROM users WHERE email = ?`)
        .get(email) as UserRow | undefined;
      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        throw new HttpError(401, "Invalid email or password");
      }
      res.json(issueSession(user));
    } catch (e) {
      next(e);
    }
  },
);

authRouter.post(
  "/refresh",
  validateBody(z.object({ refreshToken: z.string().min(1) })),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb();
      const row = db
        .prepare(
          `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?`,
        )
        .get(sha256(req.body.refreshToken)) as
        | { id: string; user_id: string; expires_at: string; revoked_at: string | null }
        | undefined;
      if (!row || row.revoked_at || row.expires_at < nowIso()) {
        throw new HttpError(401, "Invalid or expired refresh token");
      }
      // Rotate: revoke the used token, issue a fresh pair.
      db.prepare(`UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?`).run(
        nowIso(),
        row.id,
      );
      const user = db
        .prepare(`SELECT * FROM users WHERE id = ?`)
        .get(row.user_id) as UserRow;
      res.json(issueSession(user));
    } catch (e) {
      next(e);
    }
  },
);

authRouter.get("/me", requireAuth, (req: Request, res: Response) => {
  const user = getDb()
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .get(req.userId) as UserRow;
  res.json({ user: publicUser(user) });
});

// ------------------------------------------------- personal access tokens

authRouter.post(
  "/tokens",
  requireAuth,
  validateBody(z.object({ name: z.string().min(1).max(80) })),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const raw = `bat_${crypto.randomBytes(32).toString("hex")}`;
      const id = newId();
      getDb()
        .prepare(
          `INSERT INTO api_tokens (id, user_id, name, token_hash) VALUES (?, ?, ?, ?)`,
        )
        .run(id, req.userId, req.body.name, sha256(raw));
      // The raw token is shown exactly once.
      res.status(201).json({ id, name: req.body.name, token: raw });
    } catch (e) {
      next(e);
    }
  },
);

authRouter.get("/tokens", requireAuth, (req: Request, res: Response) => {
  const rows = getDb()
    .prepare(
      `SELECT id, name, created_at, last_used_at FROM api_tokens
       WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC`,
    )
    .all(req.userId);
  res.json({ tokens: rows });
});

authRouter.delete(
  "/tokens/:id",
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = getDb()
        .prepare(
          `UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
        )
        .run(nowIso(), req.params.id, req.userId);
      if (r.changes === 0) throw badRequest("Token not found or already revoked");
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  },
);
