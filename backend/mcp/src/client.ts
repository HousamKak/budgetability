/**
 * Tiny HTTP client for the Budgetability API.
 *
 * Auth, in order of precedence:
 *   1. BUDGETABILITY_TOKEN  — a personal access token ("bat_...")
 *   2. BUDGETABILITY_EMAIL + BUDGETABILITY_PASSWORD — logs in lazily,
 *      caches the access token, re-logs-in once on a 401.
 */

const baseUrl = (process.env.BUDGETABILITY_API_URL ?? "http://localhost:8787").replace(
  /\/+$/,
  "",
);

let cachedAccessToken: string | null = null;

async function login(): Promise<string> {
  const email = process.env.BUDGETABILITY_EMAIL;
  const password = process.env.BUDGETABILITY_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "No credentials: set BUDGETABILITY_TOKEN, or BUDGETABILITY_EMAIL and BUDGETABILITY_PASSWORD",
    );
  }
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`Login failed: ${body.error ?? res.status}`);
  }
  const data = (await res.json()) as { accessToken: string };
  cachedAccessToken = data.accessToken;
  return cachedAccessToken;
}

async function authHeader(): Promise<string> {
  const pat = process.env.BUDGETABILITY_TOKEN;
  if (pat) return `Bearer ${pat}`;
  return `Bearer ${cachedAccessToken ?? (await login())}`;
}

export async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  retried = false,
): Promise<T> {
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      authorization: await authHeader(),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !process.env.BUDGETABILITY_TOKEN && !retried) {
    cachedAccessToken = null; // expired access token — re-login once
    return api<T>(method, path, body, true);
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `API error ${res.status} on ${method} ${path}`);
  }
  return data;
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
