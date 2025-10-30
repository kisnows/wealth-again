import type { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import {
  ensureIncomeRecordsForUser,
  summarizeIncomeRecords,
} from "@/server/services/income-tax/income";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * GET /api/v1/income-tax/records?from=YYYY-MM-01&to=YYYY-MM-01
 * - 查询月度收入快照区间。
 * - 返回: 501 TODO（占位），后续返回 { items: IncomeRecord[] }
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = user.id;
  await ensureIncomeRecordsForUser(userId);
  const where: Prisma.IncomeRecordWhereInput = { userId };
  if (from || to) {
    where.monthDate = {};
    if (from) where.monthDate.gte = new Date(from);
    if (to) where.monthDate.lte = new Date(to);
  }
  const items = await prisma.incomeRecord.findMany({
    where,
    orderBy: { monthDate: "asc" },
  });
  const summary = summarizeIncomeRecords(items);
  return NextResponse.json({ items, summary });
}
