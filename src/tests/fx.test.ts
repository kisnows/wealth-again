import { beforeAll, describe, expect, it } from "vitest";
import { convert, getRate } from "@/lib/fx";
import { prisma } from "@/lib/prisma";

describe("fx conversion", () => {
  beforeAll(async () => {
    await prisma.fxRate.deleteMany({});
    await prisma.fxRate.createMany({
      data: [
        {
          base: "USD",
          quote: "CNY",
          asOf: new Date("2025-01-01"),
          rate: 7.0 as any,
        },
        {
          base: "EUR",
          quote: "USD",
          asOf: new Date("2025-01-01"),
          rate: 1.1 as any,
        },
      ],
    });
  });

  it("finds direct rate within tolerance", async () => {
    const r = await getRate(prisma as any, {
      from: "USD",
      to: "CNY",
      asOf: new Date("2025-01-15"),
      toleranceDays: 30,
    });
    expect(r).toBeCloseTo(7.0, 5);
  });

  it("falls back to reverse rate when direct missing", async () => {
    const r = await getRate(prisma as any, {
      from: "USD",
      to: "EUR",
      asOf: new Date("2025-01-15"),
      toleranceDays: 30,
    });
    // reverse of 1.1 is ~0.90909
    expect(r).toBeGreaterThan(0.9);
    expect(r).toBeLessThan(0.92);
  });

  it("convert amount", async () => {
    const v = await convert(prisma as any, 100, "USD", "CNY", new Date("2025-01-10"), 30);
    expect(v).toBeCloseTo(700, 5);
  });

  it("throws when out of tolerance", async () => {
    await expect(
      getRate(prisma as any, {
        from: "USD",
        to: "CNY",
        asOf: new Date("2026-03-01"),
        toleranceDays: 30,
      }),
    ).rejects.toThrow();
  });
});
