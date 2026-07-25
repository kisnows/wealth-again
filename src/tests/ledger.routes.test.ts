import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGet, makeJsonRequest } from "@/tests/helpers";
import {
  insertCalls,
  queueInsertResults,
  setSelectFallback,
} from "@/tests/helpers/dbMock";
import { dbAdapterMock, resetDbAdapterMock } from "@/tests/helpers/dbAdapterMock";
import {
  accounts,
  txnEntries,
  txnLines,
  valuationSnapshots,
} from "@/server/db/schema";

const mockDb = dbAdapterMock;
// 跨币种自动折算路径中，直接 mock 转换函数，避免依赖汇率表
const mockFxSnapshotDate = new Date("2025-01-01T00:00:00.000Z");

const convertMock = vi.fn();
const ensureFxSnapshotBatchMock = vi.fn(async () => []);
vi.mock("@/server/services/fx/provider", () => ({
  convert: convertMock,
  ensureFxSnapshotBatch: ensureFxSnapshotBatchMock,
}));
// Mock 认证函数，返回测试用户
vi.mock("@/server/utils/auth", () => ({
  getUserFromRequest: vi.fn().mockResolvedValue({ id: "u1" }),
}));
const writeOutboxEventMock = vi.fn().mockResolvedValue({ id: "evt" });
vi.mock("@/server/services/outbox", () => ({
  writeOutboxEvent: writeOutboxEventMock,
  writeOutboxEventSync: vi.fn(),
  fetchPendingOutboxEvents: vi.fn(),
  markOutboxEventDelivered: vi.fn(),
  markOutboxEventFailed: vi.fn(),
}));
const logAuditMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/server/services/audit", () => ({
  logAudit: logAuditMock,
  audit: { log: vi.fn(), logAndEmit: vi.fn() },
}));

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
  convertMock.mockResolvedValue({
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
        sourceRateId: null,
        capturedAt: mockFxSnapshotDate,
      },
    ],
  });
  ensureFxSnapshotBatchMock.mockResolvedValue([]);
});

// 本文件覆盖账户与记账接口，验证白名单更新、归档、时序查询与跨币种校验等逻辑。
describe("Accounts & Entries routes", () => {
  it("GET /accounts returns list", async () => {
    mockDb.account.findMany
      .mockResolvedValueOnce([]) // 第一次调用 (workaround query)
      .mockResolvedValueOnce([]); // 第二次调用 (实际查询)
    const m = await import("@/app/api/v1/accounts-ledger/accounts/route");
    const res = await m.GET(makeGet("http://localhost/api/v1/accounts-ledger/accounts"));
    expect(res.status).toBe(200);
  });

  it("POST /accounts creates account with idempotency & audit", async () => {
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
    fallbackAccounts = [{ id: "acc1", userId: "u1" }];
    fallbackValuations = [
      { accountId: "acc1", asOf: new Date("2025-08-01"), totalValue: 100 },
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

  it("POST /entries/deposit writes idempotency & audit", async () => {
    mockDb.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    mockDb.account.findUnique.mockResolvedValueOnce({
      id: "acc1",
      userId: "u1",
      baseCurrency: "CNY",
    });
    queueInsertResults(
      { id: "e1" },
      { id: "l1", accountId: "acc1", amount: "100", currency: "CNY" },
    );
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

  it("POST /entries/transfer returns 404 when account missing; cross currency allowed with explicit to.amount", async () => {
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
    mockDb.account.findUnique.mockResolvedValueOnce({
      id: "a",
      userId: "u1",
      baseCurrency: "CNY",
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

  it("POST /entries/transfer cross-currency auto convert when to.amount omitted (asOf provided)", async () => {
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
    const entryInsert = insertCalls.find((call) => call.table === txnEntries);
    const lineCalls = insertCalls.filter((call) => call.table === txnLines);
    const toLineValues = lineCalls[1]?.values as { amount?: string };
    // to.amount 使用了 convert 的返回（被 mock 为 70）
    expect(Number(toLineValues?.amount ?? 0)).toBe(70);
    const meta = JSON.parse(
      String((entryInsert?.values as { meta?: string })?.meta ?? "{}"),
    );
    expect(meta).toMatchObject({
      fromAmount: 10,
      fromCurrency: "USD",
      toAmount: 70,
      toCurrency: "CNY",
      effectiveRate: 7,
      viaCurrency: "USD",
      rateAtoUsd: 1,
      rateUsdToB: 7,
      fxEffectiveAt: mockFxSnapshotDate.toISOString(),
      rateSnapshots: expect.arrayContaining([
        expect.objectContaining({
          base: "USD",
          quote: "CNY",
          rate: 7,
        }),
      ]),
      asOf: expect.any(String),
    });
  });
});

describe("Account summary route", () => {
  it("computes principal/valuation/profit/roi", async () => {
    fallbackAccounts = [
      {
        id: "acc1",
        userId: "u1",
        name: "Invest",
        baseCurrency: "CNY",
        accountType: "INVESTMENT",
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
    // 1) 执行转账：A->B 5 CNY
    mockDb.account.findUnique
      .mockResolvedValueOnce({ id: "a", userId: "u1", baseCurrency: "CNY" })
      .mockResolvedValueOnce({ id: "b", userId: "u1", baseCurrency: "CNY" });
    convertMock.mockResolvedValueOnce({
      amount: 5,
      effectiveRate: 1,
      viaCurrency: "USD",
      rateAtoUsd: 1,
      rateUsdToB: 1,
      fxEffectiveAt: mockFxSnapshotDate,
      snapshots: [],
    });
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
    const entryInsert = insertCalls.find((call) => call.table === txnEntries);
    const lineCalls = insertCalls.filter((call) => call.table === txnLines);
    const fromLineValues = lineCalls[0]?.values as { amount?: string };
    const toLineValues = lineCalls[1]?.values as { amount?: string };
    expect(Number(fromLineValues?.amount ?? 0)).toBe(-5);
    expect(Number(toLineValues?.amount ?? 0)).toBe(5);
    expect(
      JSON.parse(
        String((entryInsert?.values as { meta?: string })?.meta ?? "{}"),
      ),
    ).toMatchObject({
      fromAmount: 5,
      fromCurrency: "CNY",
      toAmount: 5,
      toCurrency: "CNY",
      effectiveRate: 1,
      viaCurrency: "USD",
      rateAtoUsd: 1,
      rateUsdToB: 1,
      fxEffectiveAt: expect.any(String),
      rateSnapshots: [],
      asOf: null,
    });

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
