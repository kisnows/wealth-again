import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGet, makeJsonRequest } from "@/tests/helpers";
import { queueInsertResults, resetDbMock, setSelectFallback } from "@/tests/helpers/dbMock";
import { accounts, txnLines, valuationSnapshots } from "@/server/db/schema";

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

let fallbackAccounts: any[] = [];
let fallbackTxnLines: any[] = [];
let fallbackValuations: any[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock();
  writeOutboxEventMock.mockReset();
  fallbackAccounts = [];
  fallbackTxnLines = [];
  fallbackValuations = [];
  setSelectFallback(({ table }) => {
    if (table === accounts) return fallbackAccounts;
    if (table === txnLines) return fallbackTxnLines;
    if (table === valuationSnapshots) return fallbackValuations;
    return [];
  });
});

// 覆盖估值接口的两个路径：SAVINGS 禁止、INVESTMENT 允许；并通过摘要验证 ROI。
describe("Valuations routes", () => {
  it("POST /valuations forbids SAVINGS", async () => {
    const route = await import("@/app/api/v1/accounts-ledger/valuations/route");
    fallbackAccounts = [
      {
        id: "a",
        userId: "u1",
        accountType: "SAVINGS",
        baseCurrency: "CNY",
      },
    ];
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
    const route = await import("@/app/api/v1/accounts-ledger/valuations/route");
    fallbackAccounts = [
      {
        id: "a",
        userId: "u1",
        accountType: "INVESTMENT",
        baseCurrency: "CNY",
      },
    ];
    queueInsertResults({ id: "v1" });
    const res = await route.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/valuations", "POST", {
        accountId: "a",
        asOf: "2025-08-01",
        totalValue: 120,
      }),
    );
    expect(res.status).toBe(201);

    // ROI 验证：principal=100，valuation=120 → roi=0.2
    const summary = await import("@/app/api/v1/accounts-ledger/accounts/[id]/summary/route");
    fallbackAccounts = [
      {
        id: "a",
        userId: "u1",
        name: "Invest",
        baseCurrency: "CNY",
        accountType: "INVESTMENT",
        initialBalance: 100,
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
    const route = await import("@/app/api/v1/accounts-ledger/valuations/route");
    fallbackAccounts = [];
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
    const route = await import("@/app/api/v1/accounts-ledger/valuations/route");
    const res = await route.POST(
      makeJsonRequest("http://localhost/api/v1/accounts-ledger/valuations", "POST", {
        accountId: "a",
        totalValue: 100,
      }),
    );
    expect(res.status).toBe(400);
  });
});
