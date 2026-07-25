import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "@/server/db/schema";

type GlobalWithDb = typeof globalThis & {
  sqlite?: Database.Database;
  db?: ReturnType<typeof drizzle<typeof schema>>;
};

const globalForDb = globalThis as GlobalWithDb;

function resolveSqlitePath(url?: string) {
  if (!url) return "sqlite.db";
  if (url.startsWith("file:")) return url.replace("file:", "");
  return url;
}

function ensureSqliteDirExists(filePath: string) {
  if (!filePath) return;
  if (filePath === ":memory:") return;

  const dir = path.dirname(filePath);
  if (!dir || dir === ".") return;

  mkdirSync(dir, { recursive: true });
}

const sqlitePath = resolveSqlitePath(process.env.DATABASE_URL);
ensureSqliteDirExists(sqlitePath);

const sqlite = globalForDb.sqlite || new Database(sqlitePath);
const db = globalForDb.db || drizzle(sqlite, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.sqlite = sqlite;
  globalForDb.db = db;
}

export { db, schema };
export default db;
