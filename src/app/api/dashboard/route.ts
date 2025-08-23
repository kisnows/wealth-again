import { type NextRequest, NextResponse } from "next/server";
import { calculateAccountPerformance } from "@/lib/performance";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year")) || new Date().getFullYear();

    // 获取收入数据
    const incomeRecords = await prisma.incomeRecord.findMany({
      where: { userId, year },
      orderBy: [{ month: "asc" }],
    });

    // 计算收入统计数据
    const annualIncome = incomeRecords.reduce((sum, record) => sum + Number(record.gross || 0), 0);
    const annualBonus = incomeRecords.reduce((sum, record) => sum + Number(record.bonus || 0), 0);
    const annualTax = incomeRecords.reduce((sum, record) => sum + Number(record.incomeTax || 0), 0);
    const annualNetIncome = incomeRecords.reduce(
      (sum, record) => sum + Number(record.netIncome || 0),
      0,
    );

    // 获取本月收入 (注意：数据库中的月份是1-12，JavaScript的月份是0-11)
    const currentDate = new Date();
    const currentMonthRecord = incomeRecords.find(
      (record) =>
        record.year === currentDate.getFullYear() && record.month === currentDate.getMonth() + 1,
    );
    const monthlyIncome = currentMonthRecord ? Number(currentMonthRecord.gross || 0) : 0;

    // 获取投资账户数据
    const accounts = await prisma.account.findMany({
      where: { userId },
      include: {
        snapshots: {
          orderBy: [{ asOf: "desc" }],
          take: 1,
        },
      },
    });

    // 计算投资统计数据
    let totalInvestmentValue = 0;
    let monthlyPnl = 0;

    // 计算每个账户的收益
    for (const account of accounts) {
      // 使用改进的投资绩效计算方法
      const performance = await calculateAccountPerformance(prisma, account.id);

      // 累加总投资价值
      totalInvestmentValue += performance.currentValue;

      // 计算本月盈亏（简化计算，实际应该更复杂）
      const latestSnapshot = account.snapshots[0];
      if (latestSnapshot) {
        // 这里简化处理，实际应该比较月初和月末的差异
        monthlyPnl += performance.profit;
      }
    }

    // 计算年度收益率 (简化计算，实际应该更复杂)
    const annualReturn = totalInvestmentValue > 0 ? (monthlyPnl * 12) / totalInvestmentValue : 0;

    // 计算财务健康度指标
    // 储蓄率 = 年度税后收入 / 年度税前收入
    const totalGrossIncome = annualIncome + annualBonus;
    const savingsRate = totalGrossIncome > 0 ? (annualNetIncome / totalGrossIncome) * 100 : 0;

    // 投资资产占比 (这里简化为投资总额占总资产的比例)
    const totalAssets = totalGrossIncome + totalInvestmentValue;
    const investmentRatio = totalAssets > 0 ? (totalInvestmentValue / totalAssets) * 100 : 0;

    const result = {
      income: {
        monthlyIncome,
        annualIncome: totalGrossIncome,
        annualTax,
        annualNetIncome,
      },
      investment: {
        totalValue: totalInvestmentValue,
        todayPnl: 0, // 简化处理，实际应该计算当日盈亏
        monthlyPnl,
        annualReturn,
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
