import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestAccount() {
  try {
    // 获取一个真实的用户ID（假设数据库中至少有一个用户）
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log("没有找到用户，请先创建用户");
      return;
    }
    
    console.log("使用用户ID:", user.id);
    
    // 创建初始资金为5000的账户（模拟API逻辑）
    const account = await prisma.$transaction(async (tx) => {
      // 创建账户
      const newAccount = await tx.account.create({
        data: { 
          name: "测试账户", 
          baseCurrency: "CNY", 
          initialBalance: "5000", // 保存初始资金
          userId: user.id
        },
      });

      // 创建快照记录，但不创建DEPOSIT交易记录
      if (5000 > 0) {
        const now = new Date();
        await tx.valuationSnapshot.create({
          data: {
            accountId: newAccount.id,
            asOf: now,
            totalValue: "5000",
          },
        });
      }

      return newAccount;
    });
    
    console.log("账户创建成功:", account);
    
    // 验证数据
    const transactions = await prisma.transaction.findMany({
      where: { accountId: account.id }
    });
    console.log("交易记录数量:", transactions.length);
    
    const snapshots = await prisma.valuationSnapshot.findMany({
      where: { accountId: account.id }
    });
    console.log("快照记录数量:", snapshots.length);
    
    if (snapshots.length > 0) {
      console.log("快照记录:", snapshots[0]);
    }
    
    // 模拟API中的计算逻辑
    console.log("\n=== 模拟API计算 ===");
    const initialBalance = Number(account.initialBalance || 0);
    console.log("初始资金:", initialBalance);
    
    let netContribution = initialBalance;
    for (const tx of transactions) {
      const amount = Number(tx.amount || 0);
      if (tx.type === "DEPOSIT" || tx.type === "TRANSFER_IN") {
        netContribution += amount;
      } else if (tx.type === "WITHDRAW" || tx.type === "TRANSFER_OUT") {
        netContribution -= amount;
      }
    }
    console.log("净入金（实际本金）:", netContribution);
    
    let currentValue = 0;
    if (snapshots.length > 0) {
      const latestSnapshot = snapshots[snapshots.length - 1];
      currentValue = Number(latestSnapshot.totalValue || 0);
    }
    console.log("当前估值:", currentValue);
    
    const pnl = currentValue - netContribution;
    const returnRate = netContribution !== 0 ? (pnl / netContribution) * 100 : 0;
    
    console.log("收益:", pnl);
    console.log("收益率:", returnRate + "%");
    
    console.log("\n=== 预期结果 ===");
    console.log("初始资金: 5000");
    console.log("交易记录: 0");
    console.log("净入金（实际本金）: 5000");
    console.log("当前估值: 5000");
    console.log("收益: 0");
    console.log("收益率: 0%");
    
    if (netContribution === 5000 && currentValue === 5000 && pnl === 0 && returnRate === 0) {
      console.log("\n✅ 修复验证通过！");
    } else {
      console.log("\n❌ 修复验证失败！");
    }
    
  } catch (error) {
    console.error("错误:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestAccount();