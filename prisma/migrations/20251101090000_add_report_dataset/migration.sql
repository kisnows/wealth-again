-- CreateTable
CREATE TABLE "ReportDataset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "bucket" TEXT NOT NULL DEFAULT 'default',
    "payload" JSON NOT NULL,
    "occurredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReportDataset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportDataset_userId_scope_bucket_key" ON "ReportDataset"("userId", "scope", "bucket");

-- CreateIndex
CREATE INDEX "ReportDataset_scope_bucket_idx" ON "ReportDataset"("scope", "bucket");

-- CreateIndex
CREATE INDEX "ReportDataset_userId_scope_idx" ON "ReportDataset"("userId", "scope");
