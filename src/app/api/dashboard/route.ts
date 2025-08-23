import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { normalizeTaxParamsValue, TaxConfigRepository, TaxService } from "@/lib/tax";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year")) || new Date().getFullYear();
    const city = searchParams.get("city") || "Hangzhou";

    // ==================== 收入数据计算 ====================
    // 使用与收入汇总API相同的逻辑来获取准确的收入数据
    const incomeRecords = await prisma.incomeRecord.findMany({
      where: { userId, year },
      orderBy: { month: "asc" },
    });

    let incomeData = {
      monthlyIncome: 0,
      annualIncome: 0,
      annualTax: 0,
      annualNetIncome: 0,
    };

    if (incomeRecords.length > 0) {
      // 获取税务参数
      const cfg = await prisma.config.findFirst({
        where: { key: `tax:${city}:${year}` },
        orderBy: { effectiveFrom: "desc" },
      });

      if (cfg) {
        try {
          const params = normalizeTaxParamsValue(cfg.value as string);

          // 使用税务服务计算准确的收入数据
          const svc = new TaxService(new TaxConfigRepository(prisma));
          const months = incomeRecords.map((record: any) => ({
            year: record.year,
            month: record.month,
            gross: Number(record.gross),
            bonus: record.bonus ? Number(record.bonus) : 0,
          }));

          const results = await svc.calculateForecastWithholdingCumulative({
            userId,
            months,
          });

          // 计算年度汇总
          let totalGross = 0;
          let totalBonus = 0;
          let totalTax = 0;
          let totalNet = 0;

          results.forEach((result, index) => {
            const record = incomeRecords[index];
            totalGross += Number(record.gross);
            totalBonus += record.bonus ? Number(record.bonus) : 0;
            totalTax += result.taxThisMonth;
            totalNet += result.net;
          });

          // 获取本月收入
          const currentDate = new Date();
          const currentMonthRecord = incomeRecords.find(
            (record) =>
              record.year === currentDate.getFullYear() &&
              record.month === currentDate.getMonth() + 1,
          );
          const monthlyIncome = currentMonthRecord ? Number(currentMonthRecord.gross || 0) : 0;

          incomeData = {
            monthlyIncome,
            annualIncome: totalGross + totalBonus,
            annualTax: totalTax,
            annualNetIncome: totalNet,
          };
        } catch (err) {
          // 如果税务计算失败，使用简化计算
          console.error("Tax calculation error:", err);
          const totalGross = incomeRecords.reduce(
            (sum, record) => sum + Number(record.gross || 0),
            0,
          );
          const totalBonus = incomeRecords.reduce(
            (sum, record) => sum + Number(record.bonus || 0),
            0,
          );
          const totalTax = incomeRecords.reduce(
            (sum, record) => sum + Number(record.incomeTax || 0),
            0,
          );
          const totalNet = incomeRecords.reduce(
            (sum, record) => sum + Number(record.netIncome || 0),
            0,
          );

          const currentDate = new Date();
          const currentMonthRecord = incomeRecords.find(
            (record) =>
              record.year === currentDate.getFullYear() &&
              record.month === currentDate.getMonth() + 1,
          );
          const monthlyIncome = currentMonthRecord ? Number(currentMonthRecord.gross || 0) : 0;

          incomeData = {
            monthlyIncome,
            annualIncome: totalGross + totalBonus,
            annualTax: totalTax,
            annualNetIncome: totalNet,
          };
        }
      } else {
        // 没有税务配置时的简化计算
        const totalGross = incomeRecords.reduce(
          (sum, record) => sum + Number(record.gross || 0),
          0,
        );
        const totalBonus = incomeRecords.reduce(
          (sum, record) => sum + Number(record.bonus || 0),
          0,
        );

        const currentDate = new Date();
        const currentMonthRecord = incomeRecords.find(
          (record) =>
            record.year === currentDate.getFullYear() &&
            record.month === currentDate.getMonth() + 1,
        );
        const monthlyIncome = currentMonthRecord ? Number(currentMonthRecord.gross || 0) : 0;

        incomeData = {
          monthlyIncome,
          annualIncome: totalGross + totalBonus,
          annualTax: 0,
          annualNetIncome: totalGross + totalBonus, // 假设没有税收
        };
      }
    }

    // ==================== 投资数据计算 ====================
    // 使用与账户API相同的逻辑来获取投资数据
    const accounts = await prisma.account.findMany({
      where: { userId, status: "ACTIVE" },
      include: {
        snapshots: {
          orderBy: { asOf: "desc" },
          take: 2, // 获取最新两个快照来计算变化
        },
      },
    });

    let totalInvestmentValue = 0;
    let monthlyPnl = 0;

    for (const account of accounts) {
      const latestSnapshot = account.snapshots[0];
      const previousSnapshot = account.snapshots[1];

      if (latestSnapshot) {
        const currentValue = Number(latestSnapshot.totalValue);
        totalInvestmentValue += currentValue;

        // 计算相对于上个快照的变化作为近期盈亏
        if (previousSnapshot) {
          const previousValue = Number(previousSnapshot.totalValue);
          monthlyPnl += currentValue - previousValue;
        }
      }
    }

    // 计算年化收益率（基于近期变化的简化估算）
    const annualReturn =
      totalInvestmentValue > 0 && monthlyPnl !== 0 ? (monthlyPnl / totalInvestmentValue) * 100 : 0;

    // ==================== 财务健康度指标 ====================
    const savingsRate =
      incomeData.annualIncome > 0
        ? (incomeData.annualNetIncome / incomeData.annualIncome) * 100
        : 0;

    const totalAssets = incomeData.annualIncome + totalInvestmentValue;
    const investmentRatio = totalAssets > 0 ? (totalInvestmentValue / totalAssets) * 100 : 0;

    const result = {
      income: {
        monthlyIncome: incomeData.monthlyIncome,
        annualIncome: incomeData.annualIncome,
        annualTax: incomeData.annualTax,
        annualNetIncome: incomeData.annualNetIncome,
      },
      investment: {
        totalValue: totalInvestmentValue,
        todayPnl: 0, // 需要更复杂的逻辑来计算当日盈亏
        monthlyPnl: monthlyPnl,
        annualReturn: annualReturn,
      },
      financialHealth: {
        savingsRate,
        investmentRatio,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Dashboard GET error:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
