/*
  Warnings:

  - Added the required column `updatedAt` to the `IncomeRecord` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Config_key_idx";

-- CreateTable
CREATE TABLE "TaxBracket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "city" TEXT NOT NULL,
    "minIncome" DECIMAL NOT NULL,
    "maxIncome" DECIMAL,
    "taxRate" DECIMAL NOT NULL,
    "quickDeduction" DECIMAL NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SocialInsuranceConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "city" TEXT NOT NULL,
    "socialMinBase" DECIMAL NOT NULL,
    "socialMaxBase" DECIMAL NOT NULL,
    "pensionRate" DECIMAL NOT NULL,
    "medicalRate" DECIMAL NOT NULL,
    "unemploymentRate" DECIMAL NOT NULL,
    "housingFundMinBase" DECIMAL NOT NULL,
    "housingFundMaxBase" DECIMAL NOT NULL,
    "housingFundRate" DECIMAL NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_IncomeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "gross" DECIMAL NOT NULL,
    "bonus" DECIMAL DEFAULT 0,
    "socialInsuranceBase" DECIMAL,
    "housingFundBase" DECIMAL,
    "socialInsurance" DECIMAL DEFAULT 0,
    "housingFund" DECIMAL DEFAULT 0,
    "specialDeductions" DECIMAL DEFAULT 0,
    "otherDeductions" DECIMAL DEFAULT 0,
    "charityDonations" DECIMAL DEFAULT 0,
    "taxableIncome" DECIMAL,
    "incomeTax" DECIMAL,
    "netIncome" DECIMAL,
    "overrides" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncomeRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_IncomeRecord" ("bonus", "city", "createdAt", "gross", "id", "month", "overrides", "userId", "year") SELECT "bonus", "city", "createdAt", "gross", "id", "month", "overrides", "userId", "year" FROM "IncomeRecord";
DROP TABLE "IncomeRecord";
ALTER TABLE "new_IncomeRecord" RENAME TO "IncomeRecord";
CREATE INDEX "IncomeRecord_userId_year_idx" ON "IncomeRecord"("userId", "year");
CREATE UNIQUE INDEX "IncomeRecord_userId_year_month_key" ON "IncomeRecord"("userId", "year", "month");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TaxBracket_city_effectiveFrom_idx" ON "TaxBracket"("city", "effectiveFrom");

-- CreateIndex
CREATE INDEX "TaxBracket_city_effectiveFrom_effectiveTo_idx" ON "TaxBracket"("city", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "SocialInsuranceConfig_city_effectiveFrom_effectiveTo_idx" ON "SocialInsuranceConfig"("city", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "SocialInsuranceConfig_city_effectiveFrom_key" ON "SocialInsuranceConfig"("city", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Config_key_effectiveFrom_idx" ON "Config"("key", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Config_key_effectiveFrom_effectiveTo_idx" ON "Config"("key", "effectiveFrom", "effectiveTo");
