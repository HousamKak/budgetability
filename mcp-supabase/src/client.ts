/**
 * Supabase client for the LIVE Budgetability backend.
 *
 * Signs in as a real app user with email + password; every query then runs
 * under that user's Row-Level-Security policies — exactly like the web and
 * mobile apps. The URL and publishable key are public client values (the
 * same ones shipped in both app bundles); the credentials are yours.
 *
 * Env:
 *   SUPABASE_EMAIL      (required) your Budgetability account email
 *   SUPABASE_PASSWORD   (required) your Budgetability account password
 *   SUPABASE_URL        (optional) defaults to the production project
 *   SUPABASE_PUBLISHABLE_KEY (optional) defaults to the production key
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://efnvyvjxqmnltcdbxwzh.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_PTyCYM_CZ2WZ3ObFErHSVw_YNBCwNUy";

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false, // no storage in a stdio server; keep in memory
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

let userId: string | null = null;

/** Sign in lazily (once) and return the authenticated user id. */
export async function ensureUserId(): Promise<string> {
  if (userId) return userId;
  const email = process.env.SUPABASE_EMAIL;
  const password = process.env.SUPABASE_PASSWORD;
  if (!email || !password) {
    throw new Error("Set SUPABASE_EMAIL and SUPABASE_PASSWORD to your Budgetability login");
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(`Supabase sign-in failed: ${error?.message ?? "no user"}`);
  }
  userId = data.user.id;
  return userId;
}

/** Throw a readable error when a PostgREST call fails. */
export function check(error: { message: string } | null, what: string): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

export const newId = (): string => crypto.randomUUID();

/** Round to 2 decimals — all money passes through this on write. */
export const money = (n: number): number => Math.round(n * 100) / 100;

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Strip characters that would break a PostgREST .or() filter expression. */
export const sanitizeLike = (s: string): string => s.replace(/[(),.%]/g, " ").trim();
