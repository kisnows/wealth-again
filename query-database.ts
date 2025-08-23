import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function queryDatabase() {
  try {
    const userId = '2ade63ca-d5fa-4e27-a080-0c9522fd8b82';
    const year = 2025;
    
    console.log('User ID:', userId);
    console.log('Year:', year);
    
    // 查询特定用户的所有收入记录
    console.log('Querying all income records for user...');
    const allUserRecords = await prisma.incomeRecord.findMany({
      where: { userId },
      orderBy: [
        { year: "asc" },
        { month: "asc" }
      ],
    });
    
    console.log('Found all user records:', allUserRecords.length);
    if (allUserRecords.length > 0) {
      console.log('All user records years/months:', allUserRecords.map(r => ({year: r.year, month: r.month})));
    }
    
    // 查询特定年份的所有收入记录
    console.log('Querying all income records for year...');
    const allYearRecords = await prisma.incomeRecord.findMany({
      where: { year },
      orderBy: [
        { month: "asc" }
      ],
    });
    
    console.log('Found all year records:', allYearRecords.length);
    if (allYearRecords.length > 0) {
      console.log('All year records user IDs:', allYearRecords.map(r => r.userId));
    }
    
    // 查询特定用户和年份的收入记录
    console.log('Querying income records for user and year...');
    const incomeRecords = await prisma.incomeRecord.findMany({
      where: { userId, year },
      orderBy: [
        { month: "asc" }
      ],
    });
    
    console.log('Found income records:', incomeRecords.length);
    if (incomeRecords.length > 0) {
      console.log('Sample record:', incomeRecords[0]);
    }
  } catch (error) {
    console.error("Query database error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

queryDatabase();