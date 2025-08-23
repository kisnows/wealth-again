import { prisma } from "@/lib/prisma";

async function createTestData() {
  try {
    // 获取当前用户ID
    const user = await prisma.user.findFirst({
      where: { email: "yq123@outlook.com" }
    });
    
    if (!user) {
      console.log("User not found");
      return;
    }
    
    const userId = user.id;
    console.log("Creating test data for user:", userId);
    
    // 删除现有数据
    await prisma.$transaction([
      prisma.valuationSnapshot.deleteMany({ where: { account: { userId } } }),
      prisma.transaction.deleteMany({ where: { account: { userId } } }),
      prisma.account.deleteMany({ where: { userId } }),
      prisma.incomeRecord.deleteMany({ where: { userId } })
    ]);
    
    console.log("Deleted existing data");
    
    // 创建收入记录
    const incomeRecords = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    // 创建过去12个月的收入记录
    for (let i = 1; i <= 12; i++) {
      const record = await prisma.incomeRecord.create({
        data: {
          userId,
          city: "Hangzhou",
          year: currentYear,
          month: i,
          gross: 20000, // 固定月薪
          bonus: i === 12 ? 50000 : 0, // 12月有年终奖
          socialInsurance: 2000,
          housingFund: 2400,
          incomeTax: i === 12 ? 3000 : 1500,
          netIncome: i === 12 ? 63500 : 16100,
        }
      });
      incomeRecords.push(record);
    }
    
    console.log("Created income records:", incomeRecords.length);
    
    // 创建投资账户
    const account = await prisma.account.create({
      data: {
        userId,
        name: "招商证券交易账户",
        baseCurrency: "CNY",
        initialBalance: "10000",
      }
    });
    
    console.log("Created account:", account.name);
    
    // 创建交易记录
    const transactions = [];
    
    // 存款示例
    const deposit = await prisma.transaction.create({
      data: {
        accountId: account.id,
        type: "DEPOSIT",
        tradeDate: new Date(currentYear, 2, 15), // 3月15日
        amount: "5000",
        currency: "CNY",
        note: "定期存款"
      }
    });
    transactions.push(deposit);
    
    // 取款示例
    const withdraw = await prisma.transaction.create({
      data: {
        accountId: account.id,
        type: "WITHDRAW",
        tradeDate: new Date(currentYear, 5, 10), // 6月10日
        amount: "2000",
        currency: "CNY",
        note: "应急取款"
      }
    });
    transactions.push(withdraw);
    
    console.log("Created transactions:", transactions.length);
    
    // 创建估值快照
    const snapshots = [];
    
    // 初始快照
    const initialSnapshot = await prisma.valuationSnapshot.create({
      data: {
        accountId: account.id,
        asOf: new Date(currentYear, 0, 1), // 1月1日
        totalValue: "10000"
      }
    });
    snapshots.push(initialSnapshot);
    
    // 月度快照 (避免重复日期)
    for (let i = 1; i <= 12; i++) {
      // 模拟投资增长
      const value = 10000 + (i * 800) + Math.sin(i) * 500;
      const snapshot = await prisma.valuationSnapshot.create({
        data: {
          accountId: account.id,
          asOf: new Date(currentYear, i - 1, 5), // 每月5日
          totalValue: value.toString()
        }
      });
      snapshots.push(snapshot);
    }
    
    // 当前快照
    const currentSnapshot = await prisma.valuationSnapshot.create({
      data: {
        accountId: account.id,
        asOf: new Date(currentYear, 11, 31), // 12月31日
        totalValue: "22000"
      }
    });
    snapshots.push(currentSnapshot);
    
    console.log("Created snapshots:", snapshots.length);
    
    console.log("Test data creation completed successfully!");
  } catch (error) {
    console.error("Error creating test data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();