const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    // 检查用户
    const users = await prisma.user.findMany();
    console.log('Users:', users);
    
    // 检查收入记录
    const incomeRecords = await prisma.incomeRecord.findMany();
    console.log('Income Records:', incomeRecords);
    
    // 检查投资账户
    const accounts = await prisma.account.findMany();
    console.log('Accounts:', accounts);
    
    // 检查交易记录
    const transactions = await prisma.transaction.findMany();
    console.log('Transactions:', transactions);
    
    // 检查估值快照
    const snapshots = await prisma.valuationSnapshot.findMany();
    console.log('Snapshots:', snapshots);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();