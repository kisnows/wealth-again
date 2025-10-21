-- Align FxRate and TxnLine tables with new schema requirements
PRAGMA foreign_keys=OFF;

-- Recreate FxRate table with effective range columns
CREATE TABLE "_FxRate_new" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "base" TEXT NOT NULL,
  "quote" TEXT NOT NULL,
  "rate" DECIMAL NOT NULL,
  "effectiveFrom" DATETIME NOT NULL,
  "effectiveTo" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

INSERT INTO "_FxRate_new" ("id", "base", "quote", "rate", "effectiveFrom", "effectiveTo", "createdAt", "updatedAt")
SELECT "id", "base", "quote", "rate", "asOf" AS "effectiveFrom", NULL AS "effectiveTo", "createdAt", "createdAt" AS "updatedAt"
FROM "FxRate";

DROP TABLE "FxRate";
ALTER TABLE "_FxRate_new" RENAME TO "FxRate";

CREATE INDEX "FxRate_base_quote_effectiveFrom_idx" ON "FxRate"("base", "quote", "effectiveFrom");
CREATE INDEX "FxRate_base_quote_effectiveTo_idx" ON "FxRate"("base", "quote", "effectiveTo");
CREATE UNIQUE INDEX "FxRate_base_quote_effectiveFrom_key" ON "FxRate"("base", "quote", "effectiveFrom");

-- Recreate TxnLine table with enriched metadata columns
CREATE TABLE "_TxnLine_new" (
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
  "fxEffectiveAt" DATETIME,
  "principalDelta" DECIMAL NOT NULL DEFAULT 0,
  "valuationDelta" DECIMAL NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "_TxnLine_new_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TxnEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "_TxnLine_new_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "_TxnLine_new_counterpartyAccountId_fkey" FOREIGN KEY ("counterpartyAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "_TxnLine_new" (
  "id", "entryId", "accountId", "type", "amount", "currency", "counterpartyAccountId", "counterpartyName",
  "exchangeRateAB", "viaCurrency", "rateAtoUSD", "rateUSDtoB", "fxEffectiveAt", "principalDelta", "valuationDelta",
  "note", "createdAt", "updatedAt"
)
SELECT
  old."id",
  old."entryId",
  old."accountId",
  COALESCE((SELECT "type" FROM "TxnEntry" e WHERE e."id" = old."entryId"), 'ADJUSTMENT') AS "type",
  old."amount",
  old."currency",
  NULL AS "counterpartyAccountId",
  NULL AS "counterpartyName",
  NULL AS "exchangeRateAB",
  'USD' AS "viaCurrency",
  NULL AS "rateAtoUSD",
  NULL AS "rateUSDtoB",
  NULL AS "fxEffectiveAt",
  old."amount" AS "principalDelta",
  old."amount" AS "valuationDelta",
  old."note",
  old."createdAt",
  old."createdAt" AS "updatedAt"
FROM "TxnLine" old;

DROP TABLE "TxnLine";
ALTER TABLE "_TxnLine_new" RENAME TO "TxnLine";

CREATE INDEX "TxnLine_accountId_createdAt_idx" ON "TxnLine"("accountId", "createdAt");
CREATE INDEX "TxnLine_entryId_type_idx" ON "TxnLine"("entryId", "type");
CREATE INDEX "TxnLine_counterpartyAccountId_idx" ON "TxnLine"("counterpartyAccountId");

PRAGMA foreign_keys=ON;
