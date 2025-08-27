import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db";

/**
 * GET /api/v1/accounts/:id/timeseries?metric=valuation|principal&from&to
 * - 查询账户的估值或本金时间序列（账户币种 + 可选展示币种折算在后续实现）。
 * - 返回: 501 TODO（占位），后续返回 { points: Array<{ asOf: string, value: number }> }
 */

// GET /api/v1/accounts/:id/timeseries?metric=valuation|principal&from&to
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const metric = searchParams.get("metric") ?? "valuation";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const fromDate = from ? new Date(from) : new Date("1970-01-01");
  const toDate = to ? new Date(to) : new Date();
  if (metric === "valuation") {
    const snaps = await prisma.valuationSnapshot.findMany({
      where: { accountId: params.id, asOf: { gte: fromDate, lte: toDate } },
      orderBy: { asOf: "asc" },
    });
    return NextResponse.json({ points: snaps.map((s) => ({ asOf: s.asOf, value: Number(s.totalValue) })) });
  }
  // principal: 仅返回 toDate 的一个点（初版聚合）
  const acc = await prisma.account.findUnique({
    where: { id: params.id },
    include: { txnLines: { include: { entry: true } } },
  });
  if (!acc) return NextResponse.json({ error: "Not Found" }, { status: 404 });
  const principal = acc.txnLines
    .filter((l) => new Date(l.entry.occurredAt) <= toDate)
    .reduce((sum, l) => sum + Number(l.amount), Number(acc.initialBalance));
  return NextResponse.json({ points: [{ asOf: toDate, value: principal }] });
}
