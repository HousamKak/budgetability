import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Self-register budgetability-live with H's MCP registry — modeled exactly on
 * comms-hub's `register.ts`.
 *
 * H merges every *live* registry server into every agent turn and every spawned
 * Claude terminal, so once we announce our **launch spec** (how to spawn this
 * stdio MCP), H consumers spawn it on demand — and each spawned instance
 * re-announces on startup, refreshing the TTL. That's why comms-hub stays `up`
 * resiliently: many short-lived registrars on a long TTL, instead of one
 * standalone heartbeat process (the old `scripts/h-announce.mjs` model) whose
 * death took the entry down.
 *
 * The one twist vs comms-hub: comms's creds are OAuth token files on disk, so
 * its spec env only carries H_API_KEY. We sign in to Supabase with email +
 * password, so we must pass those (plus optional URL/key) in the launch spec's
 * env — H bakes them into every spawned instance so it can sign in and
 * re-announce. They come from THIS process's env, so whoever first launches us
 * (or H, re-spawning us) seeds them.
 *
 * Fire-and-forget: if H is down, unreachable, or no API key is available this is
 * a silent no-op and the MCP keeps working standalone.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(here, "..");
/** Absolute path to the built stdio entry point (node dist/index.js). */
const MCP_ENTRY = path.join(PROJECT_ROOT, "dist", "index.js");

// H guards /api with an internal key. Prefer an explicit env var; otherwise read
// H's persisted `mcp-api-key` file (defaults to H's repo data dir on this PC).
const H_API_BASE = process.env.H_API_BASE ?? "http://127.0.0.1:3100";
const H_MCP_KEY_FILE =
  process.env.H_MCP_KEY_FILE ?? path.join("D:", "dev", "H", "data", "mcp-api-key");
// Set H_REGISTER=0 to disable the auto-registration entirely.
const H_REGISTER = process.env.H_REGISTER !== "0";

function resolveHApiKey(): string | undefined {
  if (process.env.H_API_KEY) return process.env.H_API_KEY.trim();
  try {
    const raw = fs.readFileSync(H_MCP_KEY_FILE, "utf8").trim();
    return raw || undefined;
  } catch {
    return undefined;
  }
}

/** Creds that travel in the launch spec so each H-spawned instance can sign in
 *  to Supabase and re-announce (mirrors comms passing H_API_KEY through). */
function spawnEnv(apiKey: string): Record<string, string> {
  const env: Record<string, string> = { H_API_KEY: apiKey };
  for (const k of [
    "SUPABASE_EMAIL",
    "SUPABASE_PASSWORD",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_KEY",
  ]) {
    const v = process.env[k];
    if (v) env[k] = v;
  }
  return env;
}

export interface AnnounceOptions {
  /** Seconds before H marks the entry `down` without a fresh heartbeat. H caps
   *  this at 3600. Default 3600. */
  ttlSeconds?: number;
  /** Throw on failure instead of swallowing. Default false. */
  loud?: boolean;
}

export async function announceToH(opts: AnnounceOptions = {}): Promise<boolean> {
  if (!H_REGISTER) return false;
  const apiKey = resolveHApiKey();
  if (!apiKey) {
    if (opts.loud)
      throw new Error(
        "No H API key found. Set H_API_KEY, or point H_MCP_KEY_FILE at H's data/mcp-api-key file.",
      );
    return false; // standalone mode — nothing to register against
  }
  const spec = {
    name: "budgetability-live",
    type: "stdio" as const,
    command: "node",
    args: [MCP_ENTRY],
    env: spawnEnv(apiKey),
  };
  const ttlSeconds = opts.ttlSeconds ?? 3600;
  try {
    const res = await fetch(`${H_API_BASE}/api/mcp-servers/announce`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ spec, ttlSeconds }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (opts.loud) throw new Error(`H announce failed: ${res.status} ${detail}`);
      console.error(`[h] announce failed: ${res.status} ${detail}`.trim());
      return false;
    }
    console.error(`[h] registered with H at ${H_API_BASE} (ttl ${ttlSeconds}s)`);
    return true;
  } catch (err) {
    if (opts.loud) throw err;
    console.error(`[h] announce skipped: ${(err as Error).message ?? err}`);
    return false;
  }
}

/**
 * Announce now, then re-announce on a timer so a long-lived standalone instance
 * keeps itself `up` (comms-hub gets this from its watcher's scheduled sync).
 * Ephemeral instances H spawns per agent turn die long before the timer fires —
 * that's fine, their startup announce already refreshed the TTL.
 */
export function startHAnnounce(ttlSeconds = 3600): void {
  void announceToH({ ttlSeconds });
  const everyMs = Math.max(30, Math.floor(ttlSeconds / 2)) * 1000;
  const timer = setInterval(() => void announceToH({ ttlSeconds }), everyMs);
  timer.unref?.(); // never keep the process alive just for the heartbeat
}
