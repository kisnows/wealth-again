-- CreateTable
CREATE TABLE "UserAnnualDeduction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "annualAmount" DECIMAL NOT NULL DEFAULT 0,
    "allocationRule" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserAnnualDeduction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserAnnualDeduction_userId_taxYear_idx" ON "UserAnnualDeduction"("userId", "taxYear");

-- CreateIndex
CREATE UNIQUE INDEX "UserAnnualDeduction_userId_taxYear_key" ON "UserAnnualDeduction"("userId", "taxYear");
