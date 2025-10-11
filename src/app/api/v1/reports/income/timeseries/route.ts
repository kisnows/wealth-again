import type { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
import {
  ensureIncomeRecordsForUser,
  summarizeIncomeRecords,
} from "@/server/services/income";
import { getUserFromRequest } from "@/server/utils/auth";

/**
 * GET /api/v1/reports/income/timeseries?from=YYYY-MM-01&to=YYYY-MM-01
 * - 返回工资/奖金/长期现金/股权/社保/公积金/个税/税后各曲线。
 * - 返回: 501 TODO（占位），后续返回 { series: Record<string, Array<{ month: string, value: number }>> }
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to)
    return NextResponse.json({ error: "from & to required" }, { status: 400 });
  const user = await getUserFromRequest(req);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = user.id;
  await ensureIncomeRecordsForUser(userId);
  const items = await prisma.incomeRecord.findMany({
    where: {
      userId,
      monthDate: { gte: new Date(from), lte: new Date(to) },
    },
    orderBy: { monthDate: "asc" },
  });
  const toNumber = (value: Prisma.Decimal | number | null | undefined) =>
    Number(value ?? 0);
  const series = {
    gross: items.map((r) => ({
      month: r.monthDate,
      value: toNumber(r.gross),
    })),
    bonus: items.map((r) => ({
      month: r.monthDate,
      value: toNumber(r.bonus),
    })),
    ltcIncome: items.map((r) => ({
      month: r.monthDate,
      value: toNumber(r.ltcIncome),
    })),
    equityIncome: items.map((r) => ({
      month: r.monthDate,
      value: toNumber(r.equityIncome),
    })),
    socialInsurance: items.map((r) => ({
      month: r.monthDate,
      value: toNumber(r.socialInsurance),
    })),
    housingFund: items.map((r) => ({
      month: r.monthDate,
      value: toNumber(r.housingFund),
    })),
    incomeTax: items.map((r) => ({
      month: r.monthDate,
      value: toNumber(r.incomeTax),
    })),
    netIncome: items.map((r) => ({
      month: r.monthDate,
      value: toNumber(r.netIncome),
    })),
  };
  const summary = summarizeIncomeRecords(items);
  return NextResponse.json({ series, summary });
}
