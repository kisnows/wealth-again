import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import {
  normalizeTaxParamsValue,
  TaxService,
  TaxConfigRepository,
} from "@/lib/tax";
import { ZodError } from "zod";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUser(req);
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year")) || new Date().getFullYear();
    const city = searchParams.get("city") || "Hangzhou";

    // 获取该年份的所有收入记录
    const incomeRecords = await prisma.incomeRecord.findMany({
      where: { userId, year },
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
      params = normalizeTaxParamsValue(cfg.value as string);
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "invalid tax params shape", issues: err.issues },
          { status: 400 }
        );
      }
      console.error("/api/income/summary parse error", err);
      return NextResponse.json({ error: "internal error" }, { status: 500 });
    }

    // 使用服务层累计逻辑，避免旧兼容路径
    const svc = new TaxService(new TaxConfigRepository(prisma));
    const months = incomeRecords.map((record: any) => ({
      year: record.year,
      month: record.month,
      gross: Number(record.gross),
      bonus: record.bonus ? Number(record.bonus) : 0,
    }));
    const results = await svc.calculateForecastWithholdingCumulative({
      city,
      months,
    });

    // 合并原始记录和计算结果
    const records = incomeRecords.map((record: any, index: number) => ({
      ...record,
      gross: Number(record.gross),
      bonus: record.bonus ? Number(record.bonus) : undefined,
      ...results[index],
    }));

    return NextResponse.json({ records });
  } catch (error) {
    console.error("Income summary GET error:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
