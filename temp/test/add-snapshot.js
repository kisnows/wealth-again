import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addSnapshot() {
  try {
    // 获取第一个账户
    const accounts = await prisma.account.findMany();
    if (accounts.length > 0) {
      const accountId = accounts[0].id;
      
      // 添加一个快照记录
      const snapshot = await prisma.valuationSnapshot.create({
        data: {
          accountId: accountId,
          asOf: new Date(),
          totalValue: 5000, // 设置为5000，与注资金额一致
        }
      });
      
      console.log('Snapshot created:', snapshot);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addSnapshot();