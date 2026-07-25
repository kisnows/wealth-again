import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  insertCalls,
  queueInsertResults,
  queueSelectResults,
  resetDbMock,
} from "@/tests/helpers/dbMock";
import { txnEntries, txnLines } from "@/server/db/schema";
import { computeAccountSummaryById } from "@/server/services/accounts-ledger/accounts";
import { convert } from "@/server/services/fx/provider";

vi.mock("@/server/services/accounts-ledger/accounts", () => ({
  computeAccountSummaryById: vi.fn(),
}));

vi.mock("@/server/services/fx/provider", () => ({
  convert: vi.fn(),
}));

vi.mock("@/server/services/audit", () => ({
  logAudit: vi.fn(),
}));

describe("Ledger service（账户与交易）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMock();
  });

  it("getAccountSummary 未找到账户时返回 null", async () => {
    // 用例：服务在账户不存在时应返回 null，避免继续计算 ROI。
    vi.mocked(computeAccountSummaryById).mockResolvedValueOnce(null);
    const { getAccountSummary } = await import("@/server/services/accounts-ledger/ledger");
    await expect(getAccountSummary("missing")).resolves.toBeNull();
  });

  it("getAccountSummary 聚合本金/估值/ROI", async () => {
    // 用例：同一方法需兼容储蓄与投资账户，正确汇总本金、估值及 ROI。
    vi.mocked(computeAccountSummaryById).mockResolvedValueOnce({
      id: "acc-savings",
      principal: 105,
      valuation: 105,
      profit: 0,
      roi: 0,
    } as any);
    const { getAccountSummary } = await import("@/server/services/accounts-ledger/ledger");
    const summarySavings = await getAccountSummary("acc-savings");
    expect(summarySavings).toMatchObject({
      principal: 105,
      valuation: 105,
      profit: 0,
      roi: 0,
    });

    vi.mocked(computeAccountSummaryById).mockResolvedValueOnce({
      id: "acc-invest",
      principal: 150,
      valuation: 180,
      profit: 30,
      roi: 0.2,
    } as any);
    const summaryInvest = await getAccountSummary("acc-invest");
    expect(summaryInvest).toMatchObject({
      principal: 150,
      valuation: 180,
      profit: 30,
      roi: 0.2,
    });
  });

  it("postDeposit 账户缺失抛出异常", async () => {
    // 用例：存款前若无法找到账户，应抛出错误阻止创建流水。
    queueSelectResults([]);
    const { postDeposit } = await import("@/server/services/accounts-ledger/ledger");
    await expect(
      postDeposit({
        accountId: "missing",
        amount: 100,
        occurredAt: new Date("2025-08-01").toISOString(),
      }),
    ).rejects.toThrowError("Account not found");
  });

  it("postDeposit 写入单条流水并继承账户币种", async () => {
    // 用例：存款成功后生成单条流水，金额与币种继承账户配置。
    queueSelectResults([
      {
      id: "acc1",
      userId: "user-1",
      accountType: "SAVINGS",
      baseCurrency: "CNY",
      status: "ACTIVE",
      initialBalance: "0",
    },
    ]);
    queueInsertResults([{ id: "entry-1" }], [{ id: "line-1" }]);
    const { postDeposit } = await import("@/server/services/accounts-ledger/ledger");
    const occurredAt = new Date("2025-08-02T00:00:00Z").toISOString();
    const res = await postDeposit({
      accountId: "acc1",
      amount: 500,
      occurredAt,
      note: "薪资入账",
    });
    expect(res.id).toBe("entry-1");
    expect(insertCalls[0].table).toBe(txnEntries);
    expect(insertCalls[1].table).toBe(txnLines);
    expect(insertCalls[1].values).toMatchObject({
      accountId: "acc1",
      amount: "500",
      currency: "CNY",
      note: "薪资入账",
      fxAppliedRate: "1",
      fxSnapshotId: null,
      fxEffectiveAt: new Date(occurredAt),
    });
  });

  it("postTransfer 生成双方分录，未显式提供目标金额时复用来源金额", async () => {
    // 用例：转账默认生成两条分录，缺少目标金额时使用来源金额（同币种）。
    queueSelectResults(
      [
        {
          id: "from",
          userId: "user-1",
          baseCurrency: "CNY",
          name: "from",
          status: "ACTIVE",
        },
      ],
      [
        {
          id: "to",
          userId: "user-1",
          baseCurrency: "USD",
          name: "to",
          status: "ACTIVE",
        },
      ],
    );
    queueInsertResults([{ id: "transfer-1" }], [{ id: "line-from" }], [{ id: "line-to" }]);
    vi.mocked(convert).mockResolvedValueOnce({
      amount: 700,
      effectiveRate: 1,
      viaCurrency: "USD",
      rateAtoUsd: 1,
      rateUsdToB: 1,
      fxEffectiveAt: new Date("2025-08-03T00:00:00Z"),
      snapshots: [],
    });
    const { postTransfer } = await import("@/server/services/accounts-ledger/ledger");
    await postTransfer({
      from: { accountId: "from", amount: 700 },
      to: { accountId: "to" },
      occurredAt: new Date("2025-08-03T00:00:00Z").toISOString(),
      note: "兑换美元",
    });
    const fromLine = insertCalls[1].values as Record<string, unknown>;
    const toLine = insertCalls[2].values as Record<string, unknown>;
    expect(fromLine).toMatchObject({
      accountId: "from",
      amount: "-700",
      currency: "CNY",
      note: "兑换美元",
      fxAppliedRate: "1",
    });
    expect(toLine).toMatchObject({
      accountId: "to",
      amount: "700",
      currency: "USD",
      note: "兑换美元",
      fxAppliedRate: "1",
    });
  });

  it("postTransfer 显式指定目标金额时遵循传入数值", async () => {
    // 用例：跨币种转账提供了目标金额，应按照指定数值写入到分录。
    queueSelectResults(
      [
        {
          id: "from",
          userId: "user-1",
          baseCurrency: "CNY",
          name: "from",
          status: "ACTIVE",
        },
      ],
      [
        {
          id: "to",
          userId: "user-1",
          baseCurrency: "JPY",
          name: "to",
          status: "ACTIVE",
        },
      ],
    );
    queueInsertResults([{ id: "transfer-2" }], [{ id: "line-from" }], [{ id: "line-to" }]);
    vi.mocked(convert).mockResolvedValueOnce({
      amount: 1000,
      effectiveRate: 1,
      viaCurrency: "USD",
      rateAtoUsd: 1,
      rateUsdToB: 1,
      fxEffectiveAt: new Date("2025-08-04T00:00:00Z"),
      snapshots: [],
    });
    const { postTransfer } = await import("@/server/services/accounts-ledger/ledger");
    await postTransfer({
      from: { accountId: "from", amount: 1000 },
      to: { accountId: "to", amount: 21000 },
      occurredAt: new Date("2025-08-04T00:00:00Z").toISOString(),
      note: "换日元",
    });
    const toLine = insertCalls[2].values as Record<string, unknown>;
    expect(toLine).toMatchObject({
      accountId: "to",
      amount: "21000",
      currency: "JPY",
      fxAppliedRate: "1",
    });
  });
});
