import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    console.log("=== Simple Test API Called ===");
    
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
    
    // 使用硬编码的用户ID进行测试
    const testUserId = "2ade63ca-d5fa-4e27-a080-0c9522fd8b82";
    console.log("Using test user ID:", testUserId);
    
    // 查询收入记录
    console.log("Querying income records with test user ID...");
    const incomeRecords = await testPrisma.incomeRecord.findMany({
      where: { userId: testUserId, year },
      orderBy: [
        { month: "asc" }
      ],
    });
    
    console.log("Found income records:", incomeRecords.length);
    if (incomeRecords.length > 0) {
      console.log("Sample record:", incomeRecords[0]);
    }
    
    // 查询所有收入记录（用于调试）
    console.log("Querying all income records for test user...");
    const allRecords = await testPrisma.incomeRecord.findMany({
      where: { userId: testUserId },
      orderBy: [
        { year: "asc" },
        { month: "asc" }
      ],
    });
    
    console.log("All records count:", allRecords.length);
    if (allRecords.length > 0) {
      console.log("All records years/months:", allRecords.map(r => ({year: r.year, month: r.month})));
    }
    
    // 断开prisma实例连接
    console.log("Disconnecting Prisma client...");
    await testPrisma.$disconnect();
    
    return NextResponse.json({
      userId,
      testUserId,
      year,
      count: incomeRecords.length,
      allCount: allRecords.length,
      sample: incomeRecords.length > 0 ? incomeRecords[0] : null
    });
  } catch (error) {
    console.error("Simple test error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}