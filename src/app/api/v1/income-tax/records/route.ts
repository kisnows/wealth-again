import { type NextRequest, NextResponse } from "next/server";
import db from "@/server/db";
import { incomeRecords } from "@/server/db/schema";
import {
  ensureIncomeRecordsForUser,
  summarizeIncomeRecords,
} from "@/server/services/income-tax/income";
import { getUserFromRequest } from "@/server/utils/auth";
import { and, asc, eq, gte, lte } from "drizzle-orm";

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
  const conditions = [eq(incomeRecords.userId, userId)];
  if (from) conditions.push(gte(incomeRecords.monthDate, new Date(from)));
  if (to) conditions.push(lte(incomeRecords.monthDate, new Date(to)));
  const items = await db
    .select()
    .from(incomeRecords)
    .where(and(...conditions))
    .orderBy(asc(incomeRecords.monthDate));
  const summary = summarizeIncomeRecords(items);
  return NextResponse.json({ items, summary });
}
