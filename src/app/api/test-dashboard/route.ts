import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  console.log("=== Test Dashboard API Called ===");
  
  let prisma: PrismaClient | null = null;
  
  try {
    // 创建prisma实例
    prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error']
    });
    
    console.log("Created new Prisma client");
    
    const userId = await getCurrentUser(req);
    console.log("User ID from session:", userId);
    
    // 获取当前日期
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    console.log("Current date:", { year, month });
    console.log("Query params:", { userId, year });
    
    // 测试收入记录查询
    console.log("Querying income records...");
    const incomeRecords = await prisma.incomeRecord.findMany({
      where: { userId, year },
      orderBy: [
        { month: "asc" }
      ],
    });
    
    console.log("Income records count:", incomeRecords.length);
    if (incomeRecords.length > 0) {
      console.log("First few records:", incomeRecords.slice(0, 3));
    } else {
      console.log("No records found");
      
      // 尝试查询所有记录来调试
      console.log("Querying all income records for user...");
      const allRecords = await prisma.incomeRecord.findMany({
        where: { userId },
        orderBy: [
          { year: "asc" },
          { month: "asc" }
        ],
      });
      console.log("All records count:", allRecords.length);
      if (allRecords.length > 0) {
        console.log("All records years/months:", allRecords.map(r => ({year: r.year, month: r.month})));
      }
    }
    
    // 查找当前月份记录
    const currentMonthRecord = incomeRecords.find(
      record => record.year === year && record.month === month
    );
    
    console.log("Current month record:", currentMonthRecord);
    
    const response = {
      userId,
      currentDate: {
        year,
        month
      },
      incomeRecords: {
        count: incomeRecords.length,
        currentMonthRecord,
        annualIncome: incomeRecords.reduce((sum, record) => sum + Number(record.gross || 0), 0)
      }
    };
    
    console.log("Response:", response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Test dashboard error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    });
  } finally {
    // 确保prisma实例被正确关闭
    if (prisma) {
      console.log("Disconnecting Prisma client");
      await prisma.$disconnect();
    }
    console.log("=== Test Dashboard API Completed ===");
  }
}