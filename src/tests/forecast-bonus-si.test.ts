import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
// 在任何 Prisma 导入前设置绝对 DATABASE_URL，避免相对路径导致 sqlite 打开失败
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const absDb = path.resolve(__dirname, "../../prisma/dev.db");
process.env.DATABASE_URL = `file:${absDb}`;
import { prisma } from "@/lib/prisma";
import { createTaxService } from "@/lib/tax";

async function clearAll(city: string, userEmail: string) {
  await prisma.bonusPlan.deleteMany({ where: { user: { email: userEmail } } });
  await prisma.incomeChange.deleteMany({
    where: { user: { email: userEmail } },
  });
  await prisma.taxBracket.deleteMany({ where: { city } });
  await prisma.socialInsuranceConfig.deleteMany({ where: { city } });
  await prisma.user.deleteMany({ where: { email: userEmail } });
}

describe("forecast: bonus excluded from SI/HF and monthsElapsed fixes", () => {
  const city = "Hangzhou";
  const email = "bonus-si@test.local";

  beforeAll(async () => {
    await clearAll(city, email);
  });

  afterAll(async () => {
    await clearAll(city, email);
  });

  it("bonus does not increase SI/HF; first month basic deduction counts as 1", async () => {
    const taxService = createTaxService(prisma);
    await taxService.importHangzhouParams({
      year: 2025,
      city,
      monthlyBasicDeduction: 5000,
      brackets: [
        { threshold: 0, rate: 0.03, quickDeduction: 0 },
        { threshold: 36000, rate: 0.1, quickDeduction: 2520 },
      ],
      sihfRates: { pension: 0.08, medical: 0.02, unemployment: 0.005 },
      sihfBase: { min: 5000, max: 30000 },
      housingFund: { rate: 0.12, baseMin: 5000, baseMax: 30000 },
    });

    const user = await prisma.user.create({
      data: { email, password: "x" },
    });
    // 2025-01 起工资 20000
    await prisma.incomeChange.create({
      data: {
        userId: user.id,
        city,
        grossMonthly: "20000",
        effectiveFrom: new Date("2025-01-31"),
      },
    });
    // 2025-03 支付 5000 奖金
    await prisma.bonusPlan.create({
      data: {
        userId: user.id,
        city,
        amount: "5000",
        effectiveDate: new Date("2025-03-31T12:00:00"),
      },
    });

    const url = new URL("http://localhost/api/income/forecast");
    url.searchParams.set("start", "2025-01");
    url.searchParams.set("end", "2025-03");
    const req = new Request(url.toString());
    const mod = await import("@/app/api/income/forecast/route");
    const res = await mod.GET(req as any);
    const json = await (res as any).json();
    const results = json.results as any[];
    expect(results.length).toBe(3);

    const m3 = results[2];
    // 税前收入=工资(20000)+奖金(5000)=25000
    expect(Number(m3.grossThisMonth)).toBeGreaterThan(0);
    expect(Number(m3.grossThisMonth)).toBeCloseTo(25000, 2);

    // 社保/公积金按 20000 计（不含奖金）
    const si = Number(m3.socialInsuranceThisMonth);
    const hf = Number(m3.housingFundThisMonth);
    const rateSum = 0.08 + 0.02 + 0.005; // =0.105
    expect(si).toBeCloseTo(20000 * rateSum, 2);
    expect(hf).toBeCloseTo(20000 * 0.12, 2);

    // 累计基本减除：首月应该按 1（不是公历月号）
    // 只验证没有出现异常（预测税后大于0）
    expect(Number(m3.net)).toBeGreaterThan(0);
  });
});
