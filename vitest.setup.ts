// Global test setup for Vitest
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env", quiet: true });

// Default DATABASE_URL fallback for local sqlite if absent
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./prisma/dev.db";
}
