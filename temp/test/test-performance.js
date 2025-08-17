import { PrismaClient } from '@prisma/client';
import {
  computePerformance,
  computePerformanceSeries,
} from './src/lib/performance.ts';

async function testPerformance() {
  const prisma = new PrismaClient();
  
  try {
    // 获取第一个账户
    const accounts = await prisma.account.findMany();
    if (accounts.length > 0) {
      const accountId = accounts[0].id;
      
      // 获取快照记录
      const snaps = await prisma.valuationSnapshot.findMany({
        where: { accountId },
        orderBy: { asOf: "asc" },
      });
      
      // 获取交易记录
      const txs = await prisma.transaction.findMany({ 
        where: { accountId } 
      });
      
      console.log('Snapshots:', snaps);
      console.log('Transactions:', txs);
      
      // 准备数据
      const flowsRaw = txs
        .filter((t) =>
          ["DEPOSIT", "WITHDRAW", "TRANSFER_IN", "TRANSFER_OUT"].includes(t.type)
        )
        .map((t) => ({
          date: t.tradeDate,
          amount:
            Number(t.amount || 0) *
            (t.type === "DEPOSIT" || t.type === "TRANSFER_IN" ? 1 : -1),
          currency: t.currency,
        }));
      
      console.log('Flows raw:', flowsRaw);
      
      const flows = flowsRaw.map(f => ({ date: f.date, amount: f.amount }));
      console.log('Flows processed:', flows);
      
      const valuations = snaps.map(s => ({ date: s.asOf, value: Number(s.totalValue) }));
      console.log('Valuations:', valuations);
      
      // 计算绩效
      const perf = computePerformance(valuations, flows);
      const series = computePerformanceSeries(valuations, flows);
      
      console.log('Performance:', perf);
      console.log('Series:', series);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPerformance();