import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSnapshotData(accountId) {
  try {
    console.log(`检查账户 ${accountId} 的快照数据:`);
    
    // 获取所有快照记录，按日期排序
    const snapshots = await prisma.valuationSnapshot.findMany({
      where: { accountId },
      orderBy: { asOf: "asc" },
    });
    
    console.log("所有快照记录:");
    snapshots.forEach((snap, index) => {
      console.log(`${index + 1}. 日期: ${snap.asOf.toISOString()}, 市值: ${snap.totalValue}`);
    });
    
    // 获取最新的快照记录
    const latestSnapshot = await prisma.valuationSnapshot.findFirst({
      where: { accountId },
      orderBy: { asOf: "desc" },
    });
    
    if (latestSnapshot) {
      console.log("\n最新快照记录:");
      console.log(`日期: ${latestSnapshot.asOf.toISOString()}`);
      console.log(`市值: ${latestSnapshot.totalValue}`);
    } else {
      console.log("\n没有找到快照记录");
    }
    
  } catch (error) {
    console.error("检查错误:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// 使用你提供的账户ID
checkSnapshotData("2c72878b-1bc5-49e9-b3d0-4415041de158");