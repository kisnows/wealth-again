import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeJsonRequest } from "@/tests/helpers";
import { insertCalls, resetDbMock, setSelectFallback } from "@/tests/helpers/dbMock";
import {
  bonusPlans,
  cityRuleHF,
  cityRuleSS,
  equityVests,
  incomeChanges,
  incomeRecords,
  incomeRecalcTasks,
  longTermCashPayouts,
  taxBracket,
  taxConfig,
  users,
} from "@/server/db/schema";

// PRD 示例（doc/prd-income.md 1–3 月）：
// - 工资：自 2025-01 起 20000（当月生效）
// - 奖金：2025-03 发放 30000（并入计税）
// - 长期现金：总额 160000，季度 16 期，每期 10000，2025-01/04/07/10…
// - 社保（个人）：养老8%、医保2%+3元、失业0.5%（基数=20000）→ 2103
// - 公积金（个人）：12%（基数=20000）→ 2400
// - 基本减除：5000/月；专项附加：0
// 期望个税：1月 614.91；2月 314.91；3月 4699.28（季度在 1/4/7/10 发放，3 月无 LTC）

const writeOutboxEventMock = vi.fn().mockResolvedValue({ id: "evt" });
vi.mock("@/server/services/outbox", () => ({
  writeOutboxEvent: writeOutboxEventMock,
  fetchPendingOutboxEvents: vi.fn(),
  markOutboxEventDelivered: vi.fn(),
  markOutboxEventFailed: vi.fn(),
}));

function buildPendingTask(overrides: Partial<any> = {}) {
  const now = new Date();
  return {
    id: overrides.id ?? "task-mock",
    userId: overrides.userId ?? "u1",
    taxYear: overrides.taxYear ?? 2025,
    startMonth: overrides.startMonth ?? 1,
    endMonth: overrides.endMonth ?? 3,
    cityId: overrides.cityId ?? null,
    status: "PENDING",
    attempts: overrides.attempts ?? 0,
    scheduledFor: overrides.scheduledFor ?? new Date(now.getTime() - 1_000),
    processedAt: overrides.processedAt ?? null,
    lastError: overrides.lastError ?? null,
    triggeredBy: overrides.triggeredBy ?? "u1",
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

async function runIncomeWorkerOnce(taskOverrides: Partial<any> = {}) {
  const { processDueIncomeRecalcTasks } = await import("@/server/services/income-tax/income");
  const pendingTask = buildPendingTask(taskOverrides);
  return { pendingTask, processDueIncomeRecalcTasks };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock();
  writeOutboxEventMock.mockReset();
  setSelectFallback(null);
});

describe("PRD 示例（2025 年 1–3 月）", () => {
  it("当月个税匹配 PRD 数字", async () => {
    const recalc = await import("@/app/api/v1/income-tax/recalc/route");
    const monthlyBonuses = [[], [], [{ amount: "30000" }]];
    const monthlyLtc = [[{ amount: "10000" }], [], [{ amount: "10000" }]];
    let incomeRecalcTaskResponses: any[][] = [];
    setSelectFallback(({ table, tableCallIndex }) => {
      if (table === users) {
        return [{ id: "u1", currentCityId: "c1" }];
      }
      if (table === incomeChanges) {
        return [{ grossMonthly: "20000", currency: "CNY" }];
      }
      if (table === bonusPlans) {
        return monthlyBonuses[tableCallIndex] ?? [];
      }
      if (table === longTermCashPayouts) {
        return monthlyLtc[tableCallIndex] ?? [];
      }
      if (table === equityVests) {
        return [];
      }
      if (table === cityRuleSS) {
        return [
          {
            baseMin: "5000",
            baseMax: "25000",
            ratePension: "0.08",
            rateMedical: "0.02",
            rateUnemployment: "0.005",
            fixedMedicalPersonal: "3",
          },
        ];
      }
      if (table === cityRuleHF) {
        return [
          {
            baseMin: "5000",
            baseMax: "25000",
            rateEmployee: "0.12",
          },
        ];
      }
      if (table === taxConfig) {
        return [
          {
            country: "CN",
            taxYear: 2025,
            standardDeduction: "5000",
            specialAdditionalDeduction: "0",
          },
        ];
      }
      if (table === taxBracket) {
        return [
          { position: 1, threshold: "36000", taxRate: "0.03", quickDeduction: "0" },
          { position: 2, threshold: "144000", taxRate: "0.1", quickDeduction: "2520" },
          { position: 3, threshold: "300000", taxRate: "0.2", quickDeduction: "16920" },
          { position: 4, threshold: "420000", taxRate: "0.25", quickDeduction: "31920" },
          { position: 5, threshold: "660000", taxRate: "0.3", quickDeduction: "52920" },
          { position: 6, threshold: "960000", taxRate: "0.35", quickDeduction: "85920" },
          { position: 7, threshold: "1000000000", taxRate: "0.45", quickDeduction: "181920" },
        ];
      }
      if (table === incomeRecalcTasks) {
        return incomeRecalcTaskResponses[tableCallIndex] ?? [];
      }
      return [];
    });
    // 用户（CN/HZ）

    const scheduleResp = await recalc.POST(
      makeJsonRequest("http://localhost/api/v1/income-tax/recalc", "POST", {
        taxYear: 2025,
        endMonth: 3,
      }),
    );
    expect(scheduleResp.status).toBe(202);
    const { pendingTask, processDueIncomeRecalcTasks } = await runIncomeWorkerOnce({
      taxYear: 2025,
      startMonth: 1,
      endMonth: 3,
    });
    incomeRecalcTaskResponses = [[], [pendingTask]];
    await processDueIncomeRecalcTasks();

    // 取出 1-3 月 upsert 的税额
    const byMonth: Record<number, any> = {};
    for (const call of insertCalls) {
      if (call.table !== incomeRecords) continue;
      const values = call.values as { monthDate: Date } & Record<string, string>;
      const d = values.monthDate;
      const m = d.getUTCMonth() + 1;
      byMonth[m] = {
        tax: Number(values.incomeTax ?? 0),
        ss: Number(values.socialInsurance ?? 0),
        hf: Number(values.housingFund ?? 0),
      };
    }
    expect(byMonth[1].ss).toBeCloseTo(2103, 2);
    expect(byMonth[1].hf).toBeCloseTo(2400, 2);
    expect(byMonth[1].tax).toBeCloseTo(614.91, 2);
    expect(byMonth[2].tax).toBeCloseTo(314.91, 2);
    expect(byMonth[3].tax).toBeCloseTo(4699.28, 2);
    expect(writeOutboxEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "income.recalc.completed" }),
    );
  });
});
