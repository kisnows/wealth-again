/*
  Warnings:

  - You are about to alter the column `payload` on the `EventOutbox` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("json")` to `Json`.
  - You are about to alter the column `payload` on the `ReportDataset` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("json")` to `Json`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EventOutbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_EventOutbox" ("attempts", "availableAt", "createdAt", "eventType", "id", "lastError", "occurredAt", "payload", "processedAt", "status", "updatedAt") SELECT "attempts", "availableAt", "createdAt", "eventType", "id", "lastError", "occurredAt", "payload", "processedAt", "status", "updatedAt" FROM "EventOutbox";
DROP TABLE "EventOutbox";
ALTER TABLE "new_EventOutbox" RENAME TO "EventOutbox";
CREATE INDEX "EventOutbox_status_availableAt_idx" ON "EventOutbox"("status", "availableAt");
CREATE INDEX "EventOutbox_eventType_status_idx" ON "EventOutbox"("eventType", "status");
CREATE TABLE "new_ReportDataset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "bucket" TEXT NOT NULL DEFAULT 'default',
    "payload" JSONB NOT NULL,
    "occurredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReportDataset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReportDataset" ("bucket", "createdAt", "id", "occurredAt", "payload", "scope", "updatedAt", "userId") SELECT "bucket", "createdAt", "id", "occurredAt", "payload", "scope", "updatedAt", "userId" FROM "ReportDataset";
DROP TABLE "ReportDataset";
ALTER TABLE "new_ReportDataset" RENAME TO "ReportDataset";
CREATE INDEX "ReportDataset_scope_bucket_idx" ON "ReportDataset"("scope", "bucket");
CREATE INDEX "ReportDataset_userId_scope_idx" ON "ReportDataset"("userId", "scope");
CREATE UNIQUE INDEX "ReportDataset_userId_scope_bucket_key" ON "ReportDataset"("userId", "scope", "bucket");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
