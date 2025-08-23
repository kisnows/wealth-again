-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BonusPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BonusPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BonusPlan" ("amount", "city", "createdAt", "effectiveDate", "id", "userId") SELECT "amount", "city", "createdAt", "effectiveDate", "id", "userId" FROM "BonusPlan";
DROP TABLE "BonusPlan";
ALTER TABLE "new_BonusPlan" RENAME TO "BonusPlan";
CREATE INDEX "BonusPlan_userId_effectiveDate_idx" ON "BonusPlan"("userId", "effectiveDate");
CREATE TABLE "new_IncomeChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "grossMonthly" DECIMAL NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncomeChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_IncomeChange" ("city", "createdAt", "effectiveFrom", "grossMonthly", "id", "userId") SELECT "city", "createdAt", "effectiveFrom", "grossMonthly", "id", "userId" FROM "IncomeChange";
DROP TABLE "IncomeChange";
ALTER TABLE "new_IncomeChange" RENAME TO "IncomeChange";
CREATE INDEX "IncomeChange_userId_effectiveFrom_idx" ON "IncomeChange"("userId", "effectiveFrom");
CREATE TABLE "new_LongTermCash" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "totalAmount" DECIMAL NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "LongTermCash_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_LongTermCash" ("city", "completedAt", "createdAt", "effectiveDate", "id", "totalAmount", "userId") SELECT "city", "completedAt", "createdAt", "effectiveDate", "id", "totalAmount", "userId" FROM "LongTermCash";
DROP TABLE "LongTermCash";
ALTER TABLE "new_LongTermCash" RENAME TO "LongTermCash";
CREATE INDEX "LongTermCash_userId_effectiveDate_idx" ON "LongTermCash"("userId", "effectiveDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
