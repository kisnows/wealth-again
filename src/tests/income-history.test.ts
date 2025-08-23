import { beforeAll, describe, expect, it, vi } from "vitest";
import { endOfMonth } from "@/lib/date";
import { prisma } from "@/lib/prisma";

const MOCK_UID = "test-user-1";
const EMAIL = "mock-user@example.com";
vi.mock("@/lib/session", () => ({ getCurrentUser: async () => MOCK_UID }));

describe("income history effective date alignment", () => {
  beforeAll(async () => {
    await prisma.user.upsert({
      where: { email: EMAIL },
      update: {},
      create: { id: MOCK_UID, email: EMAIL, password: "x" },
    });
  });

  it("monthly API sets effective change to month end when not provided", async () => {
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    const year = 2025;
    const month = 2;
    const req = new Request("http://localhost/api/income/monthly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city: "Hangzhou", year, month, gross: 20000 }),
    });
    const mod = await import("@/app/api/income/monthly/route");
    // 模拟 session 的 getCurrentUser：直接写入记录，这里绕过鉴权按 prisma 验证
    await mod.POST(req as any);
    const changes = await prisma.incomeChange.findMany({
      where: { userId: user!.id },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(changes.length).toBe(1);
    const eff = changes[0].effectiveFrom;
    expect(eff.toISOString().slice(0, 10)).toBe(
      endOfMonth(new Date(year, month - 1, 1))
        .toISOString()
        .slice(0, 10),
    );
  });

  it("bonus API normalizes effectiveDate to month end", async () => {
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    const req = new Request("http://localhost/api/income/bonus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: "Hangzhou",
        amount: 5000,
        effectiveDate: "2025-03-02",
      }),
    });
    const mod = await import("@/app/api/income/bonus/route");
    await mod.POST(req as any);
    const list = await prisma.bonusPlan.findMany({
      where: { userId: user!.id },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(list.length).toBe(1);
    const eff = list[0].effectiveDate;
    expect(eff.toISOString().slice(0, 10)).toBe("2025-03-31");
  });
});
