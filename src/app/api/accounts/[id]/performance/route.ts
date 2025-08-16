import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computePerformance,
  computePerformanceSeries,
} from "@/lib/performance";
import { convert } from "@/lib/fx";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const accountId = params.id;
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    return NextResponse.json({ error: "account_not_found" }, { status: 404 });
  }
  const base = account.baseCurrency;
  const snaps = await prisma.valuationSnapshot.findMany({
    where: { accountId },
    orderBy: { asOf: "asc" },
  });
  const txs = await prisma.transaction.findMany({ where: { accountId } });
  const flowsRaw = txs
    .filter((t) =>
      ["CASH_IN", "CASH_OUT", "TRANSFER_IN", "TRANSFER_OUT"].includes(t.type)
    )
    .map((t) => ({
      date: t.tradeDate,
      amount:
        Number(t.cashAmount || 0) *
        (t.type === "CASH_IN" || t.type === "TRANSFER_IN" ? 1 : -1),
      currency: t.currency,
    }));
  // 将 flows 与 snapshots 统一换算为 baseCurrency
  const flows = [] as { date: Date; amount: number }[];
  for (const f of flowsRaw) {
    const amt = await convert(
      prisma,
      Number(f.amount || 0),
      f.currency,
      base,
      f.date
    ).catch(() => {
      // 若汇率缺失或超出容忍期，先跳过该笔，或可选择直接报错
      return 0;
    });
    flows.push({ date: f.date, amount: amt });
  }
  const valuations = [] as { date: Date; value: number }[];
  for (const s of snaps) {
    // 假设快照值已为账户基础货币（现有模型未存币种），可保留为 is-base；
    // 若未来支持快照币种，则在此处调用 convert 换算。
    valuations.push({ date: s.asOf, value: Number(s.totalValue) });
  }
  const perf = computePerformance(valuations, flows);
  const series = computePerformanceSeries(valuations, flows);
  return NextResponse.json({ performance: perf, series });
}
