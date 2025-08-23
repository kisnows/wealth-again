import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createTestData() {
  try {
    // 获取测试用户
    const user = await prisma.user.findFirst({
      where: { email: "yq123@outlook.com" }
    });

    if (!user) {
      console.log("测试用户未找到");
      return;
    }

    console.log("为用户创建测试数据:", user.email);

    // 创建一个投资账户
    const account = await prisma.account.create({
      data: {
        name: "测试投资账户",
        baseCurrency: "CNY",
        initialBalance: "10000",
        totalDeposits: "10000",
        userId: user.id
      }
    });

    console.log("创建账户:", account.name);

    // 添加一些交易记录
    const transactions = [
      { type: "DEPOSIT", amount: "10000", currency: "CNY", note: "初始资金" },
      { type: "DEPOSIT", amount: "5000", currency: "CNY", note: "追加投资" },
      { type: "WITHDRAW", amount: "2000", currency: "CNY", note: "部分取出" }
    ];

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const tradeDate = new Date();
      tradeDate.setDate(tradeDate.getDate() - (transactions.length - i) * 7); // 每隔一周一笔交易

      await prisma.transaction.create({
        data: {
          accountId: account.id,
          type: tx.type,
          tradeDate,
          amount: tx.amount,
          currency: tx.currency,
          note: tx.note
        }
      });

      console.log(`创建交易: ${tx.type} ${tx.amount} ${tx.currency}`);
    }

    // 添加一些估值快照
    const snapshots = [
      { totalValue: "10000", note: "初始价值" },
      { totalValue: "12000", note: "增长20%" },
      { totalValue: "11000", note: "回调10%" },
      { totalValue: "13000", note: "增长18%" }
    ];

    for (let i = 0; i < snapshots.length; i++) {
      const snapshot = snapshots[i];
      const asOf = new Date();
      asOf.setDate(asOf.getDate() - (snapshots.length - i) * 7); // 每隔一周一个快照

      await prisma.valuationSnapshot.create({
        data: {
          accountId: account.id,
          asOf,
          totalValue: snapshot.totalValue
        }
      });

      console.log(`创建快照: ${snapshot.totalValue}`);
    }

    // 更新账户的累计存款/取款
    await prisma.account.update({
      where: { id: account.id },
      data: {
        totalDeposits: "15000", // 10000 + 5000
        totalWithdrawals: "2000"
      }
    });

    console.log("测试数据创建完成！");
  } catch (error) {
    console.error("创建测试数据时出错:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();