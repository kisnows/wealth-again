-- Add manual override columns to IncomeRecord
ALTER TABLE "IncomeRecord" ADD COLUMN "manualGross" DECIMAL;
ALTER TABLE "IncomeRecord" ADD COLUMN "manualTaxable" DECIMAL;
ALTER TABLE "IncomeRecord" ADD COLUMN "manualIncomeTax" DECIMAL;
ALTER TABLE "IncomeRecord" ADD COLUMN "manualNet" DECIMAL;
ALTER TABLE "IncomeRecord" ADD COLUMN "manualNote" TEXT;

-- Add reconciled fields
ALTER TABLE "IncomeRecord" ADD COLUMN "taxableCurrent" DECIMAL;
ALTER TABLE "IncomeRecord" ADD COLUMN "taxPaidCumulative" DECIMAL DEFAULT 0;
ALTER TABLE "IncomeRecord" ADD COLUMN "source" TEXT DEFAULT 'system';

-- Backfill new fields from legacy columns where possible
UPDATE "IncomeRecord"
SET
  "taxableCurrent" = COALESCE("taxableIncome", 0),
  "taxPaidCumulative" = COALESCE("taxPaid", 0),
  "source" = 'system'
WHERE "taxableCurrent" IS NULL;

-- Create income recalc task table
CREATE TABLE "IncomeRecalcTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "taxYear" INTEGER NOT NULL,
    "startMonth" INTEGER NOT NULL DEFAULT 1,
    "endMonth" INTEGER NOT NULL DEFAULT 12,
    "cityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledFor" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "triggeredBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "processedAt" DATETIME,
    CONSTRAINT "IncomeRecalcTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "IncomeRecalcTask_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "IncomeRecalcTask_status_scheduledFor_idx" ON "IncomeRecalcTask"("status", "scheduledFor");
CREATE INDEX "IncomeRecalcTask_userId_taxYear_status_idx" ON "IncomeRecalcTask"("userId", "taxYear", "status");

