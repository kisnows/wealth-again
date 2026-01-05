import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import * as schema from "@/server/db/schema";

export type DecimalString = string;

export type User = InferSelectModel<typeof schema.users>;
export type AuthAccount = InferSelectModel<typeof schema.authAccounts>;
export type AuthSession = InferSelectModel<typeof schema.authSessions>;
export type AuthVerification = InferSelectModel<typeof schema.authVerifications>;
export type City = InferSelectModel<typeof schema.cities>;
export type CityRuleSS = InferSelectModel<typeof schema.cityRuleSS>;
export type CityRuleHF = InferSelectModel<typeof schema.cityRuleHF>;
export type TaxConfig = InferSelectModel<typeof schema.taxConfig>;
export type TaxBracket = InferSelectModel<typeof schema.taxBracket>;
export type Account = InferSelectModel<typeof schema.accounts>;
export type FxRate = InferSelectModel<typeof schema.fxRates>;
export type FxSnapshot = InferSelectModel<typeof schema.fxSnapshots>;
export type FxRateUpdateTask = InferSelectModel<typeof schema.fxRateUpdateTasks>;
export type FxRateUpdateLog = InferSelectModel<typeof schema.fxRateUpdateLogs>;
export type TxnEntry = InferSelectModel<typeof schema.txnEntries>;
export type TxnLine = InferSelectModel<typeof schema.txnLines>;
export type ValuationSnapshot = InferSelectModel<typeof schema.valuationSnapshots>;
export type UserAnnualDeduction = InferSelectModel<
  typeof schema.userAnnualDeductions
>;
export type AuditLog = InferSelectModel<typeof schema.auditLogs>;
export type IncomeChange = InferSelectModel<typeof schema.incomeChanges>;
export type BonusPlan = InferSelectModel<typeof schema.bonusPlans>;
export type LongTermCashPlan = InferSelectModel<typeof schema.longTermCashPlans>;
export type LongTermCashPayout = InferSelectModel<
  typeof schema.longTermCashPayouts
>;
export type IncomeRecord = InferSelectModel<typeof schema.incomeRecords>;
export type IncomeRecalcTask = InferSelectModel<
  typeof schema.incomeRecalcTasks
>;
export type EventOutbox = InferSelectModel<typeof schema.eventOutbox>;
export type ReportDataset = InferSelectModel<typeof schema.reportDatasets>;
export type EquityGrant = InferSelectModel<typeof schema.equityGrants>;
export type EquityVest = InferSelectModel<typeof schema.equityVests>;
export type IdempotencyKey = InferSelectModel<typeof schema.idempotencyKeys>;
export type CityChangeRecord = InferSelectModel<
  typeof schema.cityChangeRecords
>;

export type NewIncomeRecord = InferInsertModel<typeof schema.incomeRecords>;
