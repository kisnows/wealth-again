import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeJsonRequest } from "@/tests/helpers";
import { insertCalls, resetDbMock, setSelectFallback } from "@/tests/helpers/dbMock";
import { incomeRecords, incomeRecalcTasks } from "@/server/db/schema";
import {
  bonusPlans,
  cityRuleHF,
  cityRuleSS,
  equityVests,
  incomeChanges,
  longTermCashPayouts,
  taxBracket,
  taxConfig,
  users,
} from "@/server/db/schema";

// 本文件针对“收入预测/回算”做金额级断言：
// - 工资：每月 10000
// - 奖金：1 月 20000（并入计税）
// - 长期现金：4 月与 7 月各 3000（季度发放）
// - 社保：按工资基数 10.5%（养老8%+医疗2%+失业0.5%） → 10000×0.105=1050
// - 公积金：按工资基数 12% → 10000×0.12=1200
// - 标准扣除：5000/月
// - 税表：3 万6 以内 3%，超过转 10% 减速算扣除 2520（简化）
// 断言（单位：元）：
// - 1月 682.5（当月含 2w 奖金）；2月 82.5；3月 82.5；4月 172.5（含 3k LTC）
// - 5月 135（跨档后当月税 135）；6月 275；7月 575（含 3k LTC）；8月 275

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
    endMonth: overrides.endMonth ?? 8,
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

describe("收入预测与回算（半年 + 5-8 月截取）", () => {
  it("半年（1-6月）与 5-8 月的应纳税额准确", async () => {
    const recalc = await import("@/app/api/v1/income-tax/recalc/route");
    const monthlyBonuses = [
      [{ amount: "20000" }],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
    ];
    const monthlyLtc = [
      [],
      [],
      [],
      [{ amount: "3000" }],
      [],
      [],
      [{ amount: "3000" }],
      [],
    ];
    let incomeRecalcTaskResponses: any[][] = [];
    setSelectFallback(({ table, tableCallIndex }) => {
      if (table === users) {
        return [
          {
            id: "u1",
            currentCityId: "c1",
          },
        ];
      }
      if (table === incomeChanges) {
        return [{ grossMonthly: "10000", currency: "CNY" }];
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
            baseMin: "0",
            baseMax: "100000",
            ratePension: "0.08",
            rateMedical: "0.02",
            rateUnemployment: "0.005",
          },
        ];
      }
      if (table === cityRuleHF) {
        return [
          {
            baseMin: "0",
            baseMax: "100000",
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
          },
        ];
      }
      if (table === taxBracket) {
        return [
          {
            position: 1,
            threshold: "36000",
            taxRate: "0.03",
            quickDeduction: "0",
          },
          {
            position: 2,
            threshold: "144000",
            taxRate: "0.1",
            quickDeduction: "2520",
          },
          {
            position: 7,
            threshold: "1000000000",
            taxRate: "0.45",
            quickDeduction: "181920",
          },
        ];
      }
      if (table === incomeRecalcTasks) {
        return incomeRecalcTaskResponses[tableCallIndex] ?? [];
      }
      return [];
    });
    // 用户（CN）

    // 回算到 8 月，便于截取 5-8 月
    const scheduleResp = await recalc.POST(
      makeJsonRequest("http://localhost/api/v1/income-tax/recalc", "POST", {
        taxYear: 2025,
        endMonth: 8,
      }),
    );
    expect(scheduleResp.status).toBe(202);
    const { pendingTask, processDueIncomeRecalcTasks } = await runIncomeWorkerOnce({
      taxYear: 2025,
      startMonth: 1,
      endMonth: 8,
    });
    incomeRecalcTaskResponses = [[], [pendingTask]];
    await processDueIncomeRecalcTasks();

    // 收集写入记录，按 monthDate 映射断言
    const byMonth: Record<number, any> = {};
    for (const call of insertCalls) {
      if (call.table !== incomeRecords) continue;
      const values = call.values as { monthDate: Date; incomeTax?: string; socialInsurance?: string; housingFund?: string };
      const d = values.monthDate;
      byMonth[d.getUTCMonth() + 1] = {
        incomeTax: Number(values.incomeTax ?? 0),
        ss: Number(values.socialInsurance ?? 0),
        hf: Number(values.housingFund ?? 0),
      };
    }

    // 月度税（单位：元）
    // 基础：SS=1050，HF=1200，标准扣除=5000；普通月应税=2750
    // 1月含奖金：累计应税=22750 → 累计税=682.5；
    // 2月累计=25500 → 税=765（当月 82.5）；3月累计=28250 → 税=847.5（当月 82.5）；
    // 4月含 LTC：本月应税=5750，累计=34000 → 税=1020（当月 172.5）；
    // 5月跨档：累计=36750 → 税=1155（当月 135）；6月累计=39500 → 税=1430（当月 275）；
    // 7月含 LTC：累计=45250 → 税=2005（当月 575）；8月累计=48000 → 税=2280（当月 275）。
    const expectedTax: Record<number, number> = {
      1: 682.5,
      2: 82.5,
      3: 82.5,
      4: 172.5,
      5: 135,
      6: 275,
      7: 575,
      8: 275,
    };
    // 半年（1-6月）断言
    for (let m = 1; m <= 6; m++) {
      expect(byMonth[m]).toBeTruthy();
      expect(byMonth[m].incomeTax).toBeCloseTo(expectedTax[m]);
      expect(byMonth[m].ss).toBeCloseTo(1050);
      expect(byMonth[m].hf).toBeCloseTo(1200);
    }
    // 截取 5-8 月：检查税额
    for (let m = 5; m <= 8; m++) {
      expect(byMonth[m].incomeTax).toBeCloseTo(expectedTax[m]);
    }
    expect(writeOutboxEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "income.recalc.completed" }),
    );
  });
});
