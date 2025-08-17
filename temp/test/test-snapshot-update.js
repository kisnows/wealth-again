import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestAccountAndSnapshot() {
  try {
    // 获取一个真实的用户ID
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log("没有找到用户，请先创建用户");
      return;
    }
    
    console.log("使用用户ID:", user.id);
    
    // 创建初始资金为5000的账户
    const account = await prisma.$transaction(async (tx) => {
      // 创建账户
      const newAccount = await tx.account.create({
        data: { 
          name: "快照测试账户", 
          baseCurrency: "CNY", 
          initialBalance: "5000",
          userId: user.id
        },
      });

      // 创建快照记录
      const now = new Date();
      await tx.valuationSnapshot.create({
        data: {
          accountId: newAccount.id,
          asOf: now,
          totalValue: "5000",
        },
      });

      return newAccount;
    });
    
    console.log("账户创建成功:", account.id);
    
    // 测试更新快照
    console.log("\n=== 测试更新快照 ===");
    const updateDate = new Date();
    updateDate.setHours(0, 0, 0, 0); // 设置为当天开始
    
    // 模拟API中的新逻辑
    const startOfDay = new Date(updateDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(updateDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log("查找范围:", startOfDay.toISOString(), "到", endOfDay.toISOString());
    
    // 查找同一天内是否已存在快照记录
    const existingSnapshot = await prisma.valuationSnapshot.findFirst({
      where: {
        accountId: account.id,
        asOf: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });
    
    console.log("找到的现有快照:", existingSnapshot);
    
    if (existingSnapshot) {
      // 更新现有记录
      const updatedSnapshot = await prisma.valuationSnapshot.update({
        where: { id: existingSnapshot.id },
        data: {
          totalValue: "6500",
          asOf: updateDate,
        },
      });
      console.log("更新后的快照:", updatedSnapshot);
    }
    
    // 验证结果
    const finalSnapshots = await prisma.valuationSnapshot.findMany({
      where: { accountId: account.id },
      orderBy: { asOf: "asc" },
    });
    
    console.log("\n最终快照记录:");
    finalSnapshots.forEach((snap, index) => {
      console.log(`${index + 1}. ID: ${snap.id}, 日期: ${snap.asOf.toISOString()}, 市值: ${snap.totalValue}`);
    });
    
    // 清理测试数据
    console.log("\n清理测试数据...");
    await prisma.valuationSnapshot.deleteMany({
      where: { accountId: account.id }
    });
    await prisma.account.delete({
      where: { id: account.id }
    });
    console.log("清理完成");
    
  } catch (error) {
    console.error("错误:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestAccountAndSnapshot();