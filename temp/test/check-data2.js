import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  try {
    const accounts = await prisma.account.findMany();
    console.log('Accounts:', accounts);
    
    if (accounts.length > 0) {
      const account = accounts[0];
      console.log('First account initialBalance:', account.initialBalance);
      
      // 检查交易记录
      const transactions = await prisma.transaction.findMany({
        where: { accountId: account.id }
      });
      console.log('Transactions:', transactions);
      
      // 检查快照记录
      const snapshots = await prisma.valuationSnapshot.findMany({
        where: { accountId: account.id }
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