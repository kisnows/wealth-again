import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkDatabaseData() {
  try {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    console.log("Current date:", { year, month });
    
    // 测试查询特定年份的收入记录
    console.log("Querying income records for year:", year);
    const incomeRecords = await prisma.incomeRecord.findMany({
      where: { year },
      orderBy: [
        { month: "asc" }
      ],
    });
    
    console.log("Found income records:", incomeRecords.length);
    if (incomeRecords.length > 0) {
      console.log("Sample record:", incomeRecords[0]);
    }
    
    // 测试查询所有收入记录
    console.log("Querying all income records...");
    const allRecords = await prisma.incomeRecord.findMany({
      orderBy: [
        { year: "asc" },
        { month: "asc" }
      ],
    });
    
    console.log("All records count:", allRecords.length);
    if (allRecords.length > 0) {
      console.log("All records years/months:", allRecords.map(r => ({year: r.year, month: r.month})));
    }
  } catch (error) {
    console.error("Check database data error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseData();