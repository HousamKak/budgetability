#!/usr/bin/env node
/**
 * h-announce — register the Budgetability MCP server into H's MCP registry and
 * heartbeat its health for as long as it runs.
 *
 * Budgetability's MCP server is external and standalone (it talks to the live
 * Supabase backend under the signed-in user's RLS). This wrapper makes it
 * *discoverable to H* without H having to know anything about it ahead of time:
 *
 *   1. It POSTs the server's launch spec to  POST {H_API_BASE}/api/mcp-servers/announce
 *      with a TTL, then re-POSTs every TTL/2 seconds.
 *   2. H keeps the entry `up` only while heartbeats keep arriving and merges it
 *      (enabled + live) into the MCP config of every terminal/agent it spawns.
 *   3. The moment this process exits — clean shutdown, crash, or kill — heartbeats
 *      stop and H flips the entry `down` after the TTL. That IS the health signal;
 *      there is no separate "unregister" call to depend on.
 *
 * This mirrors H's own packages/mcp/scripts/h-mcp-announce.mjs "auto-register
 * when up" hook, specialized for Budgetability (default command + API-key
 * auto-discovery). Registration is best-effort: if H is unreachable the MCP
 * server still spawns and works normally — only discovery is lost.
 *
 * Usage (this is what your MCP client launches instead of the raw server):
 *
 *   node scripts/h-announce.mjs
 *   node scripts/h-announce.mjs -- node /abs/path/to/dist/index.js   # explicit child
 *
 * Env:
 *   H_API_BASE   H API root. If unset, the first reachable of the installed
 *                desktop app (http://127.0.0.1:4100) and a dev stack
 *                (http://127.0.0.1:3100) is used.
 *   H_API_KEY    H internal API key. If unset, auto-discovered from, in order:
 *                  - dirname(H_DB_PATH)/mcp-api-key
 *                  - %APPDATA%/dev.h.desktop/data/mcp-api-key   (desktop install)
 *   H_ANNOUNCE_NAME   registry name (default "budgetability-live")
 *   H_ANNOUNCE_TTL    seconds before H considers a silent server down (default 60)
 *   SUPABASE_EMAIL / SUPABASE_PASSWORD / SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY
 *                 forwarded to the spawned server and embedded in the registry
 *                 spec so H can re-spawn the server itself.
 */
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Installed desktop app runs on 4100; a `pnpm dev` stack runs on 3100.
const BASE_CANDIDATES = ["http://127.0.0.1:4100", "http://127.0.0.1:3100"];
const NAME = process.env.H_ANNOUNCE_NAME ?? "budgetability-live";
const TTL = (() => {
  const n = Number(process.env.H_ANNOUNCE_TTL);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 3600) : 60;
})();

/** Resolve H's internal API key the same way H's own clients (telegram/voice) do. */
function resolveApiKey() {
  if (process.env.H_API_KEY) return process.env.H_API_KEY.trim();
  const candidates = [];
  if (process.env.H_DB_PATH) {
    candidates.push(join(dirname(resolve(process.env.H_DB_PATH)), "mcp-api-key"));
  }
  if (process.env.APPDATA) {
    candidates.push(join(process.env.APPDATA, "dev.h.desktop", "data", "mcp-api-key"));
  }
  for (const f of candidates) {
    try {
      if (existsSync(f)) {
        const key = readFileSync(f, "utf8").trim();
        if (key) return key;
      }
    } catch {
      /* keep trying */
    }
  }
  return undefined;
}

/** The command that launches the real Budgetability MCP server. */
function resolveChildCommand(argv) {
  const dash = argv.indexOf("--");
  if (dash !== -1) {
    const cmd = argv.slice(dash + 1);
    if (cmd.length) return { command: cmd[0], args: cmd.slice(1) };
  }
  // Default: the built server living next to this script.
  return { command: process.execPath, args: [resolve(__dirname, "..", "dist", "index.js")] };
}

/** Env the server needs, carried in the spec so H can re-spawn it standalone. */
function specEnv() {
  const env = {};
  for (const k of ["SUPABASE_EMAIL", "SUPABASE_PASSWORD", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"]) {
    if (process.env[k]) env[k] = process.env[k];
  }
  return Object.keys(env).length ? env : undefined;
}

const apiKey = resolveApiKey();
const { command, args } = resolveChildCommand(process.argv.slice(2));
const spec = { name: NAME, type: "stdio", command, args, env: specEnv() };

/** First reachable H API root: an explicit H_API_BASE, else whichever candidate
 *  answers /api/health. Returns null if none respond. */
async function resolveApiBase() {
  if (process.env.H_API_BASE) return process.env.H_API_BASE.replace(/\/+$/, "");
  for (const base of BASE_CANDIDATES) {
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return base;
    } catch {
      /* try next */
    }
  }
  return null;
}

let apiBase = null; // locked in on first successful resolution

async function announce() {
  if (!apiKey) {
    console.error("[h-announce] no H_API_KEY (set it or install the H desktop app) — skipping registration");
    return false;
  }
  apiBase ??= await resolveApiBase();
  if (!apiBase) {
    console.error(`[h-announce] no H API reachable on ${BASE_CANDIDATES.join(", ")} — will retry`);
    return false;
  }
  try {
    const res = await fetch(`${apiBase}/api/mcp-servers/announce`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ spec, ttlSeconds: TTL }),
    });
    if (!res.ok) {
      console.error(`[h-announce] announce ${res.status} ${await res.text().catch(() => "")}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[h-announce] ${apiBase} unreachable — ${err?.message ?? err}`);
    apiBase = null; // re-probe next heartbeat (H may have moved/restarted)
    return false;
  }
}

// Register immediately, then heartbeat at half the TTL so one missed beat
// doesn't flap the entry down. Never let registration block the MCP itself.
void announce().then((ok) => {
  if (ok) console.error(`[h-announce] registered "${NAME}" with H at ${apiBase} (ttl ${TTL}s)`);
});
const beat = setInterval(announce, Math.max(5, TTL / 2) * 1000);
beat.unref?.();

// Spawn the real MCP server and let it own the stdio (JSON-RPC) channel; this
// process just sits alongside heartbeating. When the server exits, so do we —
// which is exactly the down-signal H is watching for.
const child = spawn(command, args, { stdio: "inherit", env: { ...process.env, ...(spec.env ?? {}) } });
child.on("exit", (code) => { clearInterval(beat); process.exit(code ?? 0); });
child.on("error", (err) => {
  console.error(`[h-announce] failed to spawn MCP server — ${err.message}`);
  clearInterval(beat);
  process.exit(1);
});
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
