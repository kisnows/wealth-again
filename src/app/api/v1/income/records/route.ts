import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";

/**
 * GET /api/v1/income/records?from=YYYY-MM-01&to=YYYY-MM-01
 * - 查询月度收入快照区间。
 * - 返回: 501 TODO（占位），后续返回 { items: IncomeRecord[] }
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const userId = searchParams.get("userId") || undefined;
  const where: any = { userId };
  if (from || to) {
    where.monthDate = {} as any;
    if (from) (where.monthDate as any).gte = new Date(from);
    if (to) (where.monthDate as any).lte = new Date(to);
  }
  const items = await prisma.incomeRecord.findMany({ where, orderBy: { monthDate: "asc" } });
  return NextResponse.json({ items });
}
