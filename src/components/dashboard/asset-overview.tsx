"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { CurrencyDisplay } from "@/components/shared/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Account, ValuationSnapshot } from "@/types";

interface AssetSummary {
  totalAssets: number; // 总市值 (储蓄+投资)
  totalLiabilities: number; // 总负债 (借贷)
  netWorth: number; // 净资产
  savingsTotal: number; // 流动资金 (储蓄)
  investmentTotal: number; // 长期资金 (投资)
  loanTotal: number; // 借贷资金 (负债)
  accountsByType: {
    SAVINGS: Account[];
    INVESTMENT: Account[];
    LOAN: Account[];
  };
}

export default function AssetOverview() {
  const { data: session } = useSession();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [snapshots, setSnapshots] = useState<ValuationSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [userBaseCurrency, setUserBaseCurrency] = useState("CNY");

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    try {
      const [accountsRes, snapshotsRes, userRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/accounts/snapshots"), // 需要创建这个API来获取所有快照
        fetch("/api/user/profile"),
      ]);

      const accountsData = await accountsRes.json();
      const userData = await userRes.json();

      if (accountsData.success) {
        setAccounts(accountsData.data || []);
      }

      if (userData.success) {
        setUserBaseCurrency(userData.data?.baseCurrency || "CNY");
      }

      // TODO: 实现快照获取API
      // const snapshotsData = await snapshotsRes.json();
      // if (snapshotsData.success) {
      //   setSnapshots(snapshotsData.data || []);
      // }
    } catch (error) {
      console.error("Failed to fetch asset data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAssetSummary = (): AssetSummary => {
    // 按账户类型分组
    const accountsByType = accounts.reduce(
      (groups, account) => {
        const type = account.accountType || "INVESTMENT";
        if (!groups[type]) groups[type] = [];
        groups[type].push(account);
        return groups;
      },
      {
        SAVINGS: [],
        INVESTMENT: [],
        LOAN: [],
      } as { SAVINGS: Account[]; INVESTMENT: Account[]; LOAN: Account[] },
    );

    let savingsTotal = 0;
    let investmentTotal = 0;
    let loanTotal = 0;

    // 计算储蓄账户总额 (本金)
    accountsByType.SAVINGS.forEach((account) => {
      const principal =
        Number(account.initialBalance || 0) +
        Number(account.totalDeposits || 0) -
        Number(account.totalWithdrawals || 0);
      savingsTotal += principal;
    });

    // 计算投资账户总额 (使用最新估值，如果没有则使用本金)
    accountsByType.INVESTMENT.forEach((account) => {
      // TODO: 使用实际快照数据
      const principal =
        Number(account.initialBalance || 0) +
        Number(account.totalDeposits || 0) -
        Number(account.totalWithdrawals || 0);
      investmentTotal += principal; // 暂时使用本金
    });

    // 计算借贷账户总额 (剩余负债)
    accountsByType.LOAN.forEach((account) => {
      const remainingDebt =
        Number(account.initialBalance || 0) +
        Number(account.totalDeposits || 0) -
        Number(account.totalWithdrawals || 0);
      loanTotal += Math.abs(remainingDebt); // 负债取绝对值
    });

    const totalAssets = savingsTotal + investmentTotal;
    const totalLiabilities = loanTotal;
    const netWorth = totalAssets - totalLiabilities;

    return {
      totalAssets,
      totalLiabilities,
      netWorth,
      savingsTotal,
      investmentTotal,
      loanTotal,
      accountsByType,
    };
  };

  if (!session) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <p className="text-gray-500">请先登录以查看资产总览</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  const summary = calculateAssetSummary();

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold mb-6">资产总览</h1>

      {/* 核心指标 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
              总市值
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              <CurrencyDisplay amount={summary.totalAssets} userBaseCurrency={userBaseCurrency} />
            </div>
            <div className="text-sm text-gray-600 mt-1">储蓄 + 投资</div>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
              总负债
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              <CurrencyDisplay
                amount={summary.totalLiabilities}
                userBaseCurrency={userBaseCurrency}
              />
            </div>
            <div className="text-sm text-gray-600 mt-1">借贷账户</div>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              净资产
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${summary.netWorth >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              <CurrencyDisplay amount={summary.netWorth} userBaseCurrency={userBaseCurrency} />
            </div>
            <div className="text-sm text-gray-600 mt-1">总市值 - 总负债</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <span className="w-3 h-3 bg-gray-500 rounded-full mr-2"></span>
              账户总数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{accounts.length}</div>
            <div className="text-sm text-gray-600 mt-1">活跃账户</div>
          </CardContent>
        </Card>
      </div>

      {/* 资产分类详情 */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">总览</TabsTrigger>
          <TabsTrigger value="savings">储蓄账户</TabsTrigger>
          <TabsTrigger value="investment">投资账户</TabsTrigger>
          <TabsTrigger value="loan">借贷账户</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">流动资金（储蓄）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-2">
                  <CurrencyDisplay
                    amount={summary.savingsTotal}
                    userBaseCurrency={userBaseCurrency}
                  />
                </div>
                <div className="text-sm text-gray-600">
                  {summary.accountsByType.SAVINGS.length} 个储蓄账户
                </div>
                <div className="text-xs text-gray-500 mt-2">估值 = 本金，无投资风险</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-blue-600">长期资金（投资）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-2">
                  <CurrencyDisplay
                    amount={summary.investmentTotal}
                    userBaseCurrency={userBaseCurrency}
                  />
                </div>
                <div className="text-sm text-gray-600">
                  {summary.accountsByType.INVESTMENT.length} 个投资账户
                </div>
                <div className="text-xs text-gray-500 mt-2">需定期更新市值估值</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">借贷资金（负债）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-2">
                  <CurrencyDisplay amount={summary.loanTotal} userBaseCurrency={userBaseCurrency} />
                </div>
                <div className="text-sm text-gray-600">
                  {summary.accountsByType.LOAN.length} 个借贷账户
                </div>
                <div className="text-xs text-gray-500 mt-2">剩余负债金额</div>
              </CardContent>
            </Card>
          </div>

          {/* 资产占比可视化 */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>资产分布</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 储蓄占比 */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>储蓄账户</span>
                    <span>
                      {summary.totalAssets > 0
                        ? ((summary.savingsTotal / summary.totalAssets) * 100).toFixed(1)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width:
                          summary.totalAssets > 0
                            ? `${(summary.savingsTotal / summary.totalAssets) * 100}%`
                            : "0%",
                      }}
                    ></div>
                  </div>
                </div>

                {/* 投资占比 */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>投资账户</span>
                    <span>
                      {summary.totalAssets > 0
                        ? ((summary.investmentTotal / summary.totalAssets) * 100).toFixed(1)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width:
                          summary.totalAssets > 0
                            ? `${(summary.investmentTotal / summary.totalAssets) * 100}%`
                            : "0%",
                      }}
                    ></div>
                  </div>
                </div>

                {/* 负债比率 */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>负债比率</span>
                    <span>
                      {summary.totalAssets > 0
                        ? ((summary.totalLiabilities / summary.totalAssets) * 100).toFixed(1)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full"
                      style={{
                        width:
                          summary.totalAssets > 0
                            ? `${Math.min((summary.totalLiabilities / summary.totalAssets) * 100, 100)}%`
                            : "0%",
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 其他标签页的内容可以显示对应类型的账户列表 */}
        {["savings", "investment", "loan"].map((type) => (
          <TabsContent key={type} value={type}>
            <Card>
              <CardHeader>
                <CardTitle>
                  {type === "savings"
                    ? "储蓄账户"
                    : type === "investment"
                      ? "投资账户"
                      : "借贷账户"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {summary.accountsByType[
                    type.toUpperCase() as keyof typeof summary.accountsByType
                  ].map((account) => (
                    <Card key={account.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold">{account.name}</h3>
                          <span className="text-sm text-gray-500">{account.baseCurrency}</span>
                        </div>
                        {account.description && (
                          <p className="text-sm text-gray-600 mb-2">{account.description}</p>
                        )}
                        <div className="text-lg font-bold">
                          <CurrencyDisplay
                            amount={
                              Number(account.initialBalance || 0) +
                              Number(account.totalDeposits || 0) -
                              Number(account.totalWithdrawals || 0)
                            }
                            fromCurrency={account.baseCurrency}
                            userBaseCurrency={userBaseCurrency}
                          />
                        </div>
                        {account.subType && (
                          <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mt-2 inline-block">
                            {account.subType}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {accounts.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500 mb-4">暂无账户数据</p>
            <a href="/investment" className="text-blue-600 hover:underline">
              去创建您的第一个账户 →
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
