import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

async function makeAccount() {
  const user = await prisma.user.findFirst();
  const acc = await prisma.account.create({
    data: {
      userId: user!.id,
      name: `acc-snap-${Date.now()}`,
      baseCurrency: "CNY",
    },
  });
  return acc.id;
}

describe("snapshots pagination api", () => {
  it("returns paginated snapshots with correct total and pages", async () => {
    const accountId = await makeAccount();
    // 写入 120 条快照
    const start = new Date("2025-01-01");
    const data = [] as any[];
    for (let i = 0; i < 120; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      data.push({
        accountId,
        asOf: d,
        totalValue: (1000 + i) as any,
        breakdown: JSON.stringify({}),
      });
    }
    await prisma.valuationSnapshot.createMany({ data });

    const mod = await import("@/app/api/accounts/[id]/snapshots/route");
    async function fetchPage(page: number, pageSize = 50) {
      const url = `http://localhost/api/accounts/${accountId}/snapshots?page=${page}&pageSize=${pageSize}`;
      const req = new Request(url);
      const res = await mod.GET(req as any, { params: { id: accountId } } as any);
      return (res as any).json();
    }

    const p1 = await fetchPage(1);
    expect(p1.total).toBe(120);
    expect((p1.snapshots || []).length).toBe(50);

    const p2 = await fetchPage(2);
    expect((p2.snapshots || []).length).toBe(50);

    const p3 = await fetchPage(3);
    expect((p3.snapshots || []).length).toBe(20);
  });
});
