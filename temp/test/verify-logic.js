// 测试脚本：验证账户创建和性能计算逻辑
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAccountCreationAndPerformance() {
  try {
    console.log("=== 开始测试 ===");
    
    // 1. 模拟创建一个初始资金为5000的账户
    const userId = "test-user-id"; // 实际使用时需要替换为真实用户ID
    
    console.log("1. 创建初始资金为5000的账户...");
    const account = await prisma.account.create({
      data: {
        name: "测试账户",
        baseCurrency: "CNY",
        initialBalance: "5000",
        userId: userId
      }
    });
    console.log("账户创建成功:", account.id);
    
    // 2. 创建快照记录（模拟账户详情页面的快照操作）
    console.log("2. 创建快照记录...");
    const snapshot = await prisma.valuationSnapshot.create({
      data: {
        accountId: account.id,
        asOf: new Date(),
        totalValue: "5000"
      }
    });
    console.log("快照创建成功");
    
    // 3. 模拟性能API的计算逻辑
    console.log("3. 模拟性能API计算...");
    
    // 获取账户初始资金
    const initialBalance = Number(account.initialBalance || 0);
    console.log("初始资金:", initialBalance);
    
    // 获取所有交易记录（这里应该为空，因为我们没有创建任何交易）
    const transactions = await prisma.transaction.findMany({
      where: { accountId: account.id },
      orderBy: { tradeDate: "asc" },
    });
    console.log("交易记录数量:", transactions.length);
    
    // 计算净入金（初始资金 + 存款 - 取款）
    let netContribution = initialBalance; // 初始资金作为本金
    for (const tx of transactions) {
      const amount = Number(tx.amount || 0);
      if (tx.type === "DEPOSIT" || tx.type === "TRANSFER_IN") {
        netContribution += amount;
      } else if (tx.type === "WITHDRAW" || tx.type === "TRANSFER_OUT") {
        netContribution -= amount;
      }
    }
    console.log("净入金（实际本金）:", netContribution);
    
    // 获取最新的快照记录作为当前估值
    const latestSnapshot = await prisma.valuationSnapshot.findFirst({
      where: { accountId: account.id },
      orderBy: { asOf: "desc" },
    });
    
    let currentValue = 0;
    if (latestSnapshot) {
      currentValue = Number(latestSnapshot.totalValue || 0);
    }
    console.log("当前估值:", currentValue);
    
    // 计算收益和收益率
    const pnl = currentValue - netContribution;
    const returnRate = netContribution !== 0 ? (pnl / netContribution) * 100 : 0;
    
    console.log("收益:", pnl);
    console.log("收益率:", returnRate + "%");
    
    // 预期结果应该是：
    console.log("\n=== 预期结果 ===");
    console.log("账户总额: 5000 (当前估值)");
    console.log("总收益: 0 (5000 - 5000)");
    console.log("净入金: 5000 (初始资金)");
    console.log("总收益率: 0% (0 / 5000)");
    
    console.log("\n=== 实际结果 ===");
    console.log("账户总额:", currentValue);
    console.log("总收益:", pnl);
    console.log("净入金:", netContribution);
    console.log("总收益率:", returnRate + "%");
    
    // 验证结果
    if (currentValue === 5000 && pnl === 0 && netContribution === 5000 && returnRate === 0) {
      console.log("\n✅ 测试通过！");
    } else {
      console.log("\n❌ 测试失败！");
    }
    
  } catch (error) {
    console.error("测试错误:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testAccountCreationAndPerformance();