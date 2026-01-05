import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDbMock, setSelectFallback } from "@/tests/helpers/dbMock";
import { cities, users } from "@/server/db/schema";

vi.mock("@/server/services/income-tax/income", () => ({
  ensureIncomeRecordsForUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/services/income-tax/tax", () => ({
  // 场景：本测试只关注 buildIncomeTimeline 不触发 TDZ/循环依赖导致的运行时异常
  //      税务计算细节由其它 service 测试覆盖，这里返回最小可用值即可。
  getTaxContext: vi.fn().mockResolvedValue({ currency: "CNY" }),
  computeCumulativeTax: vi.fn().mockReturnValue(new Array(12).fill(null)),
}));

describe("Income timeline service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMock();
    setSelectFallback(({ table }) => {
      if (table === users) {
        return [{ id: "u1", currentCityId: "hz", displayCurrency: "CNY" }];
      }
      if (table === cities) {
        return [{ id: "hz", name: "Hangzhou", country: "CN" }];
      }
      return [];
    });
  });

  it("buildIncomeTimeline should not throw ReferenceError for bonusPlans TDZ", async () => {
    // 场景：历史曾在 Promise.all 解构中把查询结果命名为 bonusPlans，导致 .from(bonusPlans) 触发 TDZ
    const { buildIncomeTimeline } = await import(
      "@/server/services/income-tax/income-timeline"
    );
    const result = await buildIncomeTimeline(
      "u1",
      "2026-01-01",
      "2026-01-01",
      "CNY",
    );
    expect(result.summary.currency).toBe("CNY");
    expect(Array.isArray(result.items)).toBe(true);
  });
});


