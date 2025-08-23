import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

// 移除city字段，因为收入记录与城市无关
const schema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  gross: z.number().positive(),
  bonus: z.number().optional(),
  overrides: z.record(z.string(), z.any()).optional(),
  effectiveDate: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const body = schema.parse(await req.json());
    
    const effectiveDate = body.effectiveDate
      ? new Date(body.effectiveDate)
      : new Date(body.year, body.month, 0); // 当月最后一天

    const rec = await prisma.incomeRecord.upsert({
      where: {
        userId_year_month: { userId, year: body.year, month: body.month },
      },
      update: {
        gross: body.gross.toString(),
        bonus: body.bonus?.toString(),
        overrides: body.overrides ? JSON.stringify(body.overrides) : undefined,
      },
      create: {
        userId,
        year: body.year,
        month: body.month,
        gross: body.gross.toString(),
        bonus: body.bonus?.toString(),
        overrides: body.overrides ? JSON.stringify(body.overrides) : undefined,
      },
    });

    // 记录变更轨迹：工资按月度生效
    await prisma.incomeChange.create({
      data: {
        userId,
        grossMonthly: body.gross.toString(),
        effectiveFrom: effectiveDate,
      },
    });

    return NextResponse.json({ 
      success: true,
      data: { id: rec.id }
    });

  } catch (error) {
    console.error("Income monthly API error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: error.issues[0].message } },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const { searchParams } = new URL(req.url);
    
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;

    const where: any = { userId, year };
    if (month) {
      where.month = month;
    }

    const records = await prisma.incomeRecord.findMany({
      where,
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    });

    return NextResponse.json({
      success: true,
      data: records
    });

  } catch (error) {
    console.error("Income monthly GET error:", error);
    
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}
