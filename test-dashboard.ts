import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testDashboardLogic() {
  try {
    const userId = '2ade63ca-d5fa-4e27-a080-0c9522fd8b82';
    const year = new Date().getFullYear();

    // 获取收入数据
    const incomeRecords = await prisma.incomeRecord.findMany({
      where: { userId, year },
      orderBy: { month: "asc" },
    });

    console.log("Income Records Count:", incomeRecords.length);
    console.log("Sample Record:", incomeRecords[0]);

    // 计算收入统计数据
    const annualIncome = incomeRecords.reduce((sum, record) => sum + Number(record.gross || 0), 0);
    const annualBonus = incomeRecords.reduce((sum, record) => sum + Number(record.bonus || 0), 0);
    const annualTax = incomeRecords.reduce((sum, record) => sum + Number(record.incomeTax || 0), 0);
    const annualNetIncome = incomeRecords.reduce((sum, record) => sum + Number(record.netIncome || 0), 0);
    
    console.log("Annual Income:", annualIncome);
    console.log("Annual Bonus:", annualBonus);
    console.log("Annual Tax:", annualTax);
    console.log("Annual Net Income:", annualNetIncome);

    // 获取本月收入 (注意：数据库中的月份是1-12，JavaScript的月份是0-11)
    const currentDate = new Date();
    console.log("Current Date:", currentDate);
    console.log("Current Year:", currentDate.getFullYear());
    console.log("Current Month (JS):", currentDate.getMonth() + 1);

    const currentMonthRecord = incomeRecords.find(
      record => record.year === currentDate.getFullYear() && record.month === (currentDate.getMonth() + 1)
    );
    
    console.log("Current Month Record:", currentMonthRecord);
    
    const monthlyIncome = currentMonthRecord ? Number(currentMonthRecord.gross || 0) : 0;
    console.log("Monthly Income:", monthlyIncome);

  } catch (error) {
    console.error("Test error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testDashboardLogic();