PRAGMA foreign_keys=OFF;

CREATE TABLE "new_CityChangeRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "fromCityId" TEXT,
  "toCityId" TEXT NOT NULL,
  "effectiveMonth" DATETIME NOT NULL,
  "reason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "new_CityChangeRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "new_CityChangeRecord_fromCityId_fkey" FOREIGN KEY ("fromCityId") REFERENCES "City" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "new_CityChangeRecord_toCityId_fkey" FOREIGN KEY ("toCityId") REFERENCES "City" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_CityChangeRecord" (
  "id",
  "userId",
  "fromCityId",
  "toCityId",
  "effectiveMonth",
  "reason",
  "createdAt"
)
SELECT
  "id",
  "userId",
  NULL,
  "toCityId",
  "changeDate",
  "reason",
  "createdAt"
FROM "CityChangeRecord";

DROP TABLE "CityChangeRecord";

ALTER TABLE "new_CityChangeRecord" RENAME TO "CityChangeRecord";

CREATE INDEX "CityChangeRecord_userId_effectiveMonth_idx" ON "CityChangeRecord"("userId", "effectiveMonth");
CREATE INDEX "CityChangeRecord_toCityId_idx" ON "CityChangeRecord"("toCityId");
CREATE INDEX "CityChangeRecord_fromCityId_idx" ON "CityChangeRecord"("fromCityId");

PRAGMA foreign_keys=ON;
