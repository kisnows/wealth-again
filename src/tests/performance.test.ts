import { describe, expect, it } from "vitest";
import { computePerformance, twr, xirr } from "@/lib/performance";
import { prisma } from "@/lib/prisma";

describe("performance", () => {
  it("xirr simple", () => {
    const rate = xirr([
      { date: new Date("2024-01-01"), amount: -1000 },
      { date: new Date("2024-12-31"), amount: 1100 },
    ]);
    expect(rate).toBeGreaterThan(0.05);
  });

  it("twr simple", async () => {
    // Create a test account first
    const account = await prisma.account.create({
      data: {
        name: "Test Account",
        userId: "test-user-id", 
        baseCurrency: "CNY",
      },
    });

    // Add some test snapshots
    await prisma.valuationSnapshot.createMany({
      data: [
        {
          accountId: account.id,
          asOf: new Date("2024-01-01"),
          totalValue: "1000",
        },
        {
          accountId: account.id,
          asOf: new Date("2024-06-01"),
          totalValue: "1100",
        },
      ],
    });

    const result = await twr(prisma, account.id);
    expect(result.twr).toBeDefined();
    
    // Cleanup
    await prisma.valuationSnapshot.deleteMany({
      where: { accountId: account.id },
    });
    await prisma.account.delete({ where: { id: account.id } });
  });

  it("computePerformance integration", async () => {
    // Create a test account first
    const account = await prisma.account.create({
      data: {
        name: "Test Account",
        userId: "test-user-id",
        baseCurrency: "CNY",
      },
    });

    // Add some test data
    await prisma.valuationSnapshot.createMany({
      data: [
        {
          accountId: account.id,
          asOf: new Date("2024-01-01"),
          totalValue: "1000",
        },
        {
          accountId: account.id,
          asOf: new Date("2024-12-31"),
          totalValue: "1600",
        },
      ],
    });

    await prisma.transaction.create({
      data: {
        accountId: account.id,
        type: "DEPOSIT",
        tradeDate: new Date("2024-03-01"),
        amount: "200",
        currency: "CNY",
      },
    });

    const perf = await computePerformance(prisma, account.id);
    expect(perf.currentValue).toBe(1600);
    expect(perf.profit).toBeCloseTo(400, 0); // 1600 - 1000 - 200
    
    // Cleanup
    await prisma.transaction.deleteMany({
      where: { accountId: account.id },
    });
    await prisma.valuationSnapshot.deleteMany({
      where: { accountId: account.id },
    });
    await prisma.account.delete({ where: { id: account.id } });
  });
});