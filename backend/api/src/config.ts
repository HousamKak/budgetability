import fs from "fs";
import path from "path";

// Minimal .env loader (no dotenv dependency): KEY=VALUE lines, # comments.
const envFile = path.join(__dirname, "..", ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !line.trimStart().startsWith("#") && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

function int(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  port: int(process.env.PORT, 8787),
  databasePath:
    process.env.DATABASE_PATH ??
    path.join(__dirname, "..", "..", "data", "budgetability.db"),
  jwtSecret: process.env.JWT_SECRET ?? "",
  accessTokenTtl: int(process.env.ACCESS_TOKEN_TTL, 900),
  refreshTokenTtl: int(process.env.REFRESH_TOKEN_TTL, 30 * 24 * 60 * 60),
  corsOrigins: (process.env.CORS_ORIGINS ?? "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

export function assertConfig(): void {
  if (!config.jwtSecret || config.jwtSecret === "change-me-to-a-long-random-string") {
    throw new Error(
      "JWT_SECRET is not set. Copy .env.example to .env and set a long random value.",
    );
  }
}
