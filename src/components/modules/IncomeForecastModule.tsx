"use client";

import {
  BarChart3Icon,
  CalculatorIcon,
  CalendarIcon,
  HistoryIcon,
  LineChartIcon,
  TableIcon,
  TrendingUpIcon,
} from "lucide-react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import CitySelect from "@/components/modules/CitySelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchIncomeForecast,
  fetchIncomeTimeseries,
} from "@/lib/api/income-management";
import { formatMoney } from "@/lib/domain/money";
import {
  selectForecastState,
  selectTimeseriesState,
  useIncomeStore,
} from "@/lib/state/income";
import { useUserPrefsStore } from "@/lib/state/user-prefs";

export default function IncomeForecastModule() {
  const { displayCurrency, currentCity } = useUserPrefsStore();
  const currency = displayCurrency || "CNY";

  const {
    data: forecastData,
    loading: forecastLoading,
    error: forecastError,
    params: forecastParams,
  } = useIncomeStore(selectForecastState);

  const {
    data: timeseriesData,
    loading: timeseriesLoading,
    error: timeseriesError,
  } = useIncomeStore(selectTimeseriesState);

  const {
    setForecastParams,
    setForecastData,
    setForecastLoading,
    setForecastError,
    setTimeseriesData,
    setTimeseriesLoading,
    setTimeseriesError,
  } = useIncomeStore();

  // 计算汇总统计
  const statistics = forecastData
    ? {
        totalGrossIncome: forecastData.reduce(
          (sum, item) => sum + item.grossIncome,
          0,
        ),
        totalNetIncome: forecastData.reduce(
          (sum, item) => sum + item.netIncome,
          0,
        ),
        totalSocialInsurance: forecastData.reduce(
          (sum, item) => sum + item.socialInsurance,
          0,
        ),
        totalHousingFund: forecastData.reduce(
          (sum, item) => sum + item.housingFund,
          0,
        ),
        totalTax: forecastData.reduce((sum, item) => sum + item.incomeTax, 0),
        averageTaxRate:
          forecastData.length > 0
            ? forecastData.reduce((sum, item) => sum + item.taxRate, 0) /
              forecastData.length
            : 0,
      }
    : null;

  // 执行预测计算
  const handleForecast = async () => {
    setForecastLoading(true);
    setForecastError(null);

    try {
      const result = await fetchIncomeForecast(forecastParams);
      setForecastData(result.items);

      // 同时获取时序数据用于图表
      const timeseriesResult = await fetchIncomeTimeseries(
        forecastParams.startDate,
        forecastParams.endDate,
      );
      setTimeseriesData(timeseriesResult.series);

      toast.success("预测计算完成");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "预测计算失败";
      setForecastError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setForecastLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="income-ui-forecast-module">
      <div>
        <h2 className="text-xl font-semibold text-foreground">收入预测</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          基于当前收入配置计算指定时间范围的月度预测；回算任务请通过下方入口统一管理。
        </p>
      </div>

      {/* 预测参数 */}
      <Card data-testid="income-ui-forecast-params">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalculatorIcon className="h-5 w-5 text-primary" />
            预测参数
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            设置预测时间范围和计算参数
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 快捷时间区间按钮 */}
            <div>
              <Label className="text-sm font-medium text-muted-foreground">
                快捷选择
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  onClick={() => {
                    const currentYear = new Date().getFullYear();
                    const today = new Date().toISOString().substring(0, 10);
                    setForecastParams({
                      startDate: `${currentYear}-01-01`,
                      endDate: today,
                    });
                  }}
                  size="sm"
                  variant="outline"
                >
                  今年至今
                </Button>
                <Button
                  onClick={() => {
                    const lastYear = new Date().getFullYear() - 1;
                    setForecastParams({
                      startDate: `${lastYear}-01-01`,
                      endDate: `${lastYear}-12-31`,
                    });
                  }}
                  size="sm"
                  variant="outline"
                >
                  去年
                </Button>
                <Button
                  onClick={() => {
                    const currentYear = new Date().getFullYear();
                    const twoYearsAgo = currentYear - 2;
                    const lastYear = currentYear - 1;
                    setForecastParams({
                      startDate: `${twoYearsAgo}-01-01`,
                      endDate: `${lastYear}-12-31`,
                    });
                  }}
                  size="sm"
                  variant="outline"
                >
                  过去两年
                </Button>
                <Button
                  onClick={() => {
                    const nextYear = new Date().getFullYear() + 1;
                    setForecastParams({
                      startDate: `${nextYear}-01-01`,
                      endDate: `${nextYear}-12-31`,
                    });
                  }}
                  size="sm"
                  variant="outline"
                >
                  明年
                </Button>
                <Button
                  onClick={() => {
                    const nextYear = new Date().getFullYear() + 1;
                    const nextTwoYear = nextYear + 1;
                    setForecastParams({
                      startDate: `${nextYear}-01-01`,
                      endDate: `${nextTwoYear}-12-31`,
                    });
                  }}
                  size="sm"
                  variant="outline"
                >
                  接下来两年
                </Button>
              </div>
            </div>

            {/* 详细参数设置 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="startDate">开始时间</Label>
                <Input
                  id="startDate"
                  onChange={(e) =>
                    setForecastParams({ startDate: e.target.value })
                  }
                  type="date"
                  value={forecastParams.startDate}
                />
              </div>
              <div>
                <Label htmlFor="endDate">结束时间</Label>
                <Input
                  id="endDate"
                  onChange={(e) =>
                    setForecastParams({ endDate: e.target.value })
                  }
                  type="date"
                  value={forecastParams.endDate}
                />
              </div>
              <div>
                <Label htmlFor="cityId">城市（可选）</Label>
                <CitySelect
                  onValueChange={(value) =>
                    setForecastParams({ cityId: value || undefined })
                  }
                  placeholder="留空使用当前城市"
                  value={forecastParams.cityId || ""}
                />
              </div>
              <div className="flex items-end">
                <Button
                  className="mt-6 w-full md:w-auto"
                  disabled={forecastLoading}
                  onClick={handleForecast}
                >
                  {forecastLoading ? "计算中..." : "计算预测"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="income-ui-forecast-recalc-cta">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HistoryIcon className="h-5 w-5 text-primary" />
            回算任务入口
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            所有自动与手动回算操作现已集中到“回算任务中心”，支持队列状态、立即回算与审计追踪。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            当工资、奖金、长期现金等输入变动时，系统会自动汇总任务。需要即时结果时，可前往任务中心手动触发或查看执行日志。
          </p>
          <Button asChild size="sm" variant="secondary">
            <Link data-testid="income-ui-forecast-recalc-link" href="/income/recalc-status">
              打开回算任务中心
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* 汇总统计 */}
      {statistics && (
        <Card data-testid="income-ui-forecast-summary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUpIcon className="w-5 h-5" />
              汇总统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-lg border border-border/60 bg-primary/5 p-3 text-center">
                <div className="mb-1 text-xl font-semibold text-primary">
                  {formatMoney(statistics.totalGrossIncome, currency)}
                </div>
                <div className="text-sm text-muted-foreground">总税前收入</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-emerald-500/10 p-3 text-center">
                <div className="mb-1 text-xl font-semibold text-emerald-600">
                  {formatMoney(statistics.totalNetIncome, currency)}
                </div>
                <div className="text-sm text-muted-foreground">总税后收入</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-amber-500/10 p-3 text-center">
                <div className="mb-1 text-xl font-semibold text-amber-600">
                  {formatMoney(statistics.totalSocialInsurance, currency)}
                </div>
                <div className="text-sm text-muted-foreground">总社保</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-violet-500/10 p-3 text-center">
                <div className="mb-1 text-xl font-semibold text-violet-600">
                  {formatMoney(statistics.totalHousingFund, currency)}
                </div>
                <div className="text-sm text-muted-foreground">总公积金</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-red-500/10 p-3 text-center">
                <div className="mb-1 text-xl font-semibold text-red-600">
                  {formatMoney(statistics.totalTax, currency)}
                </div>
                <div className="text-sm text-muted-foreground">总个税</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-center">
                <div className="mb-1 text-xl font-semibold text-foreground">
                  {(statistics.averageTaxRate * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">平均税率</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 图表展示 */}
      <Card data-testid="income-ui-forecast-results">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3Icon className="h-5 w-5 text-primary" />
                预测结果
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                月度收入预测详情
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {forecastLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              正在计算预测...
            </div>
          ) : forecastError ? (
            <div className="py-8 text-center text-sm text-destructive">
              {forecastError}
            </div>
          ) : !forecastData || forecastData.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              请点击“计算预测”开始预测
            </div>
          ) : (
            <div className="space-y-8">
              {/* 预测结果表格 */}
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <TableIcon className="h-5 w-5 text-primary" />
                  预测结果详情
                </h3>
                <ForecastTable currency={currency} data={forecastData} />
              </div>

              {/* 柱状图 */}
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <BarChart3Icon className="h-5 w-5 text-primary" />
                  收入构成分析
                </h3>
                <ForecastBarChart currency={currency} data={forecastData} />
              </div>

              {/* 趋势图 */}
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <LineChartIcon className="h-5 w-5 text-primary" />
                  收入趋势分析
                </h3>
                <ForecastTrendChart currency={currency} data={forecastData} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// 预测结果表格组件
function ForecastTable({ data, currency }: { data: any[]; currency: string }) {
  return (
    <div className="overflow-x-auto" data-testid="income-ui-forecast-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>月份</TableHead>
            <TableHead>工资</TableHead>
            <TableHead>奖金</TableHead>
            <TableHead>长期现金</TableHead>
            <TableHead>税前收入</TableHead>
            <TableHead>社保</TableHead>
            <TableHead>公积金</TableHead>
            <TableHead>个税</TableHead>
            <TableHead>税率</TableHead>
            <TableHead>税后收入</TableHead>
            <TableHead className="bg-blue-50">累计税前</TableHead>
            <TableHead className="bg-green-50">累计税后</TableHead>
            <TableHead className="bg-orange-50">累计社保</TableHead>
            <TableHead className="bg-purple-50">累计公积金</TableHead>
            <TableHead className="bg-red-50">累计个税</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.month}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  {new Date(item.month).toLocaleDateString("zh-CN", {
                    year: "numeric",
                    month: "short",
                  })}
                </div>
              </TableCell>
              <TableCell>{formatMoney(item.salary, currency)}</TableCell>
              <TableCell>
                {item.bonus > 0 ? (
                  <span className="font-medium text-emerald-600">
                    {formatMoney(item.bonus, currency)}
                  </span>
                ) : (
                  <span className="text-muted-foreground/70">-</span>
                )}
              </TableCell>
              <TableCell>
                {item.longTermCash > 0 ? (
                  <span className="font-medium text-primary">
                    {formatMoney(item.longTermCash, currency)}
                  </span>
                ) : (
                  <span className="text-muted-foreground/70">-</span>
                )}
              </TableCell>
              <TableCell className="font-medium">
                {formatMoney(item.grossIncome, currency)}
              </TableCell>
              <TableCell className="text-orange-600">
                {formatMoney(item.socialInsurance, currency)}
              </TableCell>
              <TableCell className="text-purple-600">
                {formatMoney(item.housingFund, currency)}
              </TableCell>
              <TableCell className="text-red-600">
                {formatMoney(item.incomeTax, currency)}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {(item.taxRate * 100).toFixed(1)}%
                </Badge>
              </TableCell>
              <TableCell className="font-bold text-green-600">
                {formatMoney(item.netIncome, currency)}
              </TableCell>
              <TableCell className="font-bold text-blue-600 bg-blue-50">
                {formatMoney(item.cumulativeGrossIncome, currency)}
              </TableCell>
              <TableCell className="font-bold text-green-600 bg-green-50">
                {formatMoney(item.cumulativeNetIncome, currency)}
              </TableCell>
              <TableCell className="font-bold text-orange-600 bg-orange-50">
                {formatMoney(item.cumulativeSocialInsurance, currency)}
              </TableCell>
              <TableCell className="font-bold text-purple-600 bg-purple-50">
                {formatMoney(item.cumulativeHousingFund, currency)}
              </TableCell>
              <TableCell className="font-bold text-red-600 bg-red-50">
                {formatMoney(item.cumulativeIncomeTax, currency)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// 柱状图组件
function ForecastBarChart({
  data,
  currency,
}: {
  data: any[];
  currency: string;
}) {
  // 格式化数据用于柱状图
  const chartData = data.map((item) => ({
    month: new Date(item.month).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
    }),
    工资: item.salary,
    奖金: item.bonus,
    长期现金: item.longTermCash,
    股权收入: item.equityIncome,
    社保: item.socialInsurance,
    公积金: item.housingFund,
    个税: item.incomeTax,
    税后收入: item.netIncome,
  }));

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-border/60 bg-card p-4 shadow-lg">
          <p className="mb-2 font-medium text-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p className="text-sm" key={index} style={{ color: entry.color }}>
              {entry.dataKey}: {formatMoney(entry.value, currency)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card data-testid="income-ui-forecast-chart-bar">
      <CardContent className="pt-6">
        <ResponsiveContainer height={400} width="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />
            <XAxis dataKey="month" stroke="#666" tick={{ fontSize: 12 }} />
            <YAxis
              stroke="#666"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="工资" fill="#3b82f6" stackId="income" />
            <Bar dataKey="奖金" fill="#10b981" stackId="income" />
            <Bar dataKey="长期现金" fill="#f59e0b" stackId="income" />
            <Bar dataKey="股权收入" fill="#8b5cf6" stackId="income" />
            <Bar dataKey="税后收入" fill="#ef4444" fillOpacity={0.8} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// 趋势图组件
function ForecastTrendChart({
  data,
  currency,
}: {
  data: any[];
  currency: string;
}) {
  // 格式化数据用于趋势图
  const chartData = data.map((item) => ({
    month: new Date(item.month).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
    }),
    税前收入: item.grossIncome,
    税后收入: item.netIncome,
    累计税前: item.cumulativeGrossIncome,
    累计税后: item.cumulativeNetIncome,
    个税: item.incomeTax,
    社保: item.socialInsurance,
    公积金: item.housingFund,
    税率: (item.taxRate * 100).toFixed(1),
  }));

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-border/60 bg-card p-4 shadow-lg">
          <p className="mb-2 font-medium text-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p className="text-sm" key={index} style={{ color: entry.color }}>
              {entry.dataKey === "税率"
                ? `${entry.dataKey}: ${entry.value}%`
                : `${entry.dataKey}: ${formatMoney(entry.value, currency)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6" data-testid="income-ui-forecast-chart-trend-group">
      {/* 月度收入趋势 */}
      <Card data-testid="income-ui-forecast-chart-trend-monthly">
        <CardHeader>
          <CardTitle className="text-base">月度收入趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer height={300} width="100%">
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="#666" tick={{ fontSize: 12 }} />
              <YAxis
                stroke="#666"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                dataKey="税前收入"
                dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                stroke="#3b82f6"
                strokeWidth={2}
                type="monotone"
              />
              <Line
                dataKey="税后收入"
                dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
                stroke="#10b981"
                strokeWidth={2}
                type="monotone"
              />
              <Line
                dataKey="个税"
                dot={{ fill: "#ef4444", strokeWidth: 2, r: 4 }}
                stroke="#ef4444"
                strokeWidth={2}
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 累计收入趋势 */}
      <Card data-testid="income-ui-forecast-chart-trend-cumulative">
        <CardHeader>
          <CardTitle className="text-base">累计收入趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer height={300} width="100%">
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="#666" tick={{ fontSize: 12 }} />
              <YAxis
                stroke="#666"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                dataKey="累计税前"
                dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 4 }}
                stroke="#8b5cf6"
                strokeWidth={2}
                type="monotone"
              />
              <Line
                dataKey="累计税后"
                dot={{ fill: "#f59e0b", strokeWidth: 2, r: 4 }}
                stroke="#f59e0b"
                strokeWidth={2}
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 税率趋势 */}
      <Card data-testid="income-ui-forecast-chart-trend-tax">
        <CardHeader>
          <CardTitle className="text-base">税率变化趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer height={200} width="100%">
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="#666" tick={{ fontSize: 12 }} />
              <YAxis
                stroke="#666"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                formatter={(value) => [`${value}%`, "边际税率"]}
                labelFormatter={(label) => `月份: ${label}`}
              />
              <Legend />
              <Line
                dataKey="税率"
                dot={{ fill: "#dc2626", strokeWidth: 2, r: 5 }}
                stroke="#dc2626"
                strokeWidth={3}
                type="monotone"
              />
              <ReferenceLine
                label="3%"
                stroke="#fbbf24"
                strokeDasharray="5 5"
                y={3}
              />
              <ReferenceLine
                label="10%"
                stroke="#f97316"
                strokeDasharray="5 5"
                y={10}
              />
              <ReferenceLine
                label="20%"
                stroke="#ef4444"
                strokeDasharray="5 5"
                y={20}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
