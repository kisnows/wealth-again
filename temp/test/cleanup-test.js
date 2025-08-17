import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupTestData() {
  try {
    // 删除测试账户
    const testAccounts = await prisma.account.findMany({
      where: { 
        name: "变更记录测试账户"
      }
    });
    
    for (const account of testAccounts) {
      console.log(`删除测试账户: ${account.name}`);
      // 删除相关交易记录
      await prisma.transaction.deleteMany({
        where: { accountId: account.id }
      });
      
      // 删除相关快照记录
      await prisma.valuationSnapshot.deleteMany({
        where: { accountId: account.id }
      });
      
      // 删除账户
      await prisma.account.delete({
        where: { id: account.id }
      });
    }
    
    console.log('测试数据清理完成');
  } catch (error) {
    console.error('清理错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupTestData();