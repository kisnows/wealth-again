/*
  Warnings:

  - You are about to drop the column `taxPaid` on the `IncomeRecord` table. All the data in the column will be lost.
  - You are about to drop the column `taxableIncome` on the `IncomeRecord` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_IncomeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "monthDate" DATETIME NOT NULL,
    "cityId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "sourceCurrency" TEXT,
    "fxRateId" TEXT,
    "fxSnapshotId" TEXT,
    "fxAppliedRate" DECIMAL NOT NULL DEFAULT 1,
    "gross" DECIMAL NOT NULL,
    "bonus" DECIMAL DEFAULT 0,
    "ltcIncome" DECIMAL DEFAULT 0,
    "equityIncome" DECIMAL DEFAULT 0,
    "socialInsuranceBase" DECIMAL,
    "housingFundBase" DECIMAL,
    "socialInsurance" DECIMAL DEFAULT 0,
    "housingFund" DECIMAL DEFAULT 0,
    "specialDeductions" DECIMAL DEFAULT 0,
    "otherDeductions" DECIMAL DEFAULT 0,
    "charityDonations" DECIMAL DEFAULT 0,
    "manualGross" DECIMAL,
    "manualTaxable" DECIMAL,
    "manualIncomeTax" DECIMAL,
    "manualNet" DECIMAL,
    "manualNote" TEXT,
    "taxableCurrent" DECIMAL,
    "incomeTax" DECIMAL,
    "taxPaidCumulative" DECIMAL DEFAULT 0,
    "taxableCumulative" DECIMAL,
    "taxCumulative" DECIMAL,
    "netIncome" DECIMAL,
    "source" TEXT NOT NULL DEFAULT 'system',
    "isForecast" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IncomeRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IncomeRecord_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "IncomeRecord_fxRateId_fkey" FOREIGN KEY ("fxRateId") REFERENCES "FxRate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "IncomeRecord_fxSnapshotId_fkey" FOREIGN KEY ("fxSnapshotId") REFERENCES "FxSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_IncomeRecord" ("bonus", "charityDonations", "cityId", "createdAt", "currency", "equityIncome", "fxRateId", "fxSnapshotId", "fxAppliedRate", "gross", "housingFund", "housingFundBase", "id", "incomeTax", "isForecast", "ltcIncome", "manualGross", "manualIncomeTax", "manualNet", "manualNote", "manualTaxable", "monthDate", "netIncome", "otherDeductions", "socialInsurance", "socialInsuranceBase", "source", "sourceCurrency", "specialDeductions", "taxCumulative", "taxPaidCumulative", "taxableCumulative", "taxableCurrent", "updatedAt", "userId") SELECT "bonus", "charityDonations", "cityId", "createdAt", "currency", "equityIncome", "fxRateId", "fxSnapshotId", coalesce("fxAppliedRate", 1) AS "fxAppliedRate", "gross", "housingFund", "housingFundBase", "id", "incomeTax", "isForecast", "ltcIncome", "manualGross", "manualIncomeTax", "manualNet", "manualNote", "manualTaxable", "monthDate", "netIncome", "otherDeductions", "socialInsurance", "socialInsuranceBase", coalesce("source", 'system') AS "source", "sourceCurrency", "specialDeductions", "taxCumulative", "taxPaidCumulative", "taxableCumulative", "taxableCurrent", "updatedAt", "userId" FROM "IncomeRecord";
DROP TABLE "IncomeRecord";
ALTER TABLE "new_IncomeRecord" RENAME TO "IncomeRecord";
CREATE INDEX "IncomeRecord_userId_monthDate_idx" ON "IncomeRecord"("userId", "monthDate");
CREATE UNIQUE INDEX "IncomeRecord_userId_monthDate_key" ON "IncomeRecord"("userId", "monthDate");
CREATE INDEX "IncomeRecord_fxSnapshotId_idx" ON "IncomeRecord"("fxSnapshotId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
