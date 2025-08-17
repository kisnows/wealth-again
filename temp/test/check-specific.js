import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSpecificAccount() {
  try {
    // 查找初始资金为5000的账户
    const account = await prisma.account.findFirst({
      where: { 
        initialBalance: "5000" 
      }
    });
    
    if (account) {
      console.log('Account:', account);
      
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
      
      // 模拟API中的计算逻辑
      console.log('\n=== 模拟API计算 ===');
      const initialBalance = Number(account.initialBalance || 0);
      console.log('初始资金:', initialBalance);
      
      let netContribution = initialBalance;
      for (const tx of transactions) {
        const amount = Number(tx.amount || 0);
        if (tx.type === "DEPOSIT" || tx.type === "TRANSFER_IN") {
          netContribution += amount;
        } else if (tx.type === "WITHDRAW" || tx.type === "TRANSFER_OUT") {
          netContribution -= amount;
        }
      }
      console.log('净入金（实际本金）:', netContribution);
      
      let currentValue = 0;
      if (snapshots.length > 0) {
        const latestSnapshot = snapshots[snapshots.length - 1];
        currentValue = Number(latestSnapshot.totalValue || 0);
      }
      console.log('当前估值:', currentValue);
      
      const pnl = currentValue - netContribution;
      const returnRate = netContribution !== 0 ? (pnl / netContribution) * 100 : 0;
      
      console.log('收益:', pnl);
      console.log('收益率:', returnRate + '%');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSpecificAccount();