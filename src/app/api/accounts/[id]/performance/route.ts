import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const accountId = params.id;
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    return NextResponse.json({ error: "account_not_found" }, { status: 404 });
  }

  try {
    // 获取账户初始资金
    const initialBalance = Number(account.initialBalance || 0);

    // 获取所有交易记录（不包括初始资金）
    const transactions = await prisma.transaction.findMany({
      where: { accountId },
      orderBy: { tradeDate: "asc" },
    });

    // 计算净入金（初始资金 + 存款 - 取款）
    let netContribution = initialBalance; // 初始资金作为本金
    for (const tx of transactions) {
      const amount = Number(tx.amount || 0);
      if (tx.type === "DEPOSIT" || tx.type === "TRANSFER_IN") {
        netContribution += amount;
      } else if (tx.type === "WITHDRAW" || tx.type === "TRANSFER_OUT") {
        netContribution -= amount;
      }
    }

    // 获取最新的快照记录作为当前估值
    const latestSnapshot = await prisma.valuationSnapshot.findFirst({
      where: { accountId },
      orderBy: { asOf: "desc" },
    });

    let currentValue = 0;
    if (latestSnapshot) {
      currentValue = Number(latestSnapshot.totalValue || 0);
    }

    // 计算收益和收益率
    const pnl = currentValue - netContribution;
    const returnRate = netContribution !== 0 ? (pnl / netContribution) * 100 : 0;

    // 返回简单的账户概览数据
    const performance = {
      initialValue: initialBalance,     // 初始资金
      netContribution,                  // 实际本金 = 初始资金 + 存款 - 取款
      currentValue,                     // 当前估值（账户市值）
      pnl,                              // 收益 = 当前估值 - 实际本金
      returnRate,                       // 收益率 = 收益 / 实际本金
    };

    // 返回简单的序列数据（用于图表）
    const snapshots = await prisma.valuationSnapshot.findMany({
      where: { accountId },
      orderBy: { asOf: "asc" },
    });

    const series = snapshots.map(snap => ({
      date: snap.asOf,
      value: Number(snap.totalValue || 0),
      netContribution,
      pnl: Number(snap.totalValue || 0) - netContribution,
      returnRate: netContribution !== 0 ? 
        ((Number(snap.totalValue || 0) - netContribution) / netContribution) * 100 : 0
    }));

    return NextResponse.json({ performance, series });
  } catch (error) {
    console.error("Performance calculation error:", error);
    return NextResponse.json(
      { error: "Failed to calculate performance" },
      { status: 500 }
    );
  }
}
