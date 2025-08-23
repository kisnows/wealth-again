import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    console.log("=== Prisma Test API Called ===");
    
    const userId = await getCurrentUser(req);
    console.log("User ID from session:", userId);
    
    // 获取当前年份
    const year = new Date().getFullYear();
    console.log("Current year:", year);
    
    // 创建新的prisma实例用于测试
    console.log("Creating new Prisma client...");
    const testPrisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error']
    });
    
    // 测试查询特定用户和年份的收入记录
    console.log("Querying income records for user and year:", { userId, year });
    const incomeRecords = await testPrisma.incomeRecord.findMany({
      where: { userId, year },
      orderBy: [
        { month: "asc" }
      ],
    });
    
    console.log("Found income records:", incomeRecords.length);
    if (incomeRecords.length > 0) {
      console.log("Sample record:", incomeRecords[0]);
    }
    
    // 断开prisma实例连接
    console.log("Disconnecting Prisma client...");
    await testPrisma.$disconnect();
    
    return NextResponse.json({
      userId,
      year,
      incomeRecords: incomeRecords.length,
      sampleRecord: incomeRecords.length > 0 ? incomeRecords[0] : null
    });
  } catch (error) {
    console.error("Prisma test error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}