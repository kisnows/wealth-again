-- CreateTable
CREATE TABLE "FxRateUpdateTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledFor" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "triggeredBy" TEXT,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "FxRateUpdateTask_status_scheduledFor_idx" ON "FxRateUpdateTask"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "FxRateUpdateTask_base_quote_startDate_idx" ON "FxRateUpdateTask"("base", "quote", "startDate");

-- CreateIndex
CREATE INDEX "FxRateUpdateTask_quote_status_scheduledFor_idx" ON "FxRateUpdateTask"("quote", "status", "scheduledFor");
