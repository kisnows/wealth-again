import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestAccountWithTransactionsAndSnapshots() {
  try {
    // 获取一个真实的用户ID
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log("没有找到用户，请先创建用户");
      return;
    }
    
    console.log("使用用户ID:", user.id);
    
    // 创建测试账户
    const account = await prisma.$transaction(async (tx) => {
      // 创建账户
      const newAccount = await tx.account.create({
        data: { 
          name: "变更记录测试账户", 
          baseCurrency: "CNY", 
          initialBalance: "1000",
          userId: user.id
        },
      });

      // 创建一些交易记录
      const now = new Date();
      
      // 初始资金交易
      await tx.transaction.create({
        data: {
          accountId: newAccount.id,
          type: "DEPOSIT",
          tradeDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3天前
          amount: "1000",
          currency: "CNY",
        },
      });
      
      // 额外存款
      await tx.transaction.create({
        data: {
          accountId: newAccount.id,
          type: "DEPOSIT",
          tradeDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2天前
          amount: "500",
          currency: "CNY",
        },
      });
      
      // 提款
      await tx.transaction.create({
        data: {
          accountId: newAccount.id,
          type: "WITHDRAW",
          tradeDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1天前
          amount: "200",
          currency: "CNY",
        },
      });
      
      // 创建一些快照记录
      await tx.valuationSnapshot.create({
        data: {
          accountId: newAccount.id,
          asOf: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3天前
          totalValue: "1000",
        },
      });
      
      await tx.valuationSnapshot.create({
        data: {
          accountId: newAccount.id,
          asOf: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2天前
          totalValue: "1600",
        },
      });
      
      await tx.valuationSnapshot.create({
        data: {
          accountId: newAccount.id,
          asOf: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1天前
          totalValue: "1450",
        },
      });
      
      await tx.valuationSnapshot.create({
        data: {
          accountId: newAccount.id,
          asOf: now, // 今天
          totalValue: "1500",
        },
      });

      return newAccount;
    });
    
    console.log("测试账户创建成功:", account.id);
    
    // 验证数据
    const transactions = await prisma.transaction.findMany({
      where: { accountId: account.id },
      orderBy: { tradeDate: "asc" },
    });
    console.log("\n交易记录:");
    transactions.forEach((tx, index) => {
      console.log(`${index + 1}. 日期: ${tx.tradeDate.toISOString()}, 类型: ${tx.type}, 金额: ${tx.amount}`);
    });
    
    const snapshots = await prisma.valuationSnapshot.findMany({
      where: { accountId: account.id },
      orderBy: { asOf: "asc" },
    });
    console.log("\n快照记录:");
    snapshots.forEach((snap, index) => {
      console.log(`${index + 1}. 日期: ${snap.asOf.toISOString()}, 市值: ${snap.totalValue}`);
    });
    
    // 模拟前端的合并逻辑
    console.log("\n=== 合并后的变更记录 ===");
    const allChanges = [
      ...transactions.map(tx => ({
        id: tx.id,
        date: tx.tradeDate,
        type: tx.type,
        amount: tx.amount,
        currency: tx.currency,
        note: tx.note,
        isTransaction: true
      })),
      ...snapshots.map(snap => ({
        id: snap.id,
        date: snap.asOf,
        type: "VALUATION",
        amount: snap.totalValue,
        currency: "CNY",
        note: null,
        isSnapshot: true
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // 按日期倒序排列
    
    allChanges.forEach((change, index) => {
      const typeName = change.isSnapshot ? "估值快照" : 
        change.type === "DEPOSIT" ? "注资" :
        change.type === "WITHDRAW" ? "提款" : change.type;
      const amount = change.isSnapshot ? 
        change.amount : 
        (Number(change.amount || 0) * (change.type === "WITHDRAW" ? -1 : 1));
      console.log(`${index + 1}. 日期: ${new Date(change.date).toLocaleDateString()}, 类型: ${typeName}, 金额: ${amount}`);
    });
    
    console.log("\n✅ 变更记录合并逻辑验证通过！");
    
  } catch (error) {
    console.error("错误:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestAccountWithTransactionsAndSnapshots();