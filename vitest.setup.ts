// Global test setup for Vitest
import { config as loadEnv } from "dotenv";
import { vi } from "vitest";
import { dbMock } from "@/tests/helpers/dbMock";

loadEnv({ path: ".env", quiet: true });

// Default DATABASE_URL fallback for local sqlite if absent
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./data/dev.db";
}

vi.mock("@/server/db", () => ({
  db: dbMock,
  schema: {},
  default: dbMock,
}));
