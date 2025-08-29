-- CreateTable
CREATE TABLE "CityChangeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "toCityId" TEXT NOT NULL,
    "changeDate" DATETIME NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CityChangeRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CityChangeRecord_toCityId_fkey" FOREIGN KEY ("toCityId") REFERENCES "City" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CityChangeRecord_userId_changeDate_idx" ON "CityChangeRecord"("userId", "changeDate");

-- CreateIndex
CREATE INDEX "CityChangeRecord_toCityId_idx" ON "CityChangeRecord"("toCityId");
