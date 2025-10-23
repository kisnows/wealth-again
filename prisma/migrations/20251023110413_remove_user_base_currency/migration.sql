/*
  Warnings:

  - You are about to drop the column `baseCurrency` on the `User` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "displayCurrency" TEXT,
    "currentCityId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_currentCityId_fkey" FOREIGN KEY ("currentCityId") REFERENCES "City" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "currentCityId", "displayCurrency", "email", "id", "isActive", "name", "password", "updatedAt") SELECT "createdAt", "currentCityId", "displayCurrency", "email", "id", "isActive", "name", "password", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");
CREATE INDEX "User_currentCityId_idx" ON "User"("currentCityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
