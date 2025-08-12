import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";

describe("accounts unique name", () => {
  let userId: string;
  beforeAll(async () => {
    const u = await prisma.user.findFirst();
    if (u) userId = u.id;
    else {
      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.hash("demo123", 10);
      const created = await prisma.user.create({
        data: { email: "test@example.com", password: hash, name: "Test" },
      });
      userId = created.id;
    }
  });

  it("same user cannot create duplicate account name", async () => {
    const name = "account-dup";
    // Clean up dependencies, then delete accounts with same name
    const dup = await prisma.account.findMany({ where: { userId, name } });
    const ids = dup.map((a) => a.id);
    if (ids.length) {
      await prisma.transaction.deleteMany({
        where: { accountId: { in: ids } },
      });
      await prisma.valuationSnapshot.deleteMany({
        where: { accountId: { in: ids } },
      });
      await prisma.lot.deleteMany({ where: { accountId: { in: ids } } });
      await prisma.account.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.account.create({
      data: { userId, name, baseCurrency: "CNY" },
    });
    await expect(
      prisma.account.create({ data: { userId, name, baseCurrency: "CNY" } })
    ).rejects.toBeTruthy();
  });
});
