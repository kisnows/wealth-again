-- FixCityArchitecture Migration
-- 修复城市架构问题：城市只与社保公积金计算相关，其他收入项目与城市无关

-- 第一步：添加User表的currentCity字段
ALTER TABLE "User" ADD COLUMN "currentCity" TEXT NOT NULL DEFAULT 'Hangzhou';

-- 第二步：创建UserCityHistory表
CREATE TABLE "UserCityHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserCityHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 第三步：为UserCityHistory表创建索引
CREATE INDEX "UserCityHistory_userId_effectiveFrom_idx" ON "UserCityHistory"("userId", "effectiveFrom");
CREATE INDEX "UserCityHistory_userId_effectiveFrom_effectiveTo_idx" ON "UserCityHistory"("userId", "effectiveFrom", "effectiveTo");

-- 第四步：将现有数据迁移到新架构
-- 4.1 从现有的IncomeChange记录中提取用户的城市信息并初始化UserCityHistory
INSERT INTO "UserCityHistory" ("id", "userId", "city", "effectiveFrom", "note", "createdAt")
SELECT 
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || 'a' || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) as id,
    "userId",
    "city",
    "effectiveFrom",
    '从收入变更记录迁移的城市信息' as note,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "userId", "city", MIN("effectiveFrom") as "effectiveFrom"
    FROM "IncomeChange"
    GROUP BY "userId", "city"
    ORDER BY "userId", "effectiveFrom"
);

-- 4.2 更新User表的currentCity字段为用户最新的城市
UPDATE "User" 
SET "currentCity" = (
    SELECT "city" 
    FROM "IncomeChange" 
    WHERE "IncomeChange"."userId" = "User"."id" 
    ORDER BY "effectiveFrom" DESC 
    LIMIT 1
)
WHERE "id" IN (SELECT DISTINCT "userId" FROM "IncomeChange");

-- 第五步：删除旧的city字段（按依赖关系顺序）
-- 创建临时表并复制数据，然后重命名

-- 5.1 处理IncomeRecord表
CREATE TABLE "IncomeRecord_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IncomeRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "IncomeRecord_new" 
SELECT "id", "userId", "year", "month", "gross", "bonus", "socialInsuranceBase", 
       "housingFundBase", "socialInsurance", "housingFund", "specialDeductions", 
       "otherDeductions", "charityDonations", "taxableIncome", "incomeTax", 
       "netIncome", "overrides", "createdAt", "updatedAt"
FROM "IncomeRecord";

DROP TABLE "IncomeRecord";
ALTER TABLE "IncomeRecord_new" RENAME TO "IncomeRecord";

-- 重建索引
CREATE UNIQUE INDEX "IncomeRecord_userId_year_month_key" ON "IncomeRecord"("userId", "year", "month");
CREATE INDEX "IncomeRecord_userId_year_idx" ON "IncomeRecord"("userId", "year");

-- 5.2 处理IncomeChange表
CREATE TABLE "IncomeChange_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "grossMonthly" DECIMAL NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncomeChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "IncomeChange_new" 
SELECT "id", "userId", "grossMonthly", "effectiveFrom", "currency", "createdAt"
FROM "IncomeChange";

DROP TABLE "IncomeChange";
ALTER TABLE "IncomeChange_new" RENAME TO "IncomeChange";

-- 重建索引
CREATE INDEX "IncomeChange_userId_effectiveFrom_idx" ON "IncomeChange"("userId", "effectiveFrom");

-- 5.3 处理BonusPlan表
CREATE TABLE "BonusPlan_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BonusPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "BonusPlan_new" 
SELECT "id", "userId", "amount", "effectiveDate", "currency", "createdAt"
FROM "BonusPlan";

DROP TABLE "BonusPlan";
ALTER TABLE "BonusPlan_new" RENAME TO "BonusPlan";

-- 重建索引
CREATE INDEX "BonusPlan_userId_effectiveDate_idx" ON "BonusPlan"("userId", "effectiveDate");

-- 5.4 处理LongTermCash表
CREATE TABLE "LongTermCash_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "totalAmount" DECIMAL NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "LongTermCash_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "LongTermCash_new" 
SELECT "id", "userId", "totalAmount", "effectiveDate", "currency", "createdAt", "completedAt"
FROM "LongTermCash";

DROP TABLE "LongTermCash";
ALTER TABLE "LongTermCash_new" RENAME TO "LongTermCash";

-- 重建索引
CREATE INDEX "LongTermCash_userId_effectiveDate_idx" ON "LongTermCash"("userId", "effectiveDate");