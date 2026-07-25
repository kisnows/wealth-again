import { type NextRequest, NextResponse } from "next/server";
import db from "@/server/db";
import { accounts, txnEntries, txnLines, valuationSnapshots } from "@/server/db/schema";
import { getUserFromRequest } from "@/server/utils/auth";
import { and, asc, eq, gte, lte } from "drizzle-orm";

/**
 * GET /api/v1/accounts-ledger/accounts/:id/timeseries?metric=valuation|principal&from&to
 * - 查询账户的估值或本金时间序列（账户币种 + 可选展示币种折算在后续实现）。
 * - 返回: 501 TODO（占位），后续返回 { points: Array<{ asOf: string, value: number }> }
 */

// GET /api/v1/accounts-ledger/accounts/:id/timeseries?metric=valuation|principal&from&to
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const user = await getUserFromRequest(req);
  if (!user || typeof user.id !== "string")
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [acc] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  if (!acc || acc.userId !== user.id)
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  const { searchParams } = new URL(req.url);
  const metric = searchParams.get("metric") ?? "valuation";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const fromDate = from ? new Date(from) : new Date("1970-01-01");
  const toDate = to ? new Date(to) : new Date();
  if (metric === "valuation") {
    const snaps = await db
      .select()
      .from(valuationSnapshots)
      .where(
        and(
          eq(valuationSnapshots.accountId, id),
          gte(valuationSnapshots.asOf, fromDate),
          lte(valuationSnapshots.asOf, toDate),
        ),
      )
      .orderBy(asc(valuationSnapshots.asOf));
    return NextResponse.json({
      points: snaps.map((s) => ({ asOf: s.asOf, value: Number(s.totalValue) })),
    });
  }
  // principal: 仅返回 toDate 的一个点（初版聚合）
  const rows = await db
    .select({
      amount: txnLines.amount,
      occurredAt: txnEntries.occurredAt,
    })
    .from(txnLines)
    .innerJoin(txnEntries, eq(txnEntries.id, txnLines.entryId))
    .where(eq(txnLines.accountId, id));
  const principal = rows
    .filter((line) => new Date(line.occurredAt) <= toDate)
    .reduce(
      (sum, line) => sum + Number(line.amount),
      Number(acc.initialBalance ?? 0),
    );
  return NextResponse.json({ points: [{ asOf: toDate, value: principal }] });
}
