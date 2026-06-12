# MCP Registry — self-registration contract

Both Budgetability MCP servers (`mcp-supabase/` for the live Supabase app,
`backend/mcp/` for the standalone backend) announce themselves to an MCP
registry on startup so they become discoverable along with their
components. The registry endpoint is generic and supplied via env — nothing
is hardcoded.

## Server-side env (the MCP servers)

| Variable | Meaning |
|---|---|
| `MCP_REGISTRY_URL` | Base URL of the registry (e.g. `http://localhost:9000/api/mcp`). **Unset = registration disabled**, the server runs normally. |
| `MCP_REGISTRY_TOKEN` | Optional. Sent as `Authorization: Bearer <token>`. |
| `MCP_REGISTRY_HEARTBEAT_SECONDS` | Heartbeat interval. Default `300`; `0` disables heartbeats. |

Registration is fire-and-forget: an unreachable or failing registry never
affects the MCP server (errors only logged to stderr).

## Endpoints the registry must implement

### `POST {MCP_REGISTRY_URL}/register`

Sent once on startup and again on every heartbeat. **Idempotent upsert
keyed on `id`** — treat a repeat as "still alive, possibly updated".
A server whose `lastSeenAt` is older than ~2 heartbeat intervals can be
considered stale/down.

Body (`schemaVersion: 1`):

```jsonc
{
  "schemaVersion": 1,
  "id": "budgetability-live@HOSTNAME",   // stable identity: name@host
  "name": "budgetability-live",
  "version": "0.1.0",
  "description": "Budgetability live MCP server — ...",
  "status": "up",
  "host": "HOSTNAME",
  "platform": "win32",
  "pid": 12345,
  "startedAt": "2026-06-12T10:00:00.000Z",
  "lastSeenAt": "2026-06-12T10:05:00.000Z",
  "transport": {                          // how to spawn/connect to it
    "type": "stdio",
    "command": "C:\\path\\to\\node.exe",
    "args": ["D:\\...\\mcp-supabase\\dist\\index.js"]
  },
  "env": [                                // config surface, secrets flagged
    { "name": "SUPABASE_EMAIL", "required": true, "description": "..." },
    { "name": "SUPABASE_PASSWORD", "required": true, "secret": true, "description": "..." }
  ],
  "tags": ["budgetability", "budget", "finance", "supabase", "live"],
  "components": {
    "tools": [                            // every tool, with JSON Schema input
      {
        "name": "get_month_summary",
        "description": "Get the full summary for a month: ...",
        "inputSchema": { "type": "object", "properties": { "monthKey": { "type": "string" } } }
      }
      // ... all tools
    ],
    "resources": [],                      // same shape when servers add them
    "prompts": []
  }
}
```

### `POST {MCP_REGISTRY_URL}/unregister`

Best-effort on shutdown (SIGINT/SIGTERM). Body: `{ "id": "name@host" }`.
Don't rely on it exclusively — processes can die without signaling; use
`lastSeenAt` staleness as the source of truth.

## Responses

Any 2xx is success. Bodies are ignored. Non-2xx and network errors are
logged to stderr and retried implicitly at the next heartbeat.

## Adding registration to a new MCP server

Copy `src/registry.ts` (identical in both servers), record tool metadata at
registration time (see the `tool()` wrapper in either `src/index.ts`), and
call `startRegistryAnnouncer({...})` after `server.connect()`.
