import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "../config";

export type DB = Database.Database;

let db: DB | null = null;

/** Open (and on first use create+migrate) the SQLite database. */
export function getDb(): DB {
  if (db) return db;
  fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
  db = new Database(config.databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  db.exec(schema);
  return db;
}

/** For tests: open an isolated in-memory database with the schema applied. */
export function openMemoryDb(): DB {
  const mem = new Database(":memory:");
  mem.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  mem.exec(schema);
  return mem;
}

export function closeDb(): void {
  db?.close();
  db = null;
}
