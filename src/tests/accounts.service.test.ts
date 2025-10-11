import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma: any = {
  account: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  txnEntry: { create: vi.fn() },
};

vi.mock("@/server/db", () => ({ default: mockPrisma }));

describe("Ledger service（账户与交易）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockPrisma.account)) {
      mockPrisma.account[key].mockClear();
    }
    mockPrisma.txnEntry.create.mockClear();
  });

  it("getAccountSummary 未找到账户时返回 null", async () => {
    // 用例：服务在账户不存在时应返回 null，避免继续计算 ROI。
    mockPrisma.account.findUnique.mockResolvedValueOnce(null);
    const { getAccountSummary } = await import("@/server/services/ledger");
    await expect(getAccountSummary("missing")).resolves.toBeNull();
  });

  it("getAccountSummary 聚合本金/估值/ROI", async () => {
    // 用例：同一方法需兼容储蓄与投资账户，正确汇总本金、估值及 ROI。
    mockPrisma.account.findUnique.mockResolvedValueOnce({
      id: "acc-savings",
      name: "储蓄账户",
      baseCurrency: "CNY",
      accountType: "SAVINGS",
      initialBalance: 100,
      txnLines: [{ amount: 10 }, { amount: -5 }],
      valuations: [],
    });
    const { getAccountSummary } = await import("@/server/services/ledger");
    const summarySavings = await getAccountSummary("acc-savings");
    expect(summarySavings).toMatchObject({
      principal: 105,
      valuation: 105,
      profit: 0,
      roi: 0,
    });

    mockPrisma.account.findUnique.mockResolvedValueOnce({
      id: "acc-invest",
      name: "投资账户",
      baseCurrency: "USD",
      accountType: "INVESTMENT",
      initialBalance: 100,
      txnLines: [{ amount: 50 }],
      valuations: [{ totalValue: 180 }],
    });
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
    mockPrisma.account.findUnique.mockResolvedValueOnce(null);
    const { postDeposit } = await import("@/server/services/ledger");
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
    mockPrisma.account.findUnique.mockResolvedValueOnce({
      id: "acc1",
      userId: "user-1",
      baseCurrency: "CNY",
    });
    mockPrisma.txnEntry.create.mockResolvedValueOnce({ id: "entry-1" });
    const { postDeposit } = await import("@/server/services/ledger");
    const occurredAt = new Date("2025-08-02T00:00:00Z").toISOString();
    const res = await postDeposit({
      accountId: "acc1",
      amount: 500,
      occurredAt,
      note: "薪资入账",
    });
    expect(res).toEqual({ id: "entry-1" });
    expect(mockPrisma.txnEntry.create).toHaveBeenCalledTimes(1);
    const payload = mockPrisma.txnEntry.create.mock.calls[0][0];
    expect(payload.data.userId).toBe("user-1");
    expect(payload.data.lines.create).toMatchObject({
      accountId: "acc1",
      amount: 500,
      currency: "CNY",
      note: "薪资入账",
    });
  });

  it("postTransfer 生成双方分录，未显式提供目标金额时复用来源金额", async () => {
    // 用例：转账默认生成两条分录，缺少目标金额时使用来源金额（同币种）。
    mockPrisma.account.findUnique
      .mockResolvedValueOnce({
        id: "from",
        userId: "user-1",
        baseCurrency: "CNY",
      })
      .mockResolvedValueOnce({
        id: "to",
        userId: "user-1",
        baseCurrency: "USD",
      });
    mockPrisma.txnEntry.create.mockResolvedValueOnce({ id: "transfer-1" });
    const { postTransfer } = await import("@/server/services/ledger");
    await postTransfer({
      from: { accountId: "from", amount: 700 },
      to: { accountId: "to" },
      occurredAt: new Date("2025-08-03T00:00:00Z").toISOString(),
      note: "兑换美元",
    });
    const payload = mockPrisma.txnEntry.create.mock.calls[0][0];
    expect(payload.data.userId).toBe("user-1");
    expect(payload.data.lines.create).toHaveLength(2);
    const [fromLine, toLine] = payload.data.lines.create;
    expect(fromLine).toMatchObject({
      accountId: "from",
      amount: -700,
      currency: "CNY",
      note: "兑换美元",
    });
    expect(toLine).toMatchObject({
      accountId: "to",
      amount: 700,
      currency: "USD",
      note: "兑换美元",
    });
  });

  it("postTransfer 显式指定目标金额时遵循传入数值", async () => {
    // 用例：跨币种转账提供了目标金额，应按照指定数值写入到分录。
    mockPrisma.account.findUnique
      .mockResolvedValueOnce({
        id: "from",
        userId: "user-1",
        baseCurrency: "CNY",
      })
      .mockResolvedValueOnce({
        id: "to",
        userId: "user-1",
        baseCurrency: "JPY",
      });
    mockPrisma.txnEntry.create.mockResolvedValueOnce({ id: "transfer-2" });
    const { postTransfer } = await import("@/server/services/ledger");
    await postTransfer({
      from: { accountId: "from", amount: 1000 },
      to: { accountId: "to", amount: 21000 },
      occurredAt: new Date("2025-08-04T00:00:00Z").toISOString(),
      note: "换日元",
    });
    const payload = mockPrisma.txnEntry.create.mock.calls[0][0];
    const [, toLine] = payload.data.lines.create;
    expect(toLine).toMatchObject({
      accountId: "to",
      amount: 21000,
      currency: "JPY",
    });
  });
});
