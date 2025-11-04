CREATE TABLE "FxRateUpdateLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "weekEnd" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rate" DECIMAL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FxRateUpdateLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "FxRateUpdateTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FxRateUpdateLog_taskId_weekStart_key" ON "FxRateUpdateLog"("taskId", "weekStart");

CREATE INDEX "FxRateUpdateLog_taskId_status_idx" ON "FxRateUpdateLog"("taskId", "status");
