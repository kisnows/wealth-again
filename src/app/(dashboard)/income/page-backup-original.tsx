"use client";
import Link from "next/link";
import IncomeForm from "@/components/income/income-form";
import LongTermCashForm from "@/components/income/long-term-cash-form";
import LongTermCashDetail from "@/components/income/long-term-cash-detail";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { formatCurrencyWithSeparator } from "@/lib/currency";
import { useFxRates } from "@/hooks/use-fx-rates";

export default function IncomePage() {
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [changes, setChanges] = useState<any[]>([]);
  const [longTermCash, setLongTermCash] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [userBaseCurrency, setUserBaseCurrency] = useState<string>("CNY");
  const [startYM, setStartYM] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [endYM, setEndYM] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 11);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // 支持的币种列表 - 使用 useMemo 避免重复创建数组引用
  const supportedCurrencies = useMemo(() => ["CNY", "HKD", "USD"], []);

  // 使用 useFxRates hook
  const {
    fxRates,
    loading: fxLoading,
    error: fxError,
    convert,
  } = useFxRates(userBaseCurrency, supportedCurrencies);

  const [totals, setTotals] = useState<any>({
    totalSalary: 0,
    totalBonus: 0,
    totalLongTermCash: 0,
    totalGross: 0,
    totalNet: 0,
    totalTax: 0,
  });

  async function load() {
    const [b, c, l, f] = await Promise.all([
      fetch(`/api/income/bonus?page=1&pageSize=50`).then((r) => r.json()),
      fetch(`/api/income/changes?page=1&pageSize=50`).then((r) => r.json()),
      fetch(`/api/income/long-term-cash?page=1&pageSize=50`).then((r) =>
        r.json()
      ),
      fetch(`/api/income/forecast?start=${startYM}&end=${endYM}`).then((r) =>
        r.json()
      ),
    ]);

    // 修复奖金API返回结构不一致的问题
    setBonuses(b.success ? b.data || [] : b.records || []);
    setChanges(c.records || []);
    setLongTermCash(l.success ? l.data || [] : l.records || []);

    // 直接设置原始预测数据，不在这里进行转换
    setForecast(f.results || []);

    // 转换总计数据（假设后端已统一为基准币种）
    const totals = f.totals || {
      totalSalary: 0,
      totalBonus: 0,
      totalLongTermCash: 0,
      totalGross: 0,
      totalNet: 0,
      totalTax: 0,
    };
    setTotals(totals);
  }

  // 单独的函数来初始化用户配置
  async function loadUserConfig() {
    try {
      const response = await fetch(`/api/user/profile`);
      const u = await response.json();
      if (u.success && u.data?.baseCurrency) {
        setUserBaseCurrency(u.data.baseCurrency);
      }
    } catch (error) {
      console.error("Failed to load user config:", error);
    }
  }

  async function deleteIncomeChange(id: string) {
    if (!confirm("确定要删除这条工资变更记录吗？")) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/income/changes?id=${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error?.message || "删除工资变更记录失败");
        return;
      }

      setSuccess("工资变更记录删除成功");
      await load();

      // 通知其它组件刷新
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("income:refresh"));
      }
    } catch (error) {
      console.error("Error deleting income change:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function deleteBonusPlan(id: string) {
    if (!confirm("确定要删除这条奖金计划吗？")) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/income/bonus?id=${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error?.message || "删除奖金计划失败");
        return;
      }

      setSuccess("奖金计划删除成功");
      await load();

      // 通知其它组件刷新
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("income:refresh"));
      }
    } catch (error) {
      console.error("Error deleting bonus plan:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function deleteLongTermCash(id: string) {
    if (!confirm("确定要删除这条长期现金记录吗？")) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/income/long-term-cash?id=${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error?.message || "删除长期现金记录失败");
        return;
      }

      setSuccess("长期现金记录删除成功");
      await load();

      // 通知其它组件刷新
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("income:refresh"));
      }
    } catch (error) {
      console.error("Error deleting long term cash:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 只在组件首次挂载时加载用户配置
    loadUserConfig();
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    if (typeof window !== "undefined") {
      window.addEventListener("income:refresh", handler);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("income:refresh", handler);
      }
    };
    // 移除 fxRates 依赖，因为它是一个对象引用，会导致无限循环
  }, [startYM, endYM]);

  // 使用 useMemo 来处理预测数据的币种转换，避免在 load 函数中依赖 convert
  const convertedForecast = useMemo(() => {
    return forecast.map((item: any) => {
      // 创建一个新对象，避免修改原始数据
      const convertedItem = { ...item };

      // 只有在 item.currency 存在且有效时才进行转换
      if (item.currency && supportedCurrencies.includes(item.currency)) {
        // 月度总收入
        if (item.grossThisMonth) {
          convertedItem.grossThisMonth = convert(
            Number(item.grossThisMonth),
            item.currency,
            userBaseCurrency
          );
        }

        // 月度净收入
        if (item.net) {
          convertedItem.net = convert(
            Number(item.net),
            item.currency,
            userBaseCurrency
          );
        }

        // 社保
        if (item.socialInsuranceThisMonth) {
          convertedItem.socialInsuranceThisMonth = convert(
            Number(item.socialInsuranceThisMonth),
            item.currency,
            userBaseCurrency
          );
        }

        // 公积金
        if (item.housingFundThisMonth) {
          convertedItem.housingFundThisMonth = convert(
            Number(item.housingFundThisMonth),
            item.currency,
            userBaseCurrency
          );
        }

        // 税收
        if (item.taxThisMonth) {
          convertedItem.taxThisMonth = convert(
            Number(item.taxThisMonth),
            item.currency,
            userBaseCurrency
          );
        }

        // 工资
        if (item.salaryThisMonth) {
          convertedItem.salaryThisMonth = convert(
            Number(item.salaryThisMonth),
            item.currency,
            userBaseCurrency
          );
        }

        // 奖金
        if (item.bonusThisMonth) {
          convertedItem.bonusThisMonth = convert(
            Number(item.bonusThisMonth),
            item.currency,
            userBaseCurrency
          );
        }

        // 长期现金
        if (item.longTermCashThisMonth) {
          convertedItem.longTermCashThisMonth = convert(
            Number(item.longTermCashThisMonth),
            item.currency,
            userBaseCurrency
          );
        }

        // 累计收入
        if (item.cumulativeIncome) {
          convertedItem.cumulativeIncome = convert(
            Number(item.cumulativeIncome),
            item.currency,
            userBaseCurrency
          );
        }
      }

      return convertedItem;
    });
  }, [forecast, convert, userBaseCurrency, supportedCurrencies]);

  const chartData = useMemo(() => {
    const arr = convertedForecast
      .map((r: any) => ({
        ym:
          r.ym ||
          `${new Date().getFullYear()}-${String(r.month).padStart(2, "0")}`,
        taxBefore: Number(r.grossThisMonth || 0),
        taxAfter: Number(r.net || 0),
      }))
      .sort((a: any, b: any) => a.ym.localeCompare(b.ym));
    return arr;
  }, [convertedForecast]);

  const cumulativeData = useMemo(() => {
    let cg = 0;
    let cn = 0;
    return chartData.map((x: any) => {
      cg += x.taxBefore;
      cn += x.taxAfter;
      return { ym: x.ym, cumBefore: cg, cumAfter: cn };
    });
  }, [chartData]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">个人收入管理</h1>
        <Link href="/income/summary">
          <Button variant="outline">查看汇总报表</Button>
        </Link>
      </div>

      {/* 全局消息提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {fxError && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          汇率加载失败: {fxError}
        </div>
      )}

      {/* 用户设置 */}
      <Card>
        <CardHeader>
          <CardTitle>用户设置</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="baseCurrency">基准币种</Label>
              <select
                id="baseCurrency"
                value={userBaseCurrency}
                onChange={(e) => {
                  setUserBaseCurrency(e.target.value);
                  // 更新用户基准币种
                  fetch("/api/user/profile", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ baseCurrency: e.target.value }),
                  }).then(() => {
                    // useEffect 会因 userBaseCurrency 变化而重新 load
                  });
                }}
                className="border rounded px-3 py-2"
              >
                <option value="CNY">人民币 (¥)</option>
                <option value="HKD">港元 (HK$)</option>
                <option value="USD">美元 ($)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <IncomeForm />

      <LongTermCashForm
        onAdd={async (data) => {
          try {
            const response = await fetch("/api/income/long-term-cash", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });

            const result = await response.json();
            if (!result.success) {
              throw new Error(result.error?.message || "添加失败");
            }

            setSuccess("长期现金添加成功");
            await load();

            // 通知其它组件刷新
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("income:refresh"));
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "添加失败");
          }
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>工资变更记录（最近）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">生效日期</th>
                    <th className="text-left py-2">月薪</th>
                    <th className="text-left py-2">币种</th>
                    <th className="text-left py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="py-2">
                        {new Date(r.effectiveFrom).toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        {formatCurrencyWithSeparator(
                          convert(
                            Number(r.grossMonthly),
                            r.currency,
                            userBaseCurrency
                          )
                        )}
                      </td>
                      <td className="py-2">{r.currency}</td>
                      <td className="py-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteIncomeChange(r.id)}
                          disabled={loading}
                        >
                          删除
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>奖金计划（最近）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">生效日期</th>
                    <th className="text-left py-2">金额</th>
                    <th className="text-left py-2">币种</th>
                    <th className="text-left py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {bonuses.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="py-2">
                        {new Date(r.effectiveDate).toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        {formatCurrencyWithSeparator(
                          convert(
                            Number(r.amount),
                            r.currency,
                            userBaseCurrency
                          )
                        )}
                      </td>
                      <td className="py-2">{r.currency}</td>
                      <td className="py-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteBonusPlan(r.id)}
                          disabled={loading}
                        >
                          删除
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>长期现金计划（最近）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">生效日期</th>
                    <th className="text-left py-2">总金额</th>
                    <th className="text-left py-2">币种</th>
                    <th className="text-left py-2">每季度金额</th>
                    <th className="text-left py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {longTermCash.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="py-2">
                        {new Date(r.effectiveDate).toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        {formatCurrencyWithSeparator(
                          convert(
                            Number(r.totalAmount),
                            r.currency,
                            userBaseCurrency
                          )
                        )}
                      </td>
                      <td className="py-2">{r.currency}</td>
                      <td className="py-2">
                        {formatCurrencyWithSeparator(
                          convert(
                            Number(r.totalAmount) / 16,
                            r.currency,
                            userBaseCurrency
                          )
                        )}
                      </td>
                      <td className="py-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteLongTermCash(r.id)}
                          disabled={loading}
                        >
                          删除
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>收入预测</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-2 text-sm text-gray-600">
            以下数据已转换为基准币种 ({userBaseCurrency}) 显示。
          </div>
          <CardContent>
            <div className="mb-2 text-sm text-gray-600">
              总工资收入：{formatCurrencyWithSeparator(totals.totalSalary)} ｜
              总奖金收入：
              {formatCurrencyWithSeparator(totals.totalBonus)} ｜ 总长期现金：
              {formatCurrencyWithSeparator(totals.totalLongTermCash)} ｜
              总税前：
              {formatCurrencyWithSeparator(totals.totalGross)} ｜ 总税收：
              {formatCurrencyWithSeparator(totals.totalTax)} ｜ 总税后：
              {formatCurrencyWithSeparator(totals.totalNet)}
            </div>
            <div className="mb-2 text-sm text-gray-600">
              * 以上金额已根据您的基准币种 ({userBaseCurrency}) 进行转换显示
            </div>
            <div className="flex gap-4 mb-4 items-center flex-wrap">
              <span>预测区间：</span>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const d = new Date();
                    const currentYear = d.getFullYear();
                    setStartYM(`${currentYear - 3}-01`);
                    setEndYM(`${currentYear}-12`);
                  }}
                >
                  过去三年
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const d = new Date();
                    const currentYear = d.getFullYear();
                    setStartYM(`${currentYear - 2}-01`);
                    setEndYM(`${currentYear}-12`);
                  }}
                >
                  过去两年
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const d = new Date();
                    const currentYear = d.getFullYear();
                    setStartYM(`${currentYear - 1}-01`);
                    setEndYM(`${currentYear - 1}-12`);
                  }}
                >
                  去年
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const d = new Date();
                    const currentYear = d.getFullYear();
                    setStartYM(`${currentYear}-01`);
                    setEndYM(`${currentYear}-12`);
                  }}
                >
                  今年（全年）
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const d = new Date();
                    const currentYear = d.getFullYear();
                    const currentMonth = String(d.getMonth() + 1).padStart(
                      2,
                      "0"
                    );
                    setStartYM(`${currentYear}-01`);
                    setEndYM(`${currentYear}-${currentMonth}`);
                  }}
                >
                  今年（至当前月）
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const d = new Date();
                    const currentYear = d.getFullYear();
                    setStartYM(`${currentYear + 1}-01`);
                    setEndYM(`${currentYear + 2}-12`);
                  }}
                >
                  未来两年
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const d = new Date();
                    const currentYear = d.getFullYear();
                    setStartYM(`${currentYear + 1}-01`);
                    setEndYM(`${currentYear + 3}-12`);
                  }}
                >
                  未来三年
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span>开始</span>
                <input
                  type="month"
                  className="border rounded px-2 py-1"
                  value={startYM}
                  onChange={(e) => setStartYM(e.target.value)}
                />
                <span>结束</span>
                <input
                  type="month"
                  className="border rounded px-2 py-1"
                  value={endYM}
                  onChange={(e) => setEndYM(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">月份</th>
                    <th className="text-left py-2">税前总收入</th>
                    <th className="text-left py-2">税后总收入</th>
                    <th className="text-left py-2">社保</th>
                    <th className="text-left py-2">公积金</th>
                    <th className="text-left py-2">税</th>
                    <th className="text-left py-2">工资</th>
                    <th className="text-left py-2">奖金</th>
                    <th className="text-left py-2">长期现金</th>
                    <th className="text-left py-2">适用税率</th>
                    <th className="text-left py-2">备注</th>
                    <th className="text-left py-2">累计总收入</th>
                  </tr>
                </thead>
                <tbody>
                  {convertedForecast.map((r: any) => (
                    <tr
                      key={r.month}
                      className={`border-b cursor-pointer hover:bg-gray-50 ${
                        selectedMonth === r.ym ? "bg-blue-50" : ""
                      }`}
                      onClick={() => setSelectedMonth(r.ym)}
                    >
                      <td className="py-2">
                        {r.ym ||
                          `${new Date().getFullYear()}-${String(
                            r.month
                          ).padStart(2, "0")}`}
                      </td>
                      <td className="py-2 font-semibold">
                        {r.grossThisMonth
                          ? formatCurrencyWithSeparator(r.grossThisMonth)
                          : "-"}
                      </td>
                      <td className="py-2 font-semibold text-green-600">
                        {r.net ? formatCurrencyWithSeparator(r.net) : "-"}
                      </td>
                      <td className="py-2 text-blue-600">
                        {r.socialInsuranceThisMonth
                          ? formatCurrencyWithSeparator(
                              r.socialInsuranceThisMonth
                            )
                          : "-"}
                      </td>
                      <td className="py-2 text-purple-600">
                        {r.housingFundThisMonth
                          ? formatCurrencyWithSeparator(r.housingFundThisMonth)
                          : "-"}
                      </td>
                      <td className="py-2 text-red-600">
                        {r.taxThisMonth
                          ? formatCurrencyWithSeparator(r.taxThisMonth)
                          : "-"}
                      </td>
                      <td className="py-2">
                        {r.salaryThisMonth
                          ? formatCurrencyWithSeparator(r.salaryThisMonth)
                          : "-"}
                      </td>
                      <td className="py-2 font-medium text-orange-600">
                        {r.bonusThisMonth && Number(r.bonusThisMonth) > 0
                          ? formatCurrencyWithSeparator(r.bonusThisMonth)
                          : "-"}
                      </td>
                      <td className="py-2 font-medium text-blue-600">
                        {r.longTermCashThisMonth &&
                        Number(r.longTermCashThisMonth) > 0
                          ? formatCurrencyWithSeparator(r.longTermCashThisMonth)
                          : "-"}
                      </td>
                      <td className="py-2">
                        {r.appliedTaxRate != null
                          ? `${Number(r.appliedTaxRate).toFixed(2)}%`
                          : "-"}
                      </td>
                      <td className="py-2 text-sm text-gray-600">
                        {[
                          r.markers?.salaryChange ? "工资变动" : null,
                          r.markers?.bonusPaid ? "奖金" : null,
                          r.markers?.longTermCashPaid
                            ? `长期现金(${r.longTermCashCount}期)`
                            : null,
                          r.markers?.taxChange ? "税务调整" : null,
                        ]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </td>
                      <td className="py-2">
                        {r.cumulativeIncome
                          ? formatCurrencyWithSeparator(r.cumulativeIncome)
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ym" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="taxBefore" name="税前总收入" fill="#8884d8" />
                    <Bar dataKey="taxAfter" name="税后总收入" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumulativeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ym" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="cumBefore"
                      name="累计税前收入"
                      stroke="#8884d8"
                    />
                    <Line
                      type="monotone"
                      dataKey="cumAfter"
                      name="累计税后收入"
                      stroke="#82ca9d"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {selectedMonth && (
              <LongTermCashDetail
                longTermCash={longTermCash}
                selectedMonth={selectedMonth}
              />
            )}
          </CardContent>
        </CardContent>
      </Card>
    </div>
  );
}
