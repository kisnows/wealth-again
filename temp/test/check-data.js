import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  try {
    // 查看所有账户
    const accounts = await prisma.account.findMany();
    console.log('Accounts:', accounts);

    // 如果有账户，查看第一个账户的交易和快照
    if (accounts.length > 0) {
      const accountId = accounts[0].id;
      
      // 查看交易记录
      const transactions = await prisma.transaction.findMany({
        where: { accountId }
      });
      console.log('Transactions:', transactions);

      // 查看快照记录
      const snapshots = await prisma.valuationSnapshot.findMany({
        where: { accountId }
      });
      console.log('Snapshots:', snapshots);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();