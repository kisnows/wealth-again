import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export async function GET(req: NextRequest) {
  let prisma: PrismaClient | null = null;
  
  try {
    // 创建prisma实例
    prisma = new PrismaClient();
    
    // 获取当前日期
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
    
    return NextResponse.json({ 
      message: "Hello World!",
      timestamp: new Date().toISOString(),
      currentDate: { year, month },
      yearRecords: incomeRecords.length,
      allRecords: allRecords.length,
      sampleRecord: incomeRecords.length > 0 ? incomeRecords[0] : null
    });
  } catch (error) {
    console.error("Test minimal error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Unknown error"
    });
  } finally {
    // 确保prisma实例被正确关闭
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}