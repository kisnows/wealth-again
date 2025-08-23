import { NextRequest } from "next/server";
import { type ApiContext, errorResponse, successResponse, withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

async function getAccountSummary({ userId }: ApiContext) {
  try {
    // 获取所有活跃账户
    const accounts = await prisma.account.findMany({
      where: {
        userId,
        status: "ACTIVE",
      },
      include: {
        _count: {
          select: {
            transactions: true,
            snapshots: true,
          },
        },
      },
    });

    // 获取每个账户的最新估值
    const accountsWithCurrentValue = await Promise.all(
      accounts.map(async (account) => {
        let currentValue = Number(account.initialBalance || 0);

        if (account.accountType === "INVESTMENT") {
          // 对于投资账户，获取最新的估值快照
          const latestSnapshot = await prisma.valuationSnapshot.findFirst({
            where: { accountId: account.id },
            orderBy: { asOf: "desc" },
          });

          if (latestSnapshot) {
            currentValue = Number(latestSnapshot.totalValue);
          } else {
            // 如果没有快照，使用本金（初始资金 + 净存取款）
            currentValue =
              Number(account.initialBalance || 0) +
              Number(account.totalDeposits || 0) -
              Number(account.totalWithdrawals || 0);
          }
        } else {
          // 储蓄账户和借贷账户，估值等于本金
          currentValue =
            Number(account.initialBalance || 0) +
            Number(account.totalDeposits || 0) -
            Number(account.totalWithdrawals || 0);
        }

        const actualPrincipal =
          Number(account.initialBalance || 0) +
          Number(account.totalDeposits || 0) -
          Number(account.totalWithdrawals || 0);

        const gainLoss = currentValue - actualPrincipal;
        const gainLossRate = actualPrincipal > 0 ? (gainLoss / actualPrincipal) * 100 : 0;

        return {
          ...account,
          currentValue,
          actualPrincipal,
          gainLoss,
          gainLossRate,
        };
      }),
    );

    // 按账户类型分组统计
    const summary = accountsWithCurrentValue.reduce(
      (acc, account) => {
        const value = account.currentValue;

        switch (account.accountType) {
          case "SAVINGS":
            acc.savingsTotal += value;
            acc.totalAssets += value;
            break;
          case "INVESTMENT":
            acc.investmentTotal += value;
            acc.totalAssets += value;
            acc.totalGainLoss += account.gainLoss;
            break;
          case "LOAN":
            acc.loanTotal += Math.abs(value); // 负债显示为正数
            acc.totalLiabilities += Math.abs(value);
            break;
        }

        acc.totalAccounts++;
        return acc;
      },
      {
        totalAccounts: 0,
        totalAssets: 0,
        totalLiabilities: 0,
        savingsTotal: 0,
        investmentTotal: 0,
        loanTotal: 0,
        totalGainLoss: 0,
      },
    );

    // 计算净资产和总收益率
    const netAssets = summary.totalAssets - summary.totalLiabilities;
    const totalInvestmentPrincipal = accountsWithCurrentValue
      .filter((account) => account.accountType === "INVESTMENT")
      .reduce((sum, account) => sum + account.actualPrincipal, 0);

    const totalGainLossRate =
      totalInvestmentPrincipal > 0 ? (summary.totalGainLoss / totalInvestmentPrincipal) * 100 : 0;

    return successResponse({
      ...summary,
      netAssets,
      totalGainLossRate,
    });
  } catch (error) {
    console.error("Error calculating account summary:", error);
    return errorResponse("CALCULATION_ERROR", "计算账户概览失败");
  }
}

export const GET = withApiHandler(getAccountSummary);
