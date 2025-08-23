const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabaseConnection() {
  try {
    const userId = '2ade63ca-d5fa-4e27-a080-0c9522fd8b82';
    const year = 2025;
    
    console.log("Testing database connection...");
    console.log("Query params:", { userId, year });
    
    const incomeRecords = await prisma.incomeRecord.findMany({
      where: { userId, year },
      orderBy: { month: 'asc' }
    });
    
    console.log("Income records count:", incomeRecords.length);
    console.log("Sample record:", incomeRecords[0]);
    
    if (incomeRecords.length > 0) {
      const annualIncome = incomeRecords.reduce((sum, record) => sum + Number(record.gross || 0), 0);
      console.log("Annual income:", annualIncome);
    }
  } catch (error) {
    console.error("Database test error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseConnection();