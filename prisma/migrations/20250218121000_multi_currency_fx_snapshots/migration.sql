-- Generated via prisma migrate diff (2025-02-18)
-- Align schema with multi-currency & FX snapshot design

-- AlterTable
ALTER TABLE "User" ADD COLUMN "displayCurrency" TEXT;

-- CreateTable
CREATE TABLE "FxSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rate" DECIMAL NOT NULL,
    "capturedAt" DATETIME NOT NULL,
    "sourceRateId" TEXT,
    "effectiveFrom" DATETIME,
    "effectiveTo" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "FxSnapshot_sourceRateId_fkey" FOREIGN KEY ("sourceRateId") REFERENCES "FxRate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CityRuleHF" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cityId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "baseMin" DECIMAL NOT NULL,
    "baseMax" DECIMAL NOT NULL,
    "rateEmployee" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CityRuleHF_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CityRuleHF" ("baseMax", "baseMin", "cityId", "createdAt", "endDate", "id", "rateEmployee", "startDate") SELECT "baseMax", "baseMin", "cityId", "createdAt", "endDate", "id", "rateEmployee", "startDate" FROM "CityRuleHF";
DROP TABLE "CityRuleHF";
ALTER TABLE "new_CityRuleHF" RENAME TO "CityRuleHF";
CREATE INDEX "CityRuleHF_cityId_startDate_idx" ON "CityRuleHF"("cityId", "startDate");
CREATE UNIQUE INDEX "CityRuleHF_cityId_startDate_key" ON "CityRuleHF"("cityId", "startDate");
CREATE TABLE "new_CityRuleSS" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cityId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "baseMin" DECIMAL NOT NULL,
    "baseMax" DECIMAL NOT NULL,
    "ratePension" DECIMAL NOT NULL,
    "rateMedical" DECIMAL NOT NULL,
    "rateUnemployment" DECIMAL NOT NULL,
    "fixedMedicalPersonal" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CityRuleSS_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CityRuleSS" ("baseMax", "baseMin", "cityId", "createdAt", "endDate", "fixedMedicalPersonal", "id", "rateMedical", "ratePension", "rateUnemployment", "startDate") SELECT "baseMax", "baseMin", "cityId", "createdAt", "endDate", "fixedMedicalPersonal", "id", "rateMedical", "ratePension", "rateUnemployment", "startDate" FROM "CityRuleSS";
DROP TABLE "CityRuleSS";
ALTER TABLE "new_CityRuleSS" RENAME TO "CityRuleSS";
CREATE INDEX "CityRuleSS_cityId_startDate_idx" ON "CityRuleSS"("cityId", "startDate");
CREATE UNIQUE INDEX "CityRuleSS_cityId_startDate_key" ON "CityRuleSS"("cityId", "startDate");
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
INSERT INTO "new_IncomeRecord" ("bonus", "charityDonations", "cityId", "createdAt", "currency", "equityIncome", "fxRateId", "gross", "housingFund", "housingFundBase", "id", "incomeTax", "isForecast", "ltcIncome", "manualGross", "manualIncomeTax", "manualNet", "manualNote", "manualTaxable", "monthDate", "netIncome", "otherDeductions", "socialInsurance", "socialInsuranceBase", "source", "sourceCurrency", "specialDeductions", "taxCumulative", "taxPaidCumulative", "taxableCumulative", "taxableCurrent", "updatedAt") SELECT "bonus", "charityDonations", "cityId", "createdAt", "currency", "equityIncome", "fxRateId", "gross", "housingFund", "housingFundBase", "id", "incomeTax", "isForecast", "ltcIncome", "manualGross", "manualIncomeTax", "manualNet", "manualNote", "manualTaxable", "monthDate", "netIncome", "otherDeductions", "socialInsurance", "socialInsuranceBase", "source", "sourceCurrency", "specialDeductions", "taxCumulative", "taxPaidCumulative", "taxableCumulative", "taxableCurrent", "updatedAt" FROM "IncomeRecord";
DROP TABLE "IncomeRecord";
ALTER TABLE "new_IncomeRecord" RENAME TO "IncomeRecord";
CREATE UNIQUE INDEX "IncomeRecord_userId_monthDate_key" ON "IncomeRecord"("userId", "monthDate");
CREATE INDEX "IncomeRecord_userId_monthDate_idx" ON "IncomeRecord"("userId", "monthDate");
CREATE INDEX "IncomeRecord_fxSnapshotId_idx" ON "IncomeRecord"("fxSnapshotId");
CREATE TABLE "new_TaxBracket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "country" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" DATETIME,
    "position" INTEGER NOT NULL,
    "threshold" DECIMAL NOT NULL,
    "taxRate" DECIMAL NOT NULL,
    "quickDeduction" DECIMAL NOT NULL,
    CONSTRAINT "TaxBracket_country_taxYear_fkey" FOREIGN KEY ("country", "taxYear") REFERENCES "TaxConfig" ("country", "taxYear") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TaxBracket" ("country", "id", "position", "quickDeduction", "taxRate", "taxYear", "threshold") SELECT "country", "id", "position", "quickDeduction", "taxRate", "taxYear", "threshold" FROM "TaxBracket";
DROP TABLE "TaxBracket";
ALTER TABLE "new_TaxBracket" RENAME TO "TaxBracket";
CREATE UNIQUE INDEX "TaxBracket_country_taxYear_position_key" ON "TaxBracket"("country", "taxYear", "position");
CREATE TABLE "new_TaxConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "country" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" DATETIME,
    "standardDeduction" DECIMAL NOT NULL,
    "specialAdditionalDeduction" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_TaxConfig" ("country", "createdAt", "id", "specialAdditionalDeduction", "standardDeduction", "taxYear") SELECT "country", "createdAt", "id", "specialAdditionalDeduction", "standardDeduction", "taxYear" FROM "TaxConfig";
DROP TABLE "TaxConfig";
ALTER TABLE "new_TaxConfig" RENAME TO "TaxConfig";
CREATE UNIQUE INDEX "TaxConfig_country_taxYear_key" ON "TaxConfig"("country", "taxYear");
CREATE TABLE "new_TxnEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "fxRateId" TEXT,
    "fxSnapshotId" TEXT,
    "fxAppliedRate" DECIMAL NOT NULL DEFAULT 1,
    "note" TEXT,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TxnEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TxnEntry_fxRateId_fkey" FOREIGN KEY ("fxRateId") REFERENCES "FxRate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TxnEntry_fxSnapshotId_fkey" FOREIGN KEY ("fxSnapshotId") REFERENCES "FxSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TxnEntry" ("createdAt", "fxRateId", "id", "meta", "note", "occurredAt", "type", "userId") SELECT "createdAt", "fxRateId", "id", "meta", "note", "occurredAt", "type", "userId" FROM "TxnEntry";
DROP TABLE "TxnEntry";
ALTER TABLE "new_TxnEntry" RENAME TO "TxnEntry";
CREATE INDEX "TxnEntry_userId_occurredAt_idx" ON "TxnEntry"("userId", "occurredAt");
CREATE INDEX "TxnEntry_fxSnapshotId_idx" ON "TxnEntry"("fxSnapshotId");
CREATE TABLE "new_TxnLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "counterpartyAccountId" TEXT,
    "counterpartyName" TEXT,
    "exchangeRateAB" DECIMAL,
    "viaCurrency" TEXT DEFAULT 'USD',
    "rateAtoUSD" DECIMAL,
    "rateUSDtoB" DECIMAL,
    "fxSnapshotId" TEXT,
    "fxAppliedRate" DECIMAL NOT NULL DEFAULT 1,
    "fxEffectiveAt" DATETIME,
    "principalDelta" DECIMAL NOT NULL DEFAULT 0,
    "valuationDelta" DECIMAL NOT NULL DEFAULT 0,
    "attachmentUrl" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TxnLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TxnEntry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TxnLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TxnLine_counterpartyAccountId_fkey" FOREIGN KEY ("counterpartyAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TxnLine_fxSnapshotId_fkey" FOREIGN KEY ("fxSnapshotId") REFERENCES "FxSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TxnLine" ("accountId", "amount", "attachmentUrl", "counterpartyAccountId", "counterpartyName", "createdAt", "currency", "entryId", "exchangeRateAB", "fxEffectiveAt", "id", "note", "principalDelta", "rateAtoUSD", "rateUSDtoB", "type", "updatedAt", "valuationDelta", "viaCurrency") SELECT "accountId", "amount", "attachmentUrl", "counterpartyAccountId", "counterpartyName", "createdAt", "currency", "entryId", "exchangeRateAB", "fxEffectiveAt", "id", "note", "principalDelta", "rateAtoUSD", "rateUSDtoB", "type", "updatedAt", "valuationDelta", "viaCurrency" FROM "TxnLine";
DROP TABLE "TxnLine";
ALTER TABLE "new_TxnLine" RENAME TO "TxnLine";
CREATE INDEX "TxnLine_accountId_createdAt_idx" ON "TxnLine"("accountId", "createdAt");
CREATE INDEX "TxnLine_entryId_type_idx" ON "TxnLine"("entryId", "type");
CREATE INDEX "TxnLine_counterpartyAccountId_idx" ON "TxnLine"("counterpartyAccountId");
CREATE INDEX "TxnLine_fxSnapshotId_idx" ON "TxnLine"("fxSnapshotId");
CREATE TABLE "new_ValuationSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "asOf" DATETIME NOT NULL,
    "totalValue" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "fxRateId" TEXT,
    "fxSnapshotId" TEXT,
    "fxAppliedRate" DECIMAL NOT NULL DEFAULT 1,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValuationSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ValuationSnapshot_fxRateId_fkey" FOREIGN KEY ("fxRateId") REFERENCES "FxRate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ValuationSnapshot_fxSnapshotId_fkey" FOREIGN KEY ("fxSnapshotId") REFERENCES "FxSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ValuationSnapshot" ("accountId", "asOf", "createdAt", "currency", "fxRateId", "id", "note", "totalValue") SELECT "accountId", "asOf", "createdAt", "currency", "fxRateId", "id", "note", "totalValue" FROM "ValuationSnapshot";
DROP TABLE "ValuationSnapshot";
ALTER TABLE "new_ValuationSnapshot" RENAME TO "ValuationSnapshot";
CREATE UNIQUE INDEX "ValuationSnapshot_accountId_asOf_key" ON "ValuationSnapshot"("accountId", "asOf");
CREATE INDEX "ValuationSnapshot_fxSnapshotId_idx" ON "ValuationSnapshot"("fxSnapshotId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "FxSnapshot_baseCurrency_quoteCurrency_capturedAt_idx" ON "FxSnapshot"("baseCurrency", "quoteCurrency", "capturedAt");

-- CreateIndex
CREATE INDEX "FxSnapshot_sourceRateId_idx" ON "FxSnapshot"("sourceRateId");

-- CreateIndex
CREATE UNIQUE INDEX "FxSnapshot_baseCurrency_quoteCurrency_sourceRateId_capturedAt_key" ON "FxSnapshot"("baseCurrency", "quoteCurrency", "sourceRateId", "capturedAt");
