"use client";

import { useMemo } from "react";
import { CurrencyDisplay } from "@/components/shared/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Account, Transaction, ValuationSnapshot } from "@/types";

interface AccountPerformanceProps {
  account: Account;
  transactions: Transaction[];
  snapshots: ValuationSnapshot[];
  userBaseCurrency?: string;
}

interface PerformanceMetrics {
  principal: number; // 本金
  currentValue: number; // 当前估值
  pnl: number; // 收益
  pnlRate: number; // 收益率
  totalDeposits: number; // 累计存款
  totalWithdrawals: number; // 累计取款
  netCashFlow: number; // 净现金流
}

export default function AccountPerformance({
  account,
  transactions,
  snapshots,
  userBaseCurrency = "CNY",
}: AccountPerformanceProps) {
  const performance = useMemo((): PerformanceMetrics => {
    // 计算本金：初始资金 + ∑存款 - ∑取款 + ∑转入 - ∑转出
    const initialBalance = Number(account.initialBalance || 0);

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let totalTransferIn = 0;
    let totalTransferOut = 0;

    transactions.forEach((tx) => {
      const amount = Number(tx.amount || 0);
      switch (tx.type) {
        case "DEPOSIT":
          totalDeposits += amount;
          break;
        case "WITHDRAW":
          totalWithdrawals += amount;
          break;
        case "TRANSFER_IN":
          totalTransferIn += amount;
          break;
        case "TRANSFER_OUT":
          totalTransferOut += amount;
          break;
      }
    });

    const principal =
      initialBalance + totalDeposits - totalWithdrawals + totalTransferIn - totalTransferOut;
    const netCashFlow = totalDeposits - totalWithdrawals + totalTransferIn - totalTransferOut;

    // 获取当前估值
    let currentValue = 0;
    if (account.accountType === "SAVINGS") {
      // 储蓄账户：估值 = 本金
      currentValue = principal;
    } else {
      // 投资和借贷账户：使用最新估值快照，如果没有则使用本金
      const latestSnapshot = snapshots.sort(
        (a, b) => new Date(b.asOf).getTime() - new Date(a.asOf).getTime(),
      )[0];
      currentValue = latestSnapshot ? Number(latestSnapshot.totalValue) : principal;
    }

    // 计算收益和收益率
    const pnl = currentValue - principal;
    const pnlRate = principal !== 0 ? (pnl / principal) * 100 : 0;

    return {
      principal,
      currentValue,
      pnl,
      pnlRate,
      totalDeposits,
      totalWithdrawals,
      netCashFlow,
    };
  }, [account, transactions, snapshots]);

  const getAccountTypeDescription = () => {
    switch (account.accountType) {
      case "SAVINGS":
        return "储蓄账户（估值 = 本金）";
      case "INVESTMENT":
        return "投资账户（需手动更新估值）";
      case "LOAN":
        return "借贷账户（估值 = 剩余负债）";
      default:
        return "未知账户类型";
    }
  };

  const getPnlColor = () => {
    if (performance.pnl > 0) return "text-green-600";
    if (performance.pnl < 0) return "text-red-600";
    return "text-gray-600";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{account.name}</span>
          <span className="text-sm font-normal text-gray-600">{getAccountTypeDescription()}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 本金 */}
          <div className="text-center">
            <p className="text-sm text-gray-600">本金</p>
            <p className="text-lg font-semibold">
              <CurrencyDisplay
                amount={performance.principal}
                fromCurrency={account.baseCurrency}
                userBaseCurrency={userBaseCurrency}
              />
            </p>
            <p className="text-xs text-gray-500">初始 + 存款 - 取款 + 转入 - 转出</p>
          </div>

          {/* 当前估值 */}
          <div className="text-center">
            <p className="text-sm text-gray-600">当前估值</p>
            <p className="text-lg font-semibold">
              <CurrencyDisplay
                amount={performance.currentValue}
                fromCurrency={account.baseCurrency}
                userBaseCurrency={userBaseCurrency}
              />
            </p>
            {account.accountType === "SAVINGS" && (
              <p className="text-xs text-gray-500">自动等于本金</p>
            )}
            {snapshots.length > 0 && account.accountType !== "SAVINGS" && (
              <p className="text-xs text-gray-500">
                最新更新：{new Date(snapshots[0]?.asOf).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* 收益 */}
          <div className="text-center">
            <p className="text-sm text-gray-600">收益</p>
            <p className={`text-lg font-semibold ${getPnlColor()}`}>
              <CurrencyDisplay
                amount={performance.pnl}
                fromCurrency={account.baseCurrency}
                userBaseCurrency={userBaseCurrency}
              />
            </p>
            <p className="text-xs text-gray-500">估值 - 本金</p>
          </div>

          {/* 收益率 */}
          <div className="text-center">
            <p className="text-sm text-gray-600">收益率</p>
            <p className={`text-lg font-semibold ${getPnlColor()}`}>
              {account.accountType === "SAVINGS" || account.accountType === "LOAN"
                ? "-"
                : `${performance.pnlRate.toFixed(2)}%`}
            </p>
            <p className="text-xs text-gray-500">
              {account.accountType === "SAVINGS"
                ? "储蓄账户无收益"
                : account.accountType === "LOAN"
                  ? "负债账户"
                  : "收益 ÷ 本金"}
            </p>
          </div>
        </div>

        {/* 现金流详情 */}
        <div className="mt-6 pt-4 border-t">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">现金流详情</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">初始资金：</span>
              <span className="font-medium">
                <CurrencyDisplay
                  amount={Number(account.initialBalance)}
                  fromCurrency={account.baseCurrency}
                  userBaseCurrency={userBaseCurrency}
                />
              </span>
            </div>

            <div>
              <span className="text-gray-600">累计存款：</span>
              <span className="font-medium text-green-600">
                +
                <CurrencyDisplay
                  amount={performance.totalDeposits}
                  fromCurrency={account.baseCurrency}
                  userBaseCurrency={userBaseCurrency}
                />
              </span>
            </div>

            <div>
              <span className="text-gray-600">累计取款：</span>
              <span className="font-medium text-red-600">
                -
                <CurrencyDisplay
                  amount={performance.totalWithdrawals}
                  fromCurrency={account.baseCurrency}
                  userBaseCurrency={userBaseCurrency}
                />
              </span>
            </div>

            <div>
              <span className="text-gray-600">交易次数：</span>
              <span className="font-medium">{transactions.length}</span>
            </div>

            <div>
              <span className="text-gray-600">估值记录：</span>
              <span className="font-medium">{snapshots.length}</span>
            </div>

            <div>
              <span className="text-gray-600">净现金流：</span>
              <span
                className={`font-medium ${performance.netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {performance.netCashFlow >= 0 ? "+" : ""}
                <CurrencyDisplay
                  amount={performance.netCashFlow}
                  fromCurrency={account.baseCurrency}
                  userBaseCurrency={userBaseCurrency}
                />
              </span>
            </div>
          </div>
        </div>

        {/* 特殊提示 */}
        {account.accountType === "INVESTMENT" && snapshots.length === 0 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-sm text-amber-800">
              💡
              投资账户暂无估值记录，当前显示的收益基于本金计算。请定期更新账户估值以获得准确的收益数据。
            </p>
          </div>
        )}

        {account.accountType === "LOAN" && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">
              💡 借贷账户显示的是负债情况。"存款"表示借入资金，"取款"表示还款减少负债。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
