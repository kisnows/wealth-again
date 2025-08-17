/*
  Warnings:

  - You are about to drop the `AuditLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BackupRecord` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Instrument` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Lot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Price` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SystemSetting` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserPreference` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `cashAmount` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `fee` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `instrumentId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `lotId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `tax` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `breakdown` on the `ValuationSnapshot` table. All the data in the column will be lost.
  - Added the required column `amount` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "AuditLog_createdAt_idx";

-- DropIndex
DROP INDEX "AuditLog_resource_resourceId_idx";

-- DropIndex
DROP INDEX "AuditLog_userId_idx";

-- DropIndex
DROP INDEX "BackupRecord_createdAt_idx";

-- DropIndex
DROP INDEX "BackupRecord_status_idx";

-- DropIndex
DROP INDEX "BackupRecord_userId_idx";

-- DropIndex
DROP INDEX "Instrument_symbol_idx";

-- DropIndex
DROP INDEX "Notification_createdAt_idx";

-- DropIndex
DROP INDEX "Notification_userId_isRead_idx";

-- DropIndex
DROP INDEX "Price_instrumentId_asOf_key";

-- DropIndex
DROP INDEX "Session_token_idx";

-- DropIndex
DROP INDEX "Session_userId_idx";

-- DropIndex
DROP INDEX "Session_token_key";

-- DropIndex
DROP INDEX "SystemSetting_category_idx";

-- DropIndex
DROP INDEX "SystemSetting_key_key";

-- DropIndex
DROP INDEX "UserPreference_userId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AuditLog";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "BackupRecord";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Instrument";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Lot";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Notification";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Price";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Session";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SystemSetting";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "UserPreference";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'CNY',
    "initialBalance" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Account" ("baseCurrency", "createdAt", "id", "name", "userId") SELECT "baseCurrency", "createdAt", "id", "name", "userId" FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
CREATE UNIQUE INDEX "Account_userId_name_key" ON "Account"("userId", "name");
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tradeDate" DATETIME NOT NULL,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("accountId", "createdAt", "currency", "id", "note", "tradeDate", "type") SELECT "accountId", "createdAt", "currency", "id", "note", "tradeDate", "type" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_accountId_tradeDate_idx" ON "Transaction"("accountId", "tradeDate");
CREATE TABLE "new_ValuationSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "asOf" DATETIME NOT NULL,
    "totalValue" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValuationSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ValuationSnapshot" ("accountId", "asOf", "createdAt", "id", "totalValue") SELECT "accountId", "asOf", "createdAt", "id", "totalValue" FROM "ValuationSnapshot";
DROP TABLE "ValuationSnapshot";
ALTER TABLE "new_ValuationSnapshot" RENAME TO "ValuationSnapshot";
CREATE UNIQUE INDEX "ValuationSnapshot_accountId_asOf_key" ON "ValuationSnapshot"("accountId", "asOf");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
