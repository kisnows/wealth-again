import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { taxParamsSchema, calcMonthlyWithholdingCumulative } from "@/lib/tax";
import { ZodError } from "zod";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year")) || new Date().getFullYear();
  const city = searchParams.get("city") || "Hangzhou";

  const user = await prisma.user.findFirst();
  if (!user) return NextResponse.json({ records: [] });

  // 获取该年份的所有收入记录
  const incomeRecords = await prisma.incomeRecord.findMany({
    where: { userId: user.id, year },
    orderBy: { month: "asc" },
  });

  // 获取税务参数
  const cfg = await prisma.config.findFirst({
    where: { key: `tax:${city}:${year}` },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!cfg) {
    // 如果没有税务参数，返回基础数据
    return NextResponse.json({
      records: incomeRecords.map((record) => ({
        ...record,
        gross: Number(record.gross),
        bonus: record.bonus ? Number(record.bonus) : undefined,
        taxableCumulative: 0,
        taxThisMonth: 0,
        taxDueCumulative: 0,
        net: Number(record.gross) + (record.bonus ? Number(record.bonus) : 0),
      })),
    });
  }

  let params;
  try {
    params = taxParamsSchema.parse(JSON.parse(cfg.value));
  } catch (err: unknown) {
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "invalid tax params json" },
        { status: 400 }
      );
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid tax params shape", issues: err.issues },
        { status: 400 }
      );
    }
    console.error("/api/income/summary parse error", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }

  // 转换为计算所需的格式
  const months = incomeRecords.map((record: any) => ({
    month: record.month,
    gross: Number(record.gross),
    bonus: record.bonus ? Number(record.bonus) : undefined,
    overrides: record.overrides as any,
  }));

  // 计算税务
  const results = calcMonthlyWithholdingCumulative(months, params, {
    mergeBonusIntoComprehensive: true,
  });

  // 合并原始记录和计算结果
  const records = incomeRecords.map((record: any, index: number) => ({
    ...record,
    gross: Number(record.gross),
    bonus: record.bonus ? Number(record.bonus) : undefined,
    ...results[index],
  }));

  return NextResponse.json({ records });
}
