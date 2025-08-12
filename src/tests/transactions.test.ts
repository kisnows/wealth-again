import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

describe("transactions api basic", () => {
  it("create and list a cash in", async () => {
    const user = await prisma.user.findFirst();
    const acc = await prisma.account.create({
      data: {
        userId: user!.id,
        name: `acc-${Date.now()}`,
        baseCurrency: "CNY",
      },
    });
    await prisma.transaction.create({
      data: {
        accountId: acc.id,
        type: "CASH_IN",
        tradeDate: new Date(),
        cashAmount: "1000",
        currency: "CNY",
      },
    });
    const list = await prisma.transaction.findMany({
      where: { accountId: acc.id },
    });
    expect(list.length).toBeGreaterThan(0);
  });
});
