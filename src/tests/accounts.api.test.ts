import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGet, makeJsonRequest } from "@/tests/helpers";
import {
  insertCalls,
  queueInsertResults,
  setSelectFallback,
} from "@/tests/helpers/dbMock";
import { dbAdapterMock, resetDbAdapterMock } from "@/tests/helpers/dbAdapterMock";
import { accounts, txnEntries, txnLines, valuationSnapshots } from "@/server/db/schema";

// 跨币种自动折算路径中，直接 mock 转换函数，避免依赖汇率表
const mockFxSnapshotDate = new Date("2025-01-01T00:00:00.000Z");
vi.mock("@/server/services/fx/provider", () => ({
  convert: vi.fn().mockResolvedValue({
    amount: 70,
    effectiveRate: 7,
    viaCurrency: "USD",
    rateAtoUsd: 1,
    rateUsdToB: 7,
    fxEffectiveAt: mockFxSnapshotDate,
    snapshots: [
      {
        base: "USD",
        quote: "CNY",
        rate: 7,
        effectiveFrom: mockFxSnapshotDate,
        effectiveTo: null,
        id: null,
      },
    ],
  }),
  ensureFxSnapshotBatch: vi.fn().mockResolvedValue([]),
}));
// Mock 认证函数，返回测试用户
vi.mock("@/server/utils/auth", () => ({
  getUserFromRequest: vi.fn().mockResolvedValue({ id: "u1" }),
}));
const writeOutboxEventMock = vi.fn().mockResolvedValue({ id: "evt" });
vi.mock("@/server/services/outbox", () => ({
  writeOutboxEvent: writeOutboxEventMock,
  fetchPendingOutboxEvents: vi.fn(),
  markOutboxEventDelivered: vi.fn(),
  markOutboxEventFailed: vi.fn(),
}));
const logAuditMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/server/services/audit", () => ({
  logAudit: logAuditMock,
  audit: { log: vi.fn(), logAndEmit: vi.fn() },
}));

const mockDb = dbAdapterMock;
let fallbackAccounts: any[] = [];
let fallbackTxnEntries: any[] = [];
let fallbackTxnLines: any[] = [];
let fallbackValuations: any[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  resetDbAdapterMock();
  writeOutboxEventMock.mockReset();
  fallbackAccounts = [];
  fallbackTxnEntries = [];
  fallbackTxnLines = [];
  fallbackValuations = [];
  setSelectFallback(({ table }) => {
    if (table === accounts) return fallbackAccounts;
    if (table === txnEntries) return fallbackTxnEntries;
    if (table === txnLines) return fallbackTxnLines;
    if (table === valuationSnapshots) return fallbackValuations;
    return [];
  });
});

// 本文件覆盖账户与记账接口，验证白名单更新、归档、时序查询与跨币种校验等逻辑。
describe("Accounts & Entries routes", () => {
  it("GET /accounts returns list", async () => {
    // 用例：拉取账户列表时应返回 200，且允许空列表场景，不抛出异常。
    mockDb.account.findMany
      .mockResolvedValueOnce([]) // 第一次调用 (workaround query)
      .mockResolvedValueOnce([]); // 第二次调用 (实际查询)
    const m = await import("@/app/api/v1/accounts-ledger/accounts/route");
    const res = await m.GET(makeGet("http://localhost/api/v1/accounts-ledger/accounts"));
    expect(res.status).toBe(200);
  });

  it("POST /accounts creates account with idempotency & audit", async () => {
    // 用例：创建账户需通过幂等键校验，并在成功时写入审计日志。
    mockDb.account.create.mockResolvedValueOnce({ id: "a1", name: "X" });
    mockDb.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    const m = await import("@/app/api/v1/accounts-ledger/accounts/route");
    const res = await m.POST(
      makeJsonRequest(
        "http://localhost/api/v1/accounts-ledger/accounts",
        "POST",
        {
          userId: "u1",
          name: "X",
          accountType: "SAVINGS",
          baseCurrency: "CNY",
        },
        { "Idempotency-Key": "k1" },
      ),
    );
    expect(res.status).toBe(201);
    expect(logAuditMock).toHaveBeenCalled();
  });

  it("PATCH /accounts/:id blocks baseCurrency change", async () => {
    // 用例：账户基础币种不可修改，若请求包含 baseCurrency 则返回 400。
    mockDb.account.findUnique.mockResolvedValueOnce({
      id: "a1",
      userId: "u1",
      baseCurrency: "CNY",
    });
    const m = await import("@/app/api/v1/accounts-ledger/accounts/[id]/route");
    const res = await m.PATCH(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/accounts/a1", "PATCH", {
        baseCurrency: "USD",
      }),
      { params: { id: "a1" } },
    );
    expect(res.status).toBe(400);
  });

  it("POST /accounts/:id/archive updates status", async () => {
    // 用例：归档账户应将状态从 ACTIVE 更新为 ARCHIVED 并返回 200。
    mockDb.account.findUnique.mockResolvedValueOnce({
      id: "a1",
      userId: "u1",
      status: "ACTIVE",
    });
    mockDb.account.update.mockResolvedValueOnce({
      id: "a1",
      status: "ARCHIVED",
    });
    const m = await import("@/app/api/v1/accounts-ledger/accounts/[id]/archive/route");
    const res = await m.POST(
      makeGet("http://localhost/api/v1/accounts-ledger/accounts/a1/archive"),
      { params: { id: "a1" } },
    );
    expect(res.status).toBe(200);
  });

  it("GET /accounts/:id/timeseries valuation points", async () => {
    // 用例：估值时序接口应返回指定区间内的数据点，本例模拟单条估值。
    fallbackAccounts = [{ id: "acc1", userId: "u1" }];
    fallbackValuations = [
      { asOf: new Date("2025-08-01"), totalValue: 100 },
    ];
    const m = await import("@/app/api/v1/accounts-ledger/accounts/[id]/timeseries/route");
    const res = await m.GET(
      makeGet(
        "http://localhost/api/v1/accounts-ledger/accounts/acc1/timeseries?metric=valuation&from=2025-08-01&to=2025-08-31",
      ),
      { params: { id: "acc1" } },
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.points.length).toBe(1);
  });

  it("GET /accounts/:id/timeseries principal point uses toDate filter", async () => {
    // 用例：本金时序需过滤 to 日期之后的分录，确保只统计有效期内金额。
    const m = await import("@/app/api/v1/accounts-ledger/accounts/[id]/timeseries/route");
    // 两条分录：一条在 toDate 之前，一条在之后；应仅计入之前那条
    fallbackAccounts = [{ id: "a", userId: "u1", initialBalance: 100 }];
    fallbackTxnLines = [
      { amount: "10", occurredAt: new Date("2025-08-01T00:00:00Z") },
      { amount: "99", occurredAt: new Date("2025-09-02T00:00:00Z") },
    ];
    const res = await m.GET(
      makeGet(
        "http://localhost/api/v1/accounts-ledger/accounts/a/timeseries?metric=principal&to=2025-09-01",
      ),
      { params: { id: "a" } },
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    // principal = 100 + 10 = 110
    expect(j.points[0].value).toBe(110);
  });

  it("PATCH /accounts/:id success for allowed fields", async () => {
    // 用例：允许更新名称等安全字段，期望返回 200 且新名称写入响应。
    mockDb.account.findUnique.mockResolvedValueOnce({
      id: "a",
      userId: "u1",
      name: "Old",
    });
    mockDb.account.update.mockResolvedValueOnce({ id: "a", name: "New" });
    const route = await import("@/app/api/v1/accounts-ledger/accounts/[id]/route");
    const res = await route.PATCH(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/accounts/a", "PATCH", {
        name: "New",
      }),
      { params: { id: "a" } },
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.name).toBe("New");
  });

  it("POST /entries/deposit 404 when account missing", async () => {
    // 用例：存入操作若账户不存在，应返回 404 并不写入流水。
    mockDb.account.findUnique.mockResolvedValueOnce(null);
    const m = await import("@/app/api/v1/accounts-ledger/entries/deposit/route");
    const res = await m.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/entries/deposit", "POST", {
        accountId: "x",
        amount: 1,
        occurredAt: new Date().toISOString(),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("GET /accounts/:id/transactions returns normalized list", async () => {
    // 用例：交易列表接口应返回归一化后的流水信息，并保留条目数量。
    const module = await import(
      "@/app/api/v1/accounts-ledger/accounts/[id]/transactions/route"
    );
    mockDb.account.findUnique.mockResolvedValueOnce({
      id: "a1",
      userId: "u1",
    });
    mockDb.txnLine.findMany.mockResolvedValueOnce([
      {
        id: "l1",
        entryId: "e1",
        amount: 100,
        currency: "CNY",
        note: "line",
        createdAt: new Date("2024-01-03T10:00:00Z"),
        attachmentUrl: "https://example.com/a.pdf",
        entry: {
          id: "e1",
          type: "DEPOSIT",
          occurredAt: new Date("2024-01-03T09:00:00Z"),
          note: "entry note",
          createdAt: new Date("2024-01-03T09:01:00Z"),
        },
      },
      {
        id: "l2",
        entryId: "e2",
        amount: -50,
        currency: "CNY",
        note: null,
        createdAt: new Date("2024-01-04T10:00:00Z"),
        entry: {
          id: "e2",
          type: "WITHDRAW",
          occurredAt: new Date("2024-01-04T09:00:00Z"),
          note: null,
          createdAt: new Date("2024-01-04T09:01:00Z"),
        },
      },
    ]);
    const res = await module.GET(
      makeGet("http://localhost/api/v1/accounts-ledger/accounts/a1/transactions"),
      { params: { id: "a1" } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0].direction).toBe("INFLOW");
    expect(body.items[1].direction).toBe("OUTFLOW");
    expect(body.items[0].attachmentUrl).toBe("https://example.com/a.pdf");
  });

  it("POST /entries/deposit writes idempotency & audit", async () => {
    // 用例：存入成功时需写入幂等记录与审计日志，响应 201。
    mockDb.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockDb.account.findUnique.mockResolvedValueOnce({
      id: "acc1",
      userId: "u1",
      baseCurrency: "CNY",
      initialBalance: 0,
      accountType: "INVESTMENT",
      status: "ACTIVE",
    });
    queueInsertResults(
      { id: "e1" },
      { id: "l1", accountId: "acc1", amount: "100", currency: "CNY" },
    );
    mockDb.txnLine.aggregate.mockResolvedValueOnce({
      _sum: { amount: 100 },
    });
    mockDb.valuationSnapshot.findFirst.mockResolvedValueOnce(null);
    mockDb.valuationSnapshot.upsert.mockResolvedValueOnce(null);
    const m = await import("@/app/api/v1/accounts-ledger/entries/deposit/route");
    const res = await m.POST(
      makeJsonRequest(
        "http://localhost/api/v1/accounts-ledger/entries/deposit",
        "POST",
        {
          accountId: "acc1",
          amount: 100,
          occurredAt: new Date().toISOString(),
          note: "n",
        },
        { "Idempotency-Key": "k2" },
      ),
    );
    expect(res.status).toBe(201);
    expect(logAuditMock).toHaveBeenCalled();
  });

  it("POST /entries/deposit stores attachment url", async () => {
    // 用例：存入时传入附件链接，应写入 TxnLine.attachmentUrl。
    mockDb.account.findUnique.mockResolvedValueOnce({
      id: "acc2",
      userId: "u1",
      baseCurrency: "CNY",
      status: "ACTIVE",
    });
    queueInsertResults(
      { id: "e2" },
      { id: "l2", accountId: "acc2", amount: "50", currency: "CNY" },
    );
    const route = await import("@/app/api/v1/accounts-ledger/entries/deposit/route");
    const attachment = "https://files.example.com/voucher.pdf";
    const res = await route.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/entries/deposit", "POST", {
        accountId: "acc2",
        amount: 50,
        occurredAt: new Date().toISOString(),
        attachmentUrl: attachment,
      }),
    );
    expect(res.status).toBe(201);
    const lineCall = insertCalls.find((call) => call.table === txnLines);
    const lineValues = lineCall?.values as { attachmentUrl?: string };
    expect(lineValues?.attachmentUrl).toBe(attachment);
  });

  it("POST /entries/deposit rejects archived account", async () => {
    // 用例：归档账户禁止继续入账，接口需返回 409。
    mockDb.account.findUnique.mockResolvedValueOnce({
      id: "acc1",
      userId: "u1",
      baseCurrency: "CNY",
      status: "ARCHIVED",
    });
    const route = await import("@/app/api/v1/accounts-ledger/entries/deposit/route");
    const res = await route.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/entries/deposit", "POST", {
        accountId: "acc1",
        amount: 100,
        occurredAt: new Date().toISOString(),
      }),
    );
    expect(res.status).toBe(409);
  });

  it("POST /entries/transfer returns 404 when account missing; cross currency allowed with explicit to.amount", async () => {
    // 用例：转账前需校验账户存在；若双边币种不同且提供目标金额，应正常创建。
    mockDb.account.findUnique.mockResolvedValueOnce(null);
    let m = await import("@/app/api/v1/accounts-ledger/entries/transfer/route");
    let res = await m.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/entries/transfer", "POST", {
        from: { accountId: "a", amount: 10 },
        to: { accountId: "b" },
        occurredAt: new Date().toISOString(),
      }),
    );
    expect(res.status).toBe(404);

    mockDb.account.findUnique
      .mockResolvedValueOnce({ id: "a", userId: "u1", baseCurrency: "USD" })
      .mockResolvedValueOnce({ id: "b", userId: "u1", baseCurrency: "CNY" });
    queueInsertResults(
      { id: "entry1", meta: "{}" },
      { id: "l1", accountId: "a", amount: "-10", currency: "USD" },
      { id: "l2", accountId: "b", amount: "10", currency: "CNY" },
    );
    m = await import("@/app/api/v1/accounts-ledger/entries/transfer/route");
    res = await m.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/entries/transfer", "POST", {
        from: { accountId: "a", amount: 10 },
        to: { accountId: "b", amount: 10 },
        occurredAt: new Date().toISOString(),
      }),
    );
    expect(res.status).toBe(201);
  });

  it("POST /entries/deposit success updates principal via summary", async () => {
    // 用例：存入成功后，账户摘要中的本金应随流水增量更新。
    mockDb.account.findUnique.mockResolvedValueOnce({
      id: "a",
      userId: "u1",
      baseCurrency: "CNY",
    });
    queueInsertResults(
      { id: "e1" },
      { id: "l1", accountId: "a", amount: "10", currency: "CNY" },
    );
    const dep = await import("@/app/api/v1/accounts-ledger/entries/deposit/route");
    const res = await dep.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/entries/deposit", "POST", {
        accountId: "a",
        amount: 10,
        occurredAt: new Date().toISOString(),
      }),
    );
    expect(res.status).toBe(201);
    // 摘要：初始100 + 10 = 110
    fallbackAccounts = [
      {
        id: "a",
        userId: "u1",
        name: "A",
        baseCurrency: "CNY",
        accountType: "SAVINGS",
        status: "ACTIVE",
        subType: null,
        description: null,
        initialBalance: 100,
      },
    ];
    fallbackTxnLines = [
      {
        accountId: "a",
        amount: "10",
        principalDelta: "10",
        occurredAt: new Date("2025-01-01T00:00:00Z"),
      },
    ];
    const summary = await import("@/app/api/v1/accounts-ledger/accounts/[id]/summary/route");
    const resSum = await summary.GET(
      makeGet("http://localhost/api/v1/accounts-ledger/accounts/a/summary"),
      { params: { id: "a" } },
    );
    const j = await resSum.json();
    expect(j.principal).toBe(110);
  });

  it("POST /entries/withdraw success updates principal via summary", async () => {
    // 用例：取出成功后，账户摘要中的本金应减少相应金额。
    mockDb.account.findUnique.mockResolvedValueOnce({
      id: "a",
      userId: "u1",
      baseCurrency: "CNY",
      status: "ACTIVE",
    });
    queueInsertResults(
      { id: "e1" },
      { id: "l1", accountId: "a", amount: "-10", currency: "CNY" },
    );
    const wd = await import("@/app/api/v1/accounts-ledger/entries/withdraw/route");
    const res = await wd.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/entries/withdraw", "POST", {
        accountId: "a",
        amount: 10,
        occurredAt: new Date().toISOString(),
      }),
    );
    expect(res.status).toBe(201);
    // 摘要：初始100 - 10 = 90
    fallbackAccounts = [
      {
        id: "a",
        userId: "u1",
        name: "A",
        baseCurrency: "CNY",
        accountType: "SAVINGS",
        status: "ACTIVE",
        subType: null,
        description: null,
        initialBalance: 100,
      },
    ];
    fallbackTxnLines = [
      {
        accountId: "a",
        amount: "-10",
        principalDelta: "-10",
        occurredAt: new Date("2025-01-01T00:00:00Z"),
      },
    ];
    const summary = await import("@/app/api/v1/accounts-ledger/accounts/[id]/summary/route");
    const resSum = await summary.GET(
      makeGet("http://localhost/api/v1/accounts-ledger/accounts/a/summary"),
      { params: { id: "a" } },
    );
    const j = await resSum.json();
    expect(j.principal).toBe(90);
  });

  it("POST /entries/withdraw stores attachment url", async () => {
    // 用例：取款时的附件链接写入 TxnLine.attachmentUrl。
    mockDb.account.findUnique.mockResolvedValueOnce({
      id: "withdraw-acc",
      userId: "u1",
      baseCurrency: "CNY",
      status: "ACTIVE",
    });
    queueInsertResults(
      { id: "entry-withdraw" },
      { id: "l1", accountId: "withdraw-acc", amount: "-30", currency: "CNY" },
    );
    const route = await import("@/app/api/v1/accounts-ledger/entries/withdraw/route");
    const attachment = "https://files.example.com/withdraw.png";
    const res = await route.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/entries/withdraw", "POST", {
        accountId: "withdraw-acc",
        amount: 30,
        occurredAt: new Date().toISOString(),
        attachmentUrl: attachment,
      }),
    );
    expect(res.status).toBe(201);
    const lineCall = insertCalls.find((call) => call.table === txnLines);
    const lineValues = lineCall?.values as { attachmentUrl?: string };
    expect(lineValues?.attachmentUrl).toBe(attachment);
  });

  it("POST /entries/withdraw rejects archived account", async () => {
    // 用例：归档账户禁止取款，需返回 409。
    mockDb.account.findUnique.mockResolvedValueOnce({
      id: "archived",
      userId: "u1",
      baseCurrency: "CNY",
      status: "ARCHIVED",
    });
    const route = await import("@/app/api/v1/accounts-ledger/entries/withdraw/route");
    const res = await route.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/entries/withdraw", "POST", {
        accountId: "archived",
        amount: 20,
        occurredAt: new Date().toISOString(),
      }),
    );
    expect(res.status).toBe(409);
  });

  it("POST /entries/transfer cross-currency auto convert when to.amount omitted (asOf provided)", async () => {
    // 用例：未提供目标金额时自动调用汇率服务折算，返回的入账金额应与转换结果一致。
    mockDb.account.findUnique
      .mockResolvedValueOnce({ id: "a", userId: "u1", baseCurrency: "USD" })
      .mockResolvedValueOnce({ id: "b", userId: "u1", baseCurrency: "CNY" });
    queueInsertResults(
      { id: "e1", meta: "{}" },
      { id: "l1", accountId: "a", amount: "-10", currency: "USD" },
      { id: "l2", accountId: "b", amount: "70", currency: "CNY" },
    );
    const transfer = await import("@/app/api/v1/accounts-ledger/entries/transfer/route");
    const res = await transfer.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/entries/transfer", "POST", {
        from: { accountId: "a", amount: 10 },
        to: { accountId: "b" },
        asOf: new Date().toISOString(),
        occurredAt: new Date().toISOString(),
      }),
    );
    expect(res.status).toBe(201);
    const lineCalls = insertCalls.filter((call) => call.table === txnLines);
    const toLineValues = lineCalls[1]?.values as { amount?: string };
    // to.amount 使用了 convert 的返回（被 mock 为 70）
    expect(Number(toLineValues?.amount ?? 0)).toBe(70);
  });

  it("POST /entries/transfer rejects archived participants", async () => {
    // 用例：任一账户归档时禁止转账，接口返回 409。
    mockDb.account.findUnique
      .mockResolvedValueOnce({
        id: "from",
        userId: "u1",
        baseCurrency: "USD",
        status: "ARCHIVED",
      })
      .mockResolvedValueOnce({
        id: "to",
        userId: "u1",
        baseCurrency: "CNY",
        status: "ACTIVE",
      });
    const route = await import("@/app/api/v1/accounts-ledger/entries/transfer/route");
    const res = await route.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/entries/transfer", "POST", {
        from: { accountId: "from", amount: 10 },
        to: { accountId: "to" },
        occurredAt: new Date().toISOString(),
      }),
    );
    expect(res.status).toBe(409);
  });

  it("POST /entries/transfer stores attachment url on both lines", async () => {
    // 用例：转账附件链接需同步写入双边流水。
    mockDb.account.findUnique
      .mockResolvedValueOnce({
        id: "from2",
        userId: "u1",
        baseCurrency: "USD",
        status: "ACTIVE",
      })
      .mockResolvedValueOnce({
        id: "to2",
        userId: "u1",
        baseCurrency: "CNY",
        status: "ACTIVE",
      });
    queueInsertResults(
      { id: "entry-attach", meta: "{}" },
      { id: "l1", accountId: "from2", amount: "-10", currency: "USD" },
      { id: "l2", accountId: "to2", amount: "70", currency: "CNY" },
    );
    const route = await import("@/app/api/v1/accounts-ledger/entries/transfer/route");
    const attachment = "https://files.example.com/transfer.pdf";
    const res = await route.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/entries/transfer", "POST", {
        from: { accountId: "from2", amount: 10 },
        to: { accountId: "to2" },
        occurredAt: new Date().toISOString(),
        attachmentUrl: attachment,
      }),
    );
    expect(res.status).toBe(201);
    const lineCalls = insertCalls.filter((call) => call.table === txnLines);
    const attachments = lineCalls.map(
      (call) => (call.values as { attachmentUrl?: string }).attachmentUrl,
    );
    expect(attachments.every((value) => value === attachment)).toBe(true);
  });
});

describe("Account summary route", () => {
  it("computes principal/valuation/profit/roi", async () => {
    // 用例：账户摘要需同时返回本金、估值、收益与 ROI，本例验证综合字段计算。
    fallbackAccounts = [
      {
        id: "acc1",
        userId: "u1",
        name: "Invest",
        baseCurrency: "CNY",
        accountType: "INVESTMENT",
        status: "ACTIVE",
        subType: null,
        description: null,
        initialBalance: 100,
      },
    ];
    fallbackTxnLines = [
      {
        accountId: "acc1",
        amount: "50",
        principalDelta: "50",
        occurredAt: new Date("2025-08-01T00:00:00Z"),
      },
      {
        accountId: "acc1",
        amount: "-10",
        principalDelta: "-10",
        occurredAt: new Date("2025-08-02T00:00:00Z"),
      },
    ];
    fallbackValuations = [
      {
        accountId: "acc1",
        asOf: new Date("2025-08-01"),
        currency: "CNY",
        fxSnapshotId: null,
        fxAppliedRate: "1",
        totalValue: "200",
      },
    ];
    const m = await import("@/app/api/v1/accounts-ledger/accounts/[id]/summary/route");
    const res = await m.GET(
      makeGet("http://localhost/api/v1/accounts-ledger/accounts/acc1/summary"),
      { params: { id: "acc1" } },
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.principal).toBe(140);
    expect(j.valuation).toBe(200);
    expect(j.profit).toBe(60);
  });
});

describe("Entries transfer success case", () => {
  it("same-currency transfer updates principals: A:100→95, B:50→55", async () => {
    // 用例：同币种转账应对双方本金进行增减，确保借贷平衡成立。
    // 1) 执行转账：A->B 5 CNY
    mockDb.account.findUnique
      .mockResolvedValueOnce({ id: "a", userId: "u1", baseCurrency: "CNY" })
      .mockResolvedValueOnce({ id: "b", userId: "u1", baseCurrency: "CNY" });
    queueInsertResults(
      { id: "e1", meta: "{}" },
      { id: "l1", accountId: "a", amount: "-5", currency: "CNY" },
      { id: "l2", accountId: "b", amount: "5", currency: "CNY" },
    );
    const transfer = await import("@/app/api/v1/accounts-ledger/entries/transfer/route");
    const res = await transfer.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/entries/transfer", "POST", {
        from: { accountId: "a", amount: 5 },
        to: { accountId: "b" },
        occurredAt: new Date().toISOString(),
        note: "t",
      }),
    );
    expect(res.status).toBe(201);
    const lineCalls = insertCalls.filter((call) => call.table === txnLines);
    const fromLineValues = lineCalls[0]?.values as { amount?: string };
    const toLineValues = lineCalls[1]?.values as { amount?: string };
    expect(Number(fromLineValues?.amount ?? 0)).toBe(-5);
    expect(Number(toLineValues?.amount ?? 0)).toBe(5);

    const summaryRoute = await import(
      "@/app/api/v1/accounts-ledger/accounts/[id]/summary/route"
    );
    // 2) A 账户摘要：初始100 + (-5) = 95
    fallbackAccounts = [
      {
        id: "a",
        userId: "u1",
        name: "A",
        baseCurrency: "CNY",
        accountType: "SAVINGS",
        status: "ACTIVE",
        subType: null,
        description: null,
        initialBalance: 100,
      },
    ];
    fallbackTxnLines = [
      {
        accountId: "a",
        amount: "-5",
        principalDelta: "-5",
        occurredAt: new Date("2025-01-01T00:00:00Z"),
      },
    ];
    const resA = await summaryRoute.GET(
      makeGet("http://localhost/api/v1/accounts-ledger/accounts/a/summary"),
      { params: { id: "a" } },
    );
    const sjA = await resA.json();
    expect(sjA.principal).toBe(95);

    // 3) B 账户摘要：初始50 + 5 = 55
    fallbackAccounts = [
      {
        id: "b",
        userId: "u1",
        name: "B",
        baseCurrency: "CNY",
        accountType: "SAVINGS",
        status: "ACTIVE",
        subType: null,
        description: null,
        initialBalance: 50,
      },
    ];
    fallbackTxnLines = [
      {
        accountId: "b",
        amount: "5",
        principalDelta: "5",
        occurredAt: new Date("2025-01-01T00:00:00Z"),
      },
    ];
    const resB = await summaryRoute.GET(
      makeGet("http://localhost/api/v1/accounts-ledger/accounts/b/summary"),
      { params: { id: "b" } },
    );
    const sjB = await resB.json();
    expect(sjB.principal).toBe(55);
  });
});

describe("Valuations routes", () => {
  it("POST /valuations forbids SAVINGS", async () => {
    // 用例：储蓄账户不允许录入估值，接口需返回 400 阻止操作。
    const route = await import("@/app/api/v1/accounts-ledger/valuations/route");
    mockDb.account.findUnique.mockResolvedValueOnce({
      id: "a",
      userId: "u1",
      accountType: "SAVINGS",
      baseCurrency: "CNY",
    });
    const res = await route.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/valuations", "POST", {
        accountId: "a",
        asOf: "2025-08-01",
        totalValue: 100,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("POST /valuations ok for INVESTMENT and ROI computed in summary", async () => {
    // 用例：投资账户允许录入估值，并能在摘要中映射到 ROI 指标。
    const route = await import("@/app/api/v1/accounts-ledger/valuations/route");
    mockDb.account.findUnique.mockResolvedValueOnce({
      id: "a",
      userId: "u1",
      accountType: "INVESTMENT",
      baseCurrency: "CNY",
    });
    queueInsertResults({ id: "v1" });
    const res = await route.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/valuations", "POST", {
        accountId: "a",
        asOf: "2025-08-01",
        totalValue: 120,
      }),
    );
    expect(res.status).toBe(201);

    const summary = await import("@/app/api/v1/accounts-ledger/accounts/[id]/summary/route");
    const acc = {
      id: "a",
      userId: "u1",
      name: "Invest",
      baseCurrency: "CNY",
      accountType: "INVESTMENT",
      initialBalance: 100,
      txnLines: [],
      valuations: [
        {
          asOf: new Date("2025-08-01"),
          currency: "CNY",
          fxSnapshotId: null,
          fxAppliedRate: 1,
          totalValue: 120,
        },
      ],
    };
    fallbackAccounts = [
      {
        ...acc,
        status: "ACTIVE",
        subType: null,
        description: null,
      },
    ];
    fallbackValuations = [
      {
        accountId: "a",
        asOf: new Date("2025-08-01"),
        currency: "CNY",
        fxSnapshotId: null,
        fxAppliedRate: "1",
        totalValue: "120",
      },
    ];
    const resSum = await summary.GET(
      makeGet("http://localhost/api/v1/accounts-ledger/accounts/a/summary"),
      { params: { id: "a" } },
    );
    const j = await resSum.json();
    expect(j.valuation).toBe(120);
    expect(j.roi).toBeCloseTo(0.2);
  });

  it("POST /valuations 404 when account not found", async () => {
    // 用例：估值录入时若账户不存在，应返回 404 避免写入孤儿数据。
    const route = await import("@/app/api/v1/accounts-ledger/valuations/route");
    mockDb.account.findUnique.mockResolvedValueOnce(null);
    const res = await route.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/valuations", "POST", {
        accountId: "not-exist",
        asOf: "2025-08-01",
        totalValue: 100,
      }),
    );
    expect(res.status).toBe(404);
  });

  it("POST /valuations invalid body -> 400", async () => {
    // 用例：缺少必填字段（asOf）时，接口应返回 400 并提示参数错误。
    const route = await import("@/app/api/v1/accounts-ledger/valuations/route");
    const res = await route.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/valuations", "POST", {
        accountId: "a",
        totalValue: 100,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("POST /valuations rejects archived account", async () => {
    // 用例：归档账户禁止新增估值，返回 409。
    const route = await import("@/app/api/v1/accounts-ledger/valuations/route");
    mockDb.account.findUnique.mockResolvedValueOnce({
      id: "archived",
      userId: "u1",
      accountType: "INVESTMENT",
      baseCurrency: "CNY",
      status: "ARCHIVED",
    });
    const res = await route.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/valuations", "POST", {
        accountId: "archived",
        asOf: "2025-08-01",
        totalValue: 120,
      }),
    );
    expect(res.status).toBe(409);
  });
});
