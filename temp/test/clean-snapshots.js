import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDuplicateSnapshots(accountId) {
  try {
    console.log(`清理账户 ${accountId} 的重复快照记录:`);
    
    // 获取所有快照记录，按日期排序
    const snapshots = await prisma.valuationSnapshot.findMany({
      where: { accountId },
      orderBy: { asOf: "asc" },
    });
    
    console.log("清理前的所有快照记录:");
    snapshots.forEach((snap, index) => {
      console.log(`${index + 1}. ID: ${snap.id}, 日期: ${snap.asOf.toISOString()}, 市值: ${snap.totalValue}`);
    });
    
    // 按日期分组，保留每个日期最新的记录
    const groupedByDate = {};
    for (const snap of snapshots) {
      const dateKey = snap.asOf.toISOString().split('T')[0]; // 只取日期部分
      if (!groupedByDate[dateKey] || snap.asOf > groupedByDate[dateKey].asOf) {
        groupedByDate[dateKey] = snap;
      }
    }
    
    // 删除重复的记录
    const snapshotsToKeep = Object.values(groupedByDate);
    const snapshotIdsToKeep = snapshotsToKeep.map(snap => snap.id);
    const snapshotIdsToDelete = snapshots
      .filter(snap => !snapshotIdsToKeep.includes(snap.id))
      .map(snap => snap.id);
    
    if (snapshotIdsToDelete.length > 0) {
      console.log("\n删除重复的快照记录:");
      await prisma.valuationSnapshot.deleteMany({
        where: {
          id: { in: snapshotIdsToDelete }
        }
      });
      console.log(`删除了 ${snapshotIdsToDelete.length} 条重复记录`);
    } else {
      console.log("\n没有发现重复记录");
    }
    
    // 显示清理后的记录
    const remainingSnapshots = await prisma.valuationSnapshot.findMany({
      where: { accountId },
      orderBy: { asOf: "asc" },
    });
    
    console.log("\n清理后的快照记录:");
    remainingSnapshots.forEach((snap, index) => {
      console.log(`${index + 1}. ID: ${snap.id}, 日期: ${snap.asOf.toISOString()}, 市值: ${snap.totalValue}`);
    });
    
  } catch (error) {
    console.error("清理错误:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// 使用你提供的账户ID
cleanDuplicateSnapshots("2c72878b-1bc5-49e9-b3d0-4415041de158");