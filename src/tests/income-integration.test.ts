import { describe, it, expect, beforeAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";

const UID = "00000000-0000-0000-0000-000000000001";
const EMAIL = "integration@test.local";

describe("income end-to-end: forms → forecast → calculate → summary", () => {
  beforeAll(async () => {
    // 清理可能存在的 demo 或集成用户，保证测试稳定
    await prisma.user.deleteMany({
      where: { email: { in: [EMAIL, "demo@example.com"] } },
    });
  });

  it("creates change & bonus → forecast marks; calculate saves; annual summary returns", async () => {
    // 0) 清理杭州参数，避免唯一键冲突
    await prisma.taxBracket.deleteMany({ where: { city: "Hangzhou" } });
    await prisma.socialInsuranceConfig.deleteMany({
      where: { city: "Hangzhou" },
    });

    // 1) 准备税务参数：刷新杭州 2025 年
    {
      const url = new URL("http://localhost/api/config/tax-params/refresh");
      url.searchParams.set("city", "Hangzhou");
      url.searchParams.set("year", "2025");
      const req = new Request(url.toString(), { method: "POST" });
      const mod = await import("@/app/api/config/tax-params/refresh/route");
      const res = await mod.POST(req as any);
      expect((res as any).status).toBe(200);
    }

    // 2) 创建工资变更（1 月生效），不传 userId，走 ensureUser 创建/复用 demo 用户
    {
      const body = {
        city: "Hangzhou",
        grossMonthly: 20000,
        effectiveFrom: "2025-01-31",
      };
      const req = new Request("http://localhost/api/income/changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const mod = await import("@/app/api/income/changes/route");
      const res = await mod.POST(req as any);
      expect((await (res as any).json()).id).toBeTypeOf("string");
    }

    // 3) 创建 3 月奖金（自动归一到 3 月月末）
    {
      // 获取 ensureUser 创建的用户ID（demo）
      const current = await prisma.user.findFirst();
      const currentUid = current!.id;
      vi.resetModules();
      vi.doMock("@/lib/session", () => ({
        getCurrentUser: async () => currentUid,
      }));
      const body = {
        city: "Hangzhou",
        amount: 5000,
        effectiveDate: "2025-03-02",
      };
      const req = new Request("http://localhost/api/income/bonus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const mod = await import("@/app/api/income/bonus/route");
      const res = await mod.POST(req as any);
      expect((await (res as any).json()).success).toBe(true);
    }

    // 4) 预测（2025 年）应标注 1 月薪资变动与 3 月奖金
    {
      const url = new URL("http://localhost/api/income/forecast");
      url.searchParams.set("year", "2025");
      url.searchParams.set("city", "Hangzhou");
      const req = new Request(url.toString());
      const mod = await import("@/app/api/income/forecast/route");
      const res = await mod.GET(req as any);
      const data = await (res as any).json();
      const results = data.results as any[];
      expect(results.length).toBeGreaterThan(0);
      const m1 = results.find(
        (r) =>
          (r.ym ||
            `${new Date().getFullYear()}-${String(r.month).padStart(
              2,
              "0"
            )}`) === "2025-01"
      );
      const m3 = results.find(
        (r) =>
          (r.ym ||
            `${new Date().getFullYear()}-${String(r.month).padStart(
              2,
              "0"
            )}`) === "2025-03"
      );
      expect(!!m1?.markers?.salaryChange).toBe(true);
      expect(!!m3?.markers?.bonusPaid).toBe(true);
    }

    // 5) 再次确保税务参数存在（幂等刷新），然后计算 3 月（将保存 IncomeRecord）
    {
      const url = new URL("http://localhost/api/config/tax-params/refresh");
      url.searchParams.set("city", "Hangzhou");
      url.searchParams.set("year", "2025");
      const req0 = new Request(url.toString(), { method: "POST" });
      const refreshMod = await import(
        "@/app/api/config/tax-params/refresh/route"
      );
      await refreshMod.POST(req0 as any);

      const current = await prisma.user.findFirst();
      const body = {
        userId: current!.id,
        city: "Hangzhou",
        year: 2025,
        month: 3,
        gross: 20000,
        bonus: 5000,
        specialDeductions: 0,
        otherDeductions: 0,
        charityDonations: 0,
      };
      const req = new Request("http://localhost/api/income/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const mod = await import("@/app/api/income/calculate/route");
      const res = await mod.POST(req as any);
      const data = await (res as any).json();
      expect(data.success).toBe(true);
      expect(data.data.incomeTax).toBeGreaterThanOrEqual(0);
    }

    // 6) GET 年度汇总（新税务系统路径）
    {
      const url = new URL("http://localhost/api/income/calculate");
      const current = await prisma.user.findFirst();
      url.searchParams.set("userId", current!.id);
      url.searchParams.set("year", "2025");
      const req = new Request(url.toString());
      const mod = await import("@/app/api/income/calculate/route");
      const res = await mod.GET(req as any);
      const data = await (res as any).json();
      expect(data.success).toBe(true);
      expect(data.data.year).toBe(2025);
      expect(data.data.monthCount).toBeGreaterThan(0);
    }

    // 7) GET 汇总（旧 summary 接口，需依赖 Config，已通过 refresh 写入）
    {
      const url = new URL("http://localhost/api/income/summary");
      url.searchParams.set("year", "2025");
      url.searchParams.set("city", "Hangzhou");
      const req = new Request(url.toString());
      const mod = await import("@/app/api/income/summary/route");
      const res = await mod.GET(req as any);
      const data = await (res as any).json();
      expect(Array.isArray(data.records)).toBe(true);
    }
  });
});
