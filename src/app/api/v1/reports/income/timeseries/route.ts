import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";
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
  const items = await prisma.incomeRecord.findMany({
    where: {
      userId: (user as any).id,
      monthDate: { gte: new Date(from), lte: new Date(to) },
    },
    orderBy: { monthDate: "asc" },
  });
  const mapSeries = (key: keyof (typeof items)[number]) =>
    items.map((r) => ({
      month: r.monthDate,
      value: Number((r as any)[key] || 0),
    }));
  const series = {
    gross: mapSeries("gross"),
    bonus: mapSeries("bonus"),
    ltcIncome: mapSeries("ltcIncome"),
    equityIncome: mapSeries("equityIncome"),
    socialInsurance: mapSeries("socialInsurance"),
    housingFund: mapSeries("housingFund"),
    incomeTax: mapSeries("incomeTax"),
    netIncome: mapSeries("netIncome"),
  };
  return NextResponse.json({ series });
}
