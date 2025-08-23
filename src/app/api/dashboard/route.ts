import { NextRequest, NextResponse } from "next/server";
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
      orderBy: { month: "asc" },
    });

    // 计算收入统计数据
    const annualIncome = incomeRecords.reduce((sum, record) => sum + Number(record.gross || 0), 0);
    const annualBonus = incomeRecords.reduce((sum, record) => sum + Number(record.bonus || 0), 0);
    const annualTax = incomeRecords.reduce((sum, record) => sum + Number(record.incomeTax || 0), 0);
    const annualNetIncome = incomeRecords.reduce((sum, record) => sum + Number(record.netIncome || 0), 0);
    
    // 获取本月收入 (注意：数据库中的月份是1-12，JavaScript的月份是0-11)
    const currentDate = new Date();
    const currentMonthRecord = incomeRecords.find(
      record => record.year === currentDate.getFullYear() && record.month === (currentDate.getMonth() + 1)
    );
    const monthlyIncome = currentMonthRecord ? Number(currentMonthRecord.gross || 0) : 0;

    // 获取投资账户数据和月初快照（优化查询，避免在循环中查询数据库）
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const accounts = await prisma.account.findMany({
      where: { userId },
      include: {
        snapshots: {
          orderBy: { asOf: "desc" },
          take: 1,
        },
      }
    });

    // 预先获取所有账户的月初快照，减少数据库查询次数
    const accountIds = accounts.map(account => account.id);
    const monthStartSnapshots = await prisma.valuationSnapshot.findMany({
      where: {
        accountId: { in: accountIds },
        asOf: {
          gte: startOfMonth,
          lt: endOfMonth,
        }
      },
      orderBy: { asOf: "asc" },
    });

    // 按账户ID组织快照数据，提高查找效率
    const snapshotsByAccount: Record<string, any[]> = {};
    for (const snapshot of monthStartSnapshots) {
      if (!snapshotsByAccount[snapshot.accountId]) {
        snapshotsByAccount[snapshot.accountId] = [];
      }
      snapshotsByAccount[snapshot.accountId].push(snapshot);
    }

    // 计算投资统计数据
    let totalInvestmentValue = 0;
    let monthlyPnl = 0;
    
    // 计算每个账户的收益
    for (const account of accounts) {
      // 获取账户最新估值
      const latestSnapshot = account.snapshots[0];
      if (latestSnapshot) {
        const currentValue = Number(latestSnapshot.totalValue || 0);
        totalInvestmentValue += currentValue;
        
        // 获取该账户的月初快照
        const accountMonthStartSnapshots = snapshotsByAccount[account.id] || [];
        const monthStartSnapshot = accountMonthStartSnapshots[0];
        
        if (monthStartSnapshot) {
          const monthStartValue = Number(monthStartSnapshot.totalValue || 0);
          monthlyPnl += currentValue - monthStartValue;
        } else {
          // 如果没有月初快照，使用初始余额作为参考
          const initialValue = Number(account.initialBalance || 0);
          // 只有当当前值不等于初始值时才计算收益
          if (currentValue !== initialValue) {
            monthlyPnl += currentValue - initialValue;
          }
        }
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
      }
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