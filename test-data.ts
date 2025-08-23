import { prisma } from "@/lib/prisma";

async function testData() {
  try {
    // 测试用户数据
    const users = await prisma.user.findMany();
    console.log("Users:", users);

    // 测试收入数据
    const incomeRecords = await prisma.incomeRecord.findMany();
    console.log("Income Records:", incomeRecords);

    // 测试账户数据
    const accounts = await prisma.account.findMany();
    console.log("Accounts:", accounts);

    // 测试交易数据
    const transactions = await prisma.transaction.findMany();
    console.log("Transactions:", transactions);

    // 测试快照数据
    const snapshots = await prisma.valuationSnapshot.findMany();
    console.log("Snapshots:", snapshots);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testData();