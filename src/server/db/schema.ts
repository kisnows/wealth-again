import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { randomUUID } from "node:crypto";
import { dateTimeText, decimalText } from "@/server/db/columns";

export const users = sqliteTable(
  "User",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    email: text("email").notNull(),
    name: text("name").notNull().default(""),
    image: text("image"),
    emailVerified: integer("emailVerified", { mode: "boolean" })
      .notNull()
      .default(false),
    displayCurrency: text("displayCurrency"),
    currentCityId: text("currentCityId").notNull(),
    isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: dateTimeText("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    emailKey: uniqueIndex("User_email_key").on(table.email),
    emailIdx: index("User_email_idx").on(table.email),
    isActiveIdx: index("User_isActive_idx").on(table.isActive),
    currentCityIdx: index("User_currentCityId_idx").on(table.currentCityId),
  }),
);

export const authAccounts = sqliteTable(
  "AuthAccount",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    providerId: text("providerId").notNull(),
    accountId: text("accountId").notNull(),
    userId: text("userId").notNull(),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: dateTimeText("accessTokenExpiresAt"),
    refreshTokenExpiresAt: dateTimeText("refreshTokenExpiresAt"),
    scope: text("scope"),
    password: text("password"),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: dateTimeText("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    providerAccountKey: uniqueIndex("AuthAccount_providerId_accountId_key").on(
      table.providerId,
      table.accountId,
    ),
    userIdx: index("AuthAccount_userId_idx").on(table.userId),
  }),
);

export const authSessions = sqliteTable(
  "AuthSession",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("userId").notNull(),
    token: text("token").notNull(),
    expiresAt: dateTimeText("expiresAt").notNull(),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: dateTimeText("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
  },
  (table) => ({
    tokenKey: uniqueIndex("AuthSession_token_key").on(table.token),
    userIdx: index("AuthSession_userId_idx").on(table.userId),
  }),
);

export const authVerifications = sqliteTable("AuthVerification", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: dateTimeText("expiresAt").notNull(),
  createdAt: dateTimeText("createdAt")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: dateTimeText("updatedAt")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const cities = sqliteTable("City", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  country: text("country").notNull().default("CN"),
  createdAt: dateTimeText("createdAt")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const cityRuleSS = sqliteTable(
  "CityRuleSS",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    cityId: text("cityId").notNull(),
    effectiveFrom: dateTimeText("startDate").notNull(),
    effectiveTo: dateTimeText("endDate"),
    currency: text("currency").notNull().default("CNY"),
    baseMin: decimalText("baseMin").notNull(),
    baseMax: decimalText("baseMax").notNull(),
    ratePension: decimalText("ratePension").notNull(),
    rateMedical: decimalText("rateMedical").notNull(),
    rateUnemployment: decimalText("rateUnemployment").notNull(),
    fixedMedicalPersonal: decimalText("fixedMedicalPersonal"),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    uniqueKey: uniqueIndex("CityRuleSS_cityId_startDate_key").on(
      table.cityId,
      table.effectiveFrom,
    ),
    idx: index("CityRuleSS_cityId_startDate_idx").on(
      table.cityId,
      table.effectiveFrom,
    ),
  }),
);

export const cityRuleHF = sqliteTable(
  "CityRuleHF",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    cityId: text("cityId").notNull(),
    effectiveFrom: dateTimeText("startDate").notNull(),
    effectiveTo: dateTimeText("endDate"),
    currency: text("currency").notNull().default("CNY"),
    baseMin: decimalText("baseMin").notNull(),
    baseMax: decimalText("baseMax").notNull(),
    rateEmployee: decimalText("rateEmployee").notNull(),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    uniqueKey: uniqueIndex("CityRuleHF_cityId_startDate_key").on(
      table.cityId,
      table.effectiveFrom,
    ),
    idx: index("CityRuleHF_cityId_startDate_idx").on(
      table.cityId,
      table.effectiveFrom,
    ),
  }),
);

export const taxConfig = sqliteTable(
  "TaxConfig",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    country: text("country").notNull(),
    taxYear: integer("taxYear").notNull(),
    currency: text("currency").notNull().default("CNY"),
    effectiveFrom: dateTimeText("effectiveFrom")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    effectiveTo: dateTimeText("effectiveTo"),
    standardDeduction: decimalText("standardDeduction").notNull(),
    specialAdditionalDeduction: decimalText("specialAdditionalDeduction"),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    countryYearKey: uniqueIndex("TaxConfig_country_taxYear_key").on(
      table.country,
      table.taxYear,
    ),
  }),
);

export const taxBracket = sqliteTable(
  "TaxBracket",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    country: text("country").notNull(),
    taxYear: integer("taxYear").notNull(),
    currency: text("currency").notNull().default("CNY"),
    effectiveFrom: dateTimeText("effectiveFrom")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    effectiveTo: dateTimeText("effectiveTo"),
    position: integer("position").notNull(),
    threshold: decimalText("threshold").notNull(),
    taxRate: decimalText("taxRate").notNull(),
    quickDeduction: decimalText("quickDeduction").notNull(),
  },
  (table) => ({
    uniqueKey: uniqueIndex("TaxBracket_country_taxYear_position_key").on(
      table.country,
      table.taxYear,
      table.position,
    ),
  }),
);

export const accounts = sqliteTable(
  "Account",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("userId").notNull(),
    name: text("name").notNull(),
    accountType: text("accountType").notNull(),
    baseCurrency: text("baseCurrency").notNull(),
    initialBalance: decimalText("initialBalance").notNull().default("0"),
    subType: text("subType"),
    description: text("description"),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: dateTimeText("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdx: index("Account_userId_idx").on(table.userId),
  }),
);

export const fxRates = sqliteTable(
  "FxRate",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    base: text("base").notNull(),
    quote: text("quote").notNull(),
    rate: decimalText("rate").notNull(),
    effectiveFrom: dateTimeText("effectiveFrom").notNull(),
    effectiveTo: dateTimeText("effectiveTo"),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: dateTimeText("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    uniqueKey: uniqueIndex("FxRate_base_quote_effectiveFrom_key").on(
      table.base,
      table.quote,
      table.effectiveFrom,
    ),
    baseQuoteEffectiveFromIdx: index("FxRate_base_quote_effectiveFrom_idx").on(
      table.base,
      table.quote,
      table.effectiveFrom,
    ),
    baseQuoteEffectiveToIdx: index("FxRate_base_quote_effectiveTo_idx").on(
      table.base,
      table.quote,
      table.effectiveTo,
    ),
  }),
);

export const fxSnapshots = sqliteTable(
  "FxSnapshot",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    baseCurrency: text("baseCurrency").notNull(),
    quoteCurrency: text("quoteCurrency").notNull(),
    rate: decimalText("rate").notNull(),
    capturedAt: dateTimeText("capturedAt").notNull(),
    sourceRateId: text("sourceRateId"),
    effectiveFrom: dateTimeText("effectiveFrom"),
    effectiveTo: dateTimeText("effectiveTo"),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    createdBy: text("createdBy"),
  },
  (table) => ({
    uniqueKey: uniqueIndex(
      "FxSnapshot_baseCurrency_quoteCurrency_sourceRateId_capturedAt_key",
    ).on(table.baseCurrency, table.quoteCurrency, table.sourceRateId, table.capturedAt),
    baseQuoteCapturedAtIdx: index(
      "FxSnapshot_baseCurrency_quoteCurrency_capturedAt_idx",
    ).on(table.baseCurrency, table.quoteCurrency, table.capturedAt),
    sourceRateIdx: index("FxSnapshot_sourceRateId_idx").on(table.sourceRateId),
  }),
);

export const fxRateUpdateTasks = sqliteTable(
  "FxRateUpdateTask",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    base: text("base").notNull(),
    quote: text("quote").notNull(),
    startDate: dateTimeText("startDate").notNull(),
    endDate: dateTimeText("endDate").notNull(),
    status: text("status").notNull().default("PENDING"),
    scheduledFor: dateTimeText("scheduledFor")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("lastError"),
    triggeredBy: text("triggeredBy"),
    processedAt: dateTimeText("processedAt"),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: dateTimeText("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    statusScheduleIdx: index("FxRateUpdateTask_status_scheduledFor_idx").on(
      table.status,
      table.scheduledFor,
    ),
    baseQuoteStartIdx: index("FxRateUpdateTask_base_quote_startDate_idx").on(
      table.base,
      table.quote,
      table.startDate,
    ),
    quoteStatusScheduleIdx: index(
      "FxRateUpdateTask_quote_status_scheduledFor_idx",
    ).on(table.quote, table.status, table.scheduledFor),
  }),
);

export const fxRateUpdateLogs = sqliteTable(
  "FxRateUpdateLog",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    taskId: text("taskId").notNull(),
    weekStart: dateTimeText("weekStart").notNull(),
    weekEnd: dateTimeText("weekEnd").notNull(),
    status: text("status").notNull().default("PENDING"),
    rate: decimalText("rate"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("lastError"),
    startedAt: dateTimeText("startedAt"),
    completedAt: dateTimeText("completedAt"),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: dateTimeText("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    taskWeekKey: uniqueIndex("FxRateUpdateLog_taskId_weekStart_key").on(
      table.taskId,
      table.weekStart,
    ),
    taskStatusIdx: index("FxRateUpdateLog_taskId_status_idx").on(
      table.taskId,
      table.status,
    ),
  }),
);

export const txnEntries = sqliteTable(
  "TxnEntry",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("userId").notNull(),
    type: text("type").notNull(),
    occurredAt: dateTimeText("occurredAt").notNull(),
    fxRateId: text("fxRateId"),
    fxSnapshotId: text("fxSnapshotId"),
    fxAppliedRate: decimalText("fxAppliedRate").notNull().default("1"),
    note: text("note"),
    meta: text("meta"),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userOccurredIdx: index("TxnEntry_userId_occurredAt_idx").on(
      table.userId,
      table.occurredAt,
    ),
    fxSnapshotIdx: index("TxnEntry_fxSnapshotId_idx").on(table.fxSnapshotId),
  }),
);

export const txnLines = sqliteTable(
  "TxnLine",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    entryId: text("entryId").notNull(),
    accountId: text("accountId").notNull(),
    type: text("type").notNull(),
    amount: decimalText("amount").notNull(),
    currency: text("currency").notNull(),
    counterpartyAccountId: text("counterpartyAccountId"),
    counterpartyName: text("counterpartyName"),
    exchangeRateAB: decimalText("exchangeRateAB"),
    viaCurrency: text("viaCurrency").default("USD"),
    rateAtoUSD: decimalText("rateAtoUSD"),
    rateUSDtoB: decimalText("rateUSDtoB"),
    fxSnapshotId: text("fxSnapshotId"),
    fxAppliedRate: decimalText("fxAppliedRate").notNull().default("1"),
    fxEffectiveAt: dateTimeText("fxEffectiveAt"),
    principalDelta: decimalText("principalDelta").notNull().default("0"),
    valuationDelta: decimalText("valuationDelta").notNull().default("0"),
    attachmentUrl: text("attachmentUrl"),
    note: text("note"),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: dateTimeText("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    accountCreatedIdx: index("TxnLine_accountId_createdAt_idx").on(
      table.accountId,
      table.createdAt,
    ),
    entryTypeIdx: index("TxnLine_entryId_type_idx").on(
      table.entryId,
      table.type,
    ),
    counterpartyIdx: index("TxnLine_counterpartyAccountId_idx").on(
      table.counterpartyAccountId,
    ),
    fxSnapshotIdx: index("TxnLine_fxSnapshotId_idx").on(table.fxSnapshotId),
  }),
);

export const valuationSnapshots = sqliteTable(
  "ValuationSnapshot",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    accountId: text("accountId").notNull(),
    asOf: dateTimeText("asOf").notNull(),
    totalValue: decimalText("totalValue").notNull(),
    currency: text("currency").notNull(),
    fxRateId: text("fxRateId"),
    fxSnapshotId: text("fxSnapshotId"),
    fxAppliedRate: decimalText("fxAppliedRate").notNull().default("1"),
    note: text("note"),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    accountAsOfKey: uniqueIndex("ValuationSnapshot_accountId_asOf_key").on(
      table.accountId,
      table.asOf,
    ),
    fxSnapshotIdx: index("ValuationSnapshot_fxSnapshotId_idx").on(
      table.fxSnapshotId,
    ),
  }),
);

export const userAnnualDeductions = sqliteTable(
  "UserAnnualDeduction",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("userId").notNull(),
    taxYear: integer("taxYear").notNull(),
    annualAmount: decimalText("annualAmount").notNull().default("0"),
    allocationRule: text("allocationRule"),
    note: text("note"),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: dateTimeText("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userTaxYearKey: uniqueIndex("UserAnnualDeduction_userId_taxYear_key").on(
      table.userId,
      table.taxYear,
    ),
    userTaxYearIdx: index("UserAnnualDeduction_userId_taxYear_idx").on(
      table.userId,
      table.taxYear,
    ),
  }),
);

export const auditLogs = sqliteTable(
  "AuditLog",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("userId"),
    action: text("action").notNull(),
    meta: text("meta"),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userCreatedIdx: index("AuditLog_userId_createdAt_idx").on(
      table.userId,
      table.createdAt,
    ),
  }),
);

export const incomeChanges = sqliteTable(
  "IncomeChange",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("userId").notNull(),
    grossMonthly: decimalText("grossMonthly").notNull(),
    currency: text("currency").notNull().default("CNY"),
    effectiveFrom: dateTimeText("effectiveFrom").notNull(),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userEffectiveIdx: index("IncomeChange_userId_effectiveFrom_idx").on(
      table.userId,
      table.effectiveFrom,
    ),
  }),
);

export const bonusPlans = sqliteTable(
  "BonusPlan",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("userId").notNull(),
    amount: decimalText("amount").notNull(),
    currency: text("currency").notNull().default("CNY"),
    taxMethod: text("taxMethod").notNull().default("MERGE"),
    effectiveDate: dateTimeText("effectiveDate").notNull(),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userEffectiveIdx: index("BonusPlan_userId_effectiveDate_idx").on(
      table.userId,
      table.effectiveDate,
    ),
  }),
);

export const longTermCashPlans = sqliteTable(
  "LongTermCashPlan",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("userId").notNull(),
    totalAmount: decimalText("totalAmount").notNull(),
    currency: text("currency").notNull().default("CNY"),
    startDate: dateTimeText("startDate").notNull(),
    periods: integer("periods").notNull(),
    recurrence: text("recurrence").notNull(),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userStartIdx: index("LongTermCashPlan_userId_startDate_idx").on(
      table.userId,
      table.startDate,
    ),
  }),
);

export const longTermCashPayouts = sqliteTable(
  "LongTermCashPayout",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    planId: text("planId").notNull(),
    payDate: dateTimeText("payDate").notNull(),
    amount: decimalText("amount").notNull(),
    currency: text("currency").notNull().default("CNY"),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    planDateKey: uniqueIndex("planId_payDate").on(table.planId, table.payDate),
  }),
);

export const incomeRecords = sqliteTable(
  "IncomeRecord",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("userId").notNull(),
    monthDate: dateTimeText("monthDate").notNull(),
    cityId: text("cityId"),
    currency: text("currency").notNull().default("CNY"),
    sourceCurrency: text("sourceCurrency"),
    fxRateId: text("fxRateId"),
    fxSnapshotId: text("fxSnapshotId"),
    fxAppliedRate: decimalText("fxAppliedRate").notNull().default("1"),
    gross: decimalText("gross").notNull(),
    bonus: decimalText("bonus").default("0"),
    ltcIncome: decimalText("ltcIncome").default("0"),
    equityIncome: decimalText("equityIncome").default("0"),
    socialInsuranceBase: decimalText("socialInsuranceBase"),
    housingFundBase: decimalText("housingFundBase"),
    socialInsurance: decimalText("socialInsurance").default("0"),
    housingFund: decimalText("housingFund").default("0"),
    specialDeductions: decimalText("specialDeductions").default("0"),
    otherDeductions: decimalText("otherDeductions").default("0"),
    charityDonations: decimalText("charityDonations").default("0"),
    manualGross: decimalText("manualGross"),
    manualTaxable: decimalText("manualTaxable"),
    manualIncomeTax: decimalText("manualIncomeTax"),
    manualNet: decimalText("manualNet"),
    manualNote: text("manualNote"),
    taxableCurrent: decimalText("taxableCurrent"),
    incomeTax: decimalText("incomeTax"),
    taxPaidCumulative: decimalText("taxPaidCumulative").default("0"),
    taxableCumulative: decimalText("taxableCumulative"),
    taxCumulative: decimalText("taxCumulative"),
    netIncome: decimalText("netIncome"),
    source: text("source").notNull().default("system"),
    isForecast: integer("isForecast", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: dateTimeText("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userMonthKey: uniqueIndex("IncomeRecord_userId_monthDate_key").on(
      table.userId,
      table.monthDate,
    ),
    userMonthIdx: index("IncomeRecord_userId_monthDate_idx").on(
      table.userId,
      table.monthDate,
    ),
    fxSnapshotIdx: index("IncomeRecord_fxSnapshotId_idx").on(
      table.fxSnapshotId,
    ),
  }),
);

export const incomeRecalcTasks = sqliteTable(
  "IncomeRecalcTask",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("userId"),
    taxYear: integer("taxYear").notNull(),
    startMonth: integer("startMonth").notNull().default(1),
    endMonth: integer("endMonth").notNull().default(12),
    cityId: text("cityId"),
    status: text("status").notNull().default("PENDING"),
    scheduledFor: dateTimeText("scheduledFor")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("lastError"),
    triggeredBy: text("triggeredBy"),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: dateTimeText("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    processedAt: dateTimeText("processedAt"),
  },
  (table) => ({
    statusScheduleIdx: index("IncomeRecalcTask_status_scheduledFor_idx").on(
      table.status,
      table.scheduledFor,
    ),
    userYearStatusIdx: index("IncomeRecalcTask_userId_taxYear_status_idx").on(
      table.userId,
      table.taxYear,
      table.status,
    ),
  }),
);

export const eventOutbox = sqliteTable(
  "EventOutbox",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    eventType: text("eventType").notNull(),
    payload: text("payload", { mode: "json" }).$type<unknown>().notNull(),
    status: text("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("lastError"),
    occurredAt: dateTimeText("occurredAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    availableAt: dateTimeText("availableAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    processedAt: dateTimeText("processedAt"),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: dateTimeText("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    statusAvailableIdx: index("EventOutbox_status_availableAt_idx").on(
      table.status,
      table.availableAt,
    ),
    eventStatusIdx: index("EventOutbox_eventType_status_idx").on(
      table.eventType,
      table.status,
    ),
  }),
);

export const reportDatasets = sqliteTable(
  "ReportDataset",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("userId").notNull(),
    scope: text("scope").notNull(),
    bucket: text("bucket").notNull().default("default"),
    payload: text("payload", { mode: "json" }).$type<unknown>().notNull(),
    occurredAt: dateTimeText("occurredAt"),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: dateTimeText("updatedAt")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userScopeBucketKey: uniqueIndex("ReportDataset_userId_scope_bucket_key").on(
      table.userId,
      table.scope,
      table.bucket,
    ),
    scopeBucketIdx: index("ReportDataset_scope_bucket_idx").on(
      table.scope,
      table.bucket,
    ),
    userScopeIdx: index("ReportDataset_userId_scope_idx").on(
      table.userId,
      table.scope,
    ),
  }),
);

export const equityGrants = sqliteTable(
  "EquityGrant",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("userId").notNull(),
    totalUnits: decimalText("totalUnits").notNull(),
    currency: text("currency").notNull().default("CNY"),
    startVestDate: dateTimeText("startVestDate").notNull(),
    vestPeriods: integer("vestPeriods").notNull(),
    vestInterval: text("vestInterval").notNull(),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userStartIdx: index("EquityGrant_userId_startVestDate_idx").on(
      table.userId,
      table.startVestDate,
    ),
  }),
);

export const equityVests = sqliteTable(
  "EquityVest",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    grantId: text("grantId").notNull(),
    vestDate: dateTimeText("vestDate").notNull(),
    units: decimalText("units").notNull(),
    fairValue: decimalText("fairValue"),
    currency: text("currency").notNull(),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    grantDateKey: uniqueIndex("grantId_vestDate").on(
      table.grantId,
      table.vestDate,
    ),
  }),
);

export const idempotencyKeys = sqliteTable(
  "IdempotencyKey",
  {
    key: text("key").primaryKey(),
    userId: text("userId"),
    hash: text("hash"),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    usedAt: dateTimeText("usedAt"),
    expiresAt: dateTimeText("expiresAt"),
  },
  (table) => ({
    userCreatedIdx: index("IdempotencyKey_userId_createdAt_idx").on(
      table.userId,
      table.createdAt,
    ),
  }),
);

export const cityChangeRecords = sqliteTable(
  "CityChangeRecord",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("userId").notNull(),
    fromCityId: text("fromCityId"),
    toCityId: text("toCityId").notNull(),
    effectiveMonth: dateTimeText("effectiveMonth").notNull(),
    reason: text("reason"),
    createdAt: dateTimeText("createdAt")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userEffectiveIdx: index("CityChangeRecord_userId_effectiveMonth_idx").on(
      table.userId,
      table.effectiveMonth,
    ),
    toCityIdx: index("CityChangeRecord_toCityId_idx").on(table.toCityId),
    fromCityIdx: index("CityChangeRecord_fromCityId_idx").on(table.fromCityId),
  }),
);

export const usersRelations = relations(users, ({ many, one }) => ({
  authAccounts: many(authAccounts),
  authSessions: many(authSessions),
  incomes: many(incomeRecords),
  incomeChanges: many(incomeChanges),
  bonusPlans: many(bonusPlans),
  ltcPlans: many(longTermCashPlans),
  accounts: many(accounts),
  txnEntries: many(txnEntries),
  auditLogs: many(auditLogs),
  equityGrants: many(equityGrants),
  cityChanges: many(cityChangeRecords),
  annualDeductions: many(userAnnualDeductions),
  recalcTasks: many(incomeRecalcTasks),
  reportDatasets: many(reportDatasets),
  currentCity: one(cities, {
    fields: [users.currentCityId],
    references: [cities.id],
  }),
}));

export const authAccountsRelations = relations(authAccounts, ({ one }) => ({
  user: one(users, { fields: [authAccounts.userId], references: [users.id] }),
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, { fields: [authSessions.userId], references: [users.id] }),
}));

export const cityRelations = relations(cities, ({ many }) => ({
  ssRules: many(cityRuleSS),
  hfRules: many(cityRuleHF),
  users: many(users),
  incomeRecords: many(incomeRecords),
  recalcTasks: many(incomeRecalcTasks),
  cityChangesTo: many(cityChangeRecords, { relationName: "CityChangeToCity" }),
  cityChangesFrom: many(cityChangeRecords, {
    relationName: "CityChangeFromCity",
  }),
}));

export const cityRuleSSRelations = relations(cityRuleSS, ({ one }) => ({
  city: one(cities, { fields: [cityRuleSS.cityId], references: [cities.id] }),
}));

export const cityRuleHFRelations = relations(cityRuleHF, ({ one }) => ({
  city: one(cities, { fields: [cityRuleHF.cityId], references: [cities.id] }),
}));

export const taxConfigRelations = relations(taxConfig, ({ many }) => ({
  brackets: many(taxBracket),
}));

export const taxBracketRelations = relations(taxBracket, ({ one }) => ({
  config: one(taxConfig, {
    fields: [taxBracket.country, taxBracket.taxYear],
    references: [taxConfig.country, taxConfig.taxYear],
  }),
}));

export const accountRelations = relations(accounts, ({ many, one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  txnLines: many(txnLines),
  counterpartyLines: many(txnLines, {
    relationName: "TxnLineCounterparty",
  }),
  valuations: many(valuationSnapshots),
}));

export const fxRateRelations = relations(fxRates, ({ many }) => ({
  entries: many(txnEntries),
  valuations: many(valuationSnapshots),
  incomeRecords: many(incomeRecords),
  snapshots: many(fxSnapshots),
}));

export const fxSnapshotRelations = relations(fxSnapshots, ({ many, one }) => ({
  sourceRate: one(fxRates, {
    fields: [fxSnapshots.sourceRateId],
    references: [fxRates.id],
  }),
  txnEntries: many(txnEntries),
  txnLines: many(txnLines),
  valuationSnapshots: many(valuationSnapshots),
  incomeRecords: many(incomeRecords),
}));

export const fxRateUpdateTaskRelations = relations(
  fxRateUpdateTasks,
  ({ many }) => ({
    logs: many(fxRateUpdateLogs),
  }),
);

export const fxRateUpdateLogRelations = relations(
  fxRateUpdateLogs,
  ({ one }) => ({
    task: one(fxRateUpdateTasks, {
      fields: [fxRateUpdateLogs.taskId],
      references: [fxRateUpdateTasks.id],
    }),
  }),
);

export const txnEntryRelations = relations(txnEntries, ({ many, one }) => ({
  user: one(users, { fields: [txnEntries.userId], references: [users.id] }),
  fxRate: one(fxRates, { fields: [txnEntries.fxRateId], references: [fxRates.id] }),
  fxSnapshot: one(fxSnapshots, {
    fields: [txnEntries.fxSnapshotId],
    references: [fxSnapshots.id],
  }),
  lines: many(txnLines),
}));

export const txnLineRelations = relations(txnLines, ({ one }) => ({
  entry: one(txnEntries, { fields: [txnLines.entryId], references: [txnEntries.id] }),
  account: one(accounts, { fields: [txnLines.accountId], references: [accounts.id] }),
  counterpartyAccount: one(accounts, {
    fields: [txnLines.counterpartyAccountId],
    references: [accounts.id],
    relationName: "TxnLineCounterparty",
  }),
  fxSnapshot: one(fxSnapshots, {
    fields: [txnLines.fxSnapshotId],
    references: [fxSnapshots.id],
  }),
}));

export const valuationSnapshotRelations = relations(
  valuationSnapshots,
  ({ one }) => ({
    account: one(accounts, {
      fields: [valuationSnapshots.accountId],
      references: [accounts.id],
    }),
    fxRate: one(fxRates, {
      fields: [valuationSnapshots.fxRateId],
      references: [fxRates.id],
    }),
    fxSnapshot: one(fxSnapshots, {
      fields: [valuationSnapshots.fxSnapshotId],
      references: [fxSnapshots.id],
    }),
  }),
);

export const userAnnualDeductionRelations = relations(
  userAnnualDeductions,
  ({ one }) => ({
    user: one(users, {
      fields: [userAnnualDeductions.userId],
      references: [users.id],
    }),
  }),
);

export const auditLogRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const incomeChangeRelations = relations(incomeChanges, ({ one }) => ({
  user: one(users, { fields: [incomeChanges.userId], references: [users.id] }),
}));

export const bonusPlanRelations = relations(bonusPlans, ({ one }) => ({
  user: one(users, { fields: [bonusPlans.userId], references: [users.id] }),
}));

export const longTermCashPlanRelations = relations(
  longTermCashPlans,
  ({ many, one }) => ({
    user: one(users, {
      fields: [longTermCashPlans.userId],
      references: [users.id],
    }),
    payouts: many(longTermCashPayouts),
  }),
);

export const longTermCashPayoutRelations = relations(
  longTermCashPayouts,
  ({ one }) => ({
    plan: one(longTermCashPlans, {
      fields: [longTermCashPayouts.planId],
      references: [longTermCashPlans.id],
    }),
  }),
);

export const incomeRecordRelations = relations(incomeRecords, ({ one }) => ({
  user: one(users, { fields: [incomeRecords.userId], references: [users.id] }),
  city: one(cities, { fields: [incomeRecords.cityId], references: [cities.id] }),
  fxRate: one(fxRates, { fields: [incomeRecords.fxRateId], references: [fxRates.id] }),
  fxSnapshot: one(fxSnapshots, {
    fields: [incomeRecords.fxSnapshotId],
    references: [fxSnapshots.id],
  }),
}));

export const incomeRecalcTaskRelations = relations(
  incomeRecalcTasks,
  ({ one }) => ({
    user: one(users, {
      fields: [incomeRecalcTasks.userId],
      references: [users.id],
    }),
    city: one(cities, {
      fields: [incomeRecalcTasks.cityId],
      references: [cities.id],
    }),
  }),
);

export const reportDatasetRelations = relations(reportDatasets, ({ one }) => ({
  user: one(users, { fields: [reportDatasets.userId], references: [users.id] }),
}));

export const equityGrantRelations = relations(equityGrants, ({ many, one }) => ({
  user: one(users, { fields: [equityGrants.userId], references: [users.id] }),
  vests: many(equityVests),
}));

export const equityVestRelations = relations(equityVests, ({ one }) => ({
  grant: one(equityGrants, {
    fields: [equityVests.grantId],
    references: [equityGrants.id],
  }),
}));

export const cityChangeRecordRelations = relations(
  cityChangeRecords,
  ({ one }) => ({
    user: one(users, {
      fields: [cityChangeRecords.userId],
      references: [users.id],
    }),
    fromCity: one(cities, {
      fields: [cityChangeRecords.fromCityId],
      references: [cities.id],
      relationName: "CityChangeFromCity",
    }),
    toCity: one(cities, {
      fields: [cityChangeRecords.toCityId],
      references: [cities.id],
      relationName: "CityChangeToCity",
    }),
  }),
);
