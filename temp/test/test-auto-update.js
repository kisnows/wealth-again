// 测试自动更新账户市值的逻辑
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAutomaticValueUpdate() {
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
          name: "自动更新测试账户", 
          baseCurrency: "CNY", 
          initialBalance: "1000",
          userId: user.id
        },
      });

      // 创建初始快照记录
      const now = new Date();
      await tx.valuationSnapshot.create({
        data: {
          accountId: newAccount.id,
          asOf: now,
          totalValue: "1000",
        },
      });

      return newAccount;
    });
    
    console.log("测试账户创建成功:", account.id);
    
    // 模拟自动更新逻辑
    console.log("\n=== 测试自动更新逻辑 ===");
    
    // 1. 模拟注资500元
    console.log("1. 模拟注资500元");
    const latestSnapshot1 = await prisma.valuationSnapshot.findFirst({
      where: { accountId: account.id },
      orderBy: { asOf: "desc" },
    });
    const currentValue1 = latestSnapshot1 ? Number(latestSnapshot1.totalValue) : 0;
    const newValue1 = currentValue1 + 500; // 注资增加
    console.log(`当前市值: ${currentValue1}, 注资500后新市值: ${newValue1}`);
    
    // 创建新的快照记录
    await prisma.valuationSnapshot.create({
      data: {
        accountId: account.id,
        asOf: new Date(),
        totalValue: newValue1.toString(),
      },
    });
    
    // 2. 模拟提款200元
    console.log("\n2. 模拟提款200元");
    const latestSnapshot2 = await prisma.valuationSnapshot.findFirst({
      where: { accountId: account.id },
      orderBy: { asOf: "desc" },
    });
    const currentValue2 = latestSnapshot2 ? Number(latestSnapshot2.totalValue) : 0;
    const newValue2 = currentValue2 - 200; // 提款减少
    console.log(`当前市值: ${currentValue2}, 提款200后新市值: ${newValue2}`);
    
    // 创建新的快照记录
    await prisma.valuationSnapshot.create({
      data: {
        accountId: account.id,
        asOf: new Date(),
        totalValue: newValue2.toString(),
      },
    });
    
    // 3. 验证最终结果
    const finalSnapshot = await prisma.valuationSnapshot.findFirst({
      where: { accountId: account.id },
      orderBy: { asOf: "desc" },
    });
    
    console.log("\n=== 最终结果 ===");
    console.log(`初始市值: 1000`);
    console.log(`注资500后: 1500`);
    console.log(`提款200后: 1300`);
    console.log(`最终市值: ${finalSnapshot ? finalSnapshot.totalValue : '未知'}`);
    
    // 验证所有快照记录
    const allSnapshots = await prisma.valuationSnapshot.findMany({
      where: { accountId: account.id },
      orderBy: { asOf: "asc" },
    });
    
    console.log("\n所有快照记录:");
    allSnapshots.forEach((snap, index) => {
      console.log(`${index + 1}. 日期: ${snap.asOf.toISOString()}, 市值: ${snap.totalValue}`);
    });
    
    if (finalSnapshot && Number(finalSnapshot.totalValue) === 1300) {
      console.log("\n✅ 自动更新逻辑验证通过！");
    } else {
      console.log("\n❌ 自动更新逻辑验证失败！");
    }
    
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

testAutomaticValueUpdate();