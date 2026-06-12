/**
 * MCP registry self-registration.
 *
 * When MCP_REGISTRY_URL is set, the server announces itself (identity,
 * transport, env requirements, and all components) so it becomes
 * discoverable. Generic contract — see docs/MCP-REGISTRY.md in the repo:
 *
 *   POST {MCP_REGISTRY_URL}/register     full manifest; idempotent upsert
 *                                        by `id`; re-sent as heartbeat
 *   POST {MCP_REGISTRY_URL}/unregister   { id } on shutdown (best effort)
 *
 * Env:
 *   MCP_REGISTRY_URL                 base URL of the registry (unset = off)
 *   MCP_REGISTRY_TOKEN               optional bearer token
 *   MCP_REGISTRY_HEARTBEAT_SECONDS   default 300, 0 disables heartbeats
 *
 * Registration is fire-and-forget: a missing or failing registry NEVER
 * affects the MCP server itself. All logging goes to stderr (stdout is
 * reserved for JSON-RPC).
 */
import os from "os";

export interface ToolMeta {
  name: string;
  description: string;
  inputSchema: unknown;
}

export interface EnvVarMeta {
  name: string;
  required: boolean;
  secret?: boolean;
  description?: string;
}

export interface RegistryOptions {
  name: string;
  version: string;
  description: string;
  tags: string[];
  env: EnvVarMeta[];
  tools: ToolMeta[];
}

export function startRegistryAnnouncer(opts: RegistryOptions): void {
  const base = process.env.MCP_REGISTRY_URL?.replace(/\/+$/, "");
  if (!base) return; // no registry configured — stay silent

  const id = `${opts.name}@${os.hostname()}`;
  const startedAt = new Date().toISOString();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.MCP_REGISTRY_TOKEN) {
    headers.authorization = `Bearer ${process.env.MCP_REGISTRY_TOKEN}`;
  }

  const manifest = () => ({
    schemaVersion: 1,
    id,
    name: opts.name,
    version: opts.version,
    description: opts.description,
    status: "up",
    host: os.hostname(),
    platform: process.platform,
    pid: process.pid,
    startedAt,
    lastSeenAt: new Date().toISOString(),
    transport: {
      type: "stdio",
      command: process.execPath,
      args: process.argv.slice(1),
    },
    env: opts.env,
    tags: opts.tags,
    components: {
      tools: opts.tools,
      resources: [],
      prompts: [],
    },
  });

  async function post(path: string, body: unknown): Promise<boolean> {
    try {
      const res = await fetch(`${base}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) console.error(`[registry] ${path} -> HTTP ${res.status}`);
      return res.ok;
    } catch (e) {
      console.error(`[registry] ${base} unreachable: ${(e as Error).message}`);
      return false;
    }
  }

  void post("/register", manifest()).then((ok) => {
    if (ok) console.error(`[registry] registered as ${id} at ${base}`);
  });

  const heartbeatSecs = Number(process.env.MCP_REGISTRY_HEARTBEAT_SECONDS ?? 300);
  if (Number.isFinite(heartbeatSecs) && heartbeatSecs > 0) {
    const timer = setInterval(() => void post("/register", manifest()), heartbeatSecs * 1000);
    timer.unref(); // never keep the process alive just for heartbeats
  }

  const unregister = (signal: NodeJS.Signals) => {
    void post("/unregister", { id });
    // Give the request a moment to leave, then resume normal shutdown.
    setTimeout(() => process.exit(signal === "SIGINT" ? 130 : 143), 250).unref();
  };
  process.once("SIGINT", unregister);
  process.once("SIGTERM", unregister);
}
