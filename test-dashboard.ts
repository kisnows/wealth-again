import { prisma } from "@/lib/prisma";

async function testDashboard() {
  try {
    // 模拟获取用户ID（使用测试数据中的用户）
    const user = await prisma.user.findFirst({
      where: { email: "yq123@outlook.com" }
    });
    
    if (!user) {
      console.log("User not found");
      return;
    }
    
    const userId = user.id;
    console.log("User ID:", userId);
    
    const year = new Date().getFullYear();
    console.log("Year:", year);

    // 获取收入数据
    const incomeRecords = await prisma.incomeRecord.findMany({
      where: { userId, year },
      orderBy: { month: "asc" },
    });
    console.log("Income records count:", incomeRecords.length);

    // 计算收入统计数据
    const annualIncome = incomeRecords.reduce((sum, record) => sum + Number(record.gross || 0), 0);
    const annualBonus = incomeRecords.reduce((sum, record) => sum + Number(record.bonus || 0), 0);
    const annualTax = incomeRecords.reduce((sum, record) => sum + Number(record.incomeTax || 0), 0);
    const annualNetIncome = incomeRecords.reduce((sum, record) => sum + Number(record.netIncome || 0), 0);
    
    // 获取本月收入
    const currentDate = new Date();
    const currentMonthRecord = incomeRecords.find(
      record => record.year === currentDate.getFullYear() && record.month === (currentDate.getMonth() + 1)
    );
    const monthlyIncome = currentMonthRecord ? Number(currentMonthRecord.gross || 0) : 0;

    // 获取投资账户数据
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
    console.log("Accounts count:", accounts.length);

    // 预先获取所有账户的月初快照
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
    console.log("Month start snapshots count:", monthStartSnapshots.length);

    // 按账户ID组织快照数据
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

    // 计算年度收益率
    const annualReturn = totalInvestmentValue > 0 ? (monthlyPnl * 12) / totalInvestmentValue : 0;

    // 计算财务健康度指标
    // 储蓄率 = 年度税后收入 / 年度税前收入
    const totalGrossIncome = annualIncome + annualBonus;
    const savingsRate = totalGrossIncome > 0 ? (annualNetIncome / totalGrossIncome) * 100 : 0;
    
    // 投资资产占比
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
        todayPnl: 0, // 简化处理
        monthlyPnl,
        annualReturn,
      },
      financialHealth: {
        savingsRate,
        investmentRatio,
      }
    };

    console.log("Dashboard data:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Dashboard test error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testDashboard();