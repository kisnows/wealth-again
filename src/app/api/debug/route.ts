import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    // 注意：这是一个调试API，仅在开发环境中可用
    // 在生产环境中，这个API应该被禁用或受到严格的身份验证保护
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "调试API在生产环境中不可用" }, { status: 403 });
    }

    const userId = await getCurrentUser(req);
    
    // 获取当前用户的数据
    const incomeRecords = await prisma.incomeRecord.findMany({
      where: { userId },
      orderBy: { year: "desc", month: "desc" },
    });
    
    // 获取当前用户的账户
    const accounts = await prisma.account.findMany({
      where: { userId },
      include: {
        snapshots: {
          orderBy: { asOf: "desc" },
        },
        transactions: {
          orderBy: { tradeDate: "desc" },
        }
      }
    });
    
    // 获取当前用户的收入变更记录
    const incomeChanges = await prisma.incomeChange.findMany({
      where: { userId },
      orderBy: { effectiveFrom: "desc" },
    });
    
    // 获取当前用户的奖金计划
    const bonusPlans = await prisma.bonusPlan.findMany({
      where: { userId },
      orderBy: { effectiveDate: "desc" },
    });
    
    return NextResponse.json({
      incomeRecords: incomeRecords.map(record => ({
        ...record,
        gross: Number(record.gross),
        bonus: record.bonus ? Number(record.bonus) : null,
        incomeTax: record.incomeTax ? Number(record.incomeTax) : null,
        netIncome: record.netIncome ? Number(record.netIncome) : null,
      })),
      accounts: accounts.map(account => ({
        ...account,
        initialBalance: Number(account.initialBalance),
        snapshots: account.snapshots.map(snapshot => ({
          ...snapshot,
          totalValue: Number(snapshot.totalValue),
        })),
        transactions: account.transactions.map(transaction => ({
          ...transaction,
          amount: Number(transaction.amount),
        })),
      })),
      incomeChanges: incomeChanges.map(change => ({
        ...change,
        grossMonthly: Number(change.grossMonthly),
      })),
      bonusPlans: bonusPlans.map(bonus => ({
        ...bonus,
        amount: Number(bonus.amount),
      })),
    });
  } catch (error) {
    console.error("Debug GET error:", error);
    
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    
    return NextResponse.json({ error: "服务器内部错误: " + (error as Error).message }, { status: 500 });
  }
}