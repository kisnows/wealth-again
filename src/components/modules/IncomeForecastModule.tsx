"use client";

import {
  BarChart3Icon,
  CalculatorIcon,
  CalendarIcon,
  LineChartIcon,
  TableIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CitySelect from "@/components/modules/CitySelect";
import {
  fetchIncomeForecast,
  fetchIncomeTimeseries,
  triggerIncomeRecalc,
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
  
  const [viewMode, setViewMode] = useState<"table" | "bar" | "trend">("table");
  const [isRecalculating, setIsRecalculating] = useState(false);
  
  // 计算汇总统计
  const statistics = forecastData ? {
    totalGrossIncome: forecastData.reduce((sum, item) => sum + item.grossIncome, 0),
    totalNetIncome: forecastData.reduce((sum, item) => sum + item.netIncome, 0),
    totalSocialInsurance: forecastData.reduce((sum, item) => sum + item.socialInsurance, 0),
    totalHousingFund: forecastData.reduce((sum, item) => sum + item.housingFund, 0),
    totalTax: forecastData.reduce((sum, item) => sum + item.incomeTax, 0),
    averageTaxRate: forecastData.length > 0 ? 
      forecastData.reduce((sum, item) => sum + item.taxRate, 0) / forecastData.length : 0,
  } : null;
  
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
        forecastParams.endDate
      );
      setTimeseriesData(timeseriesResult.series);
      
      toast.success("预测计算完成");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "预测计算失败";
      setForecastError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setForecastLoading(false);
    }
  };
  
  // 执行收入回算
  const handleRecalc = async () => {
    setIsRecalculating(true);
    
    try {
      const startYear = new Date(forecastParams.startDate).getFullYear();
      const endMonth = new Date(forecastParams.endDate).getMonth() + 1;
      
      const result = await triggerIncomeRecalc({
        taxYear: startYear,
        endMonth,
        cityId: forecastParams.cityId,
      });
      
      toast.success(`回算完成，更新了 ${result.updated} 条记录`);
      
      // 重新执行预测
      await handleForecast();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "回算失败";
      toast.error(errorMessage);
    } finally {
      setIsRecalculating(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">收入预测与回算</h2>
          <p className="text-sm text-gray-600 mt-1">
            基于收入配置计算指定时间范围的月度收入明细
          </p>
        </div>
      </div>
      
      {/* 预测参数 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalculatorIcon className="w-5 h-5" />
            预测参数
          </CardTitle>
          <CardDescription>
            设置预测时间范围和计算参数
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="startDate">开始时间</Label>
              <Input
                id="startDate"
                type="date"
                value={forecastParams.startDate}
                onChange={(e) => setForecastParams({ startDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="endDate">结束时间</Label>
              <Input
                id="endDate"
                type="date"
                value={forecastParams.endDate}
                onChange={(e) => setForecastParams({ endDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cityId">城市（可选）</Label>
              <CitySelect
                value={forecastParams.cityId || ""}
                onValueChange={(value) => setForecastParams({ cityId: value || undefined })}
                placeholder="留空使用当前城市"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button 
                onClick={handleForecast}
                disabled={forecastLoading}
                className="flex-1"
              >
                {forecastLoading ? "计算中..." : "计算预测"}
              </Button>
              <Button
                variant="outline"
                onClick={handleRecalc}
                disabled={isRecalculating}
              >
                {isRecalculating ? "回算中..." : "年度回算"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* 汇总统计 */}
      {statistics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUpIcon className="w-5 h-5" />
              汇总统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {formatMoney(statistics.totalGrossIncome, currency)}
                </div>
                <div className="text-sm text-gray-600">总税前收入</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatMoney(statistics.totalNetIncome, currency)}
                </div>
                <div className="text-sm text-gray-600">总税后收入</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {formatMoney(statistics.totalSocialInsurance, currency)}
                </div>
                <div className="text-sm text-gray-600">总社保</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {formatMoney(statistics.totalHousingFund, currency)}
                </div>
                <div className="text-sm text-gray-600">总公积金</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {formatMoney(statistics.totalTax, currency)}
                </div>
                <div className="text-sm text-gray-600">总个税</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {(statistics.averageTaxRate * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">平均税率</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* 图表展示 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3Icon className="w-5 h-5" />
                预测结果
              </CardTitle>
              <CardDescription>
                月度收入预测详情
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("table")}
              >
                <TableIcon className="w-4 h-4 mr-1" />
                表格
              </Button>
              <Button
                variant={viewMode === "bar" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("bar")}
              >
                <BarChart3Icon className="w-4 h-4 mr-1" />
                柱状图
              </Button>
              <Button
                variant={viewMode === "trend" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("trend")}
              >
                <LineChartIcon className="w-4 h-4 mr-1" />
                趋势图
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {forecastLoading ? (
            <div className="text-center py-8 text-gray-500">
              正在计算预测...
            </div>
          ) : forecastError ? (
            <div className="text-center py-8 text-red-500">
              {forecastError}
            </div>
          ) : !forecastData || forecastData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              请点击"计算预测"开始预测
            </div>
          ) : (
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as any)}>
              <TabsContent value="table">
                <ForecastTable data={forecastData} currency={currency} />
              </TabsContent>
              <TabsContent value="bar">
                <div className="text-center py-8 text-gray-500">
                  柱状图组件开发中...
                </div>
              </TabsContent>
              <TabsContent value="trend">
                <div className="text-center py-8 text-gray-500">
                  趋势图组件开发中...
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// 预测结果表格组件
function ForecastTable({ 
  data, 
  currency 
}: { 
  data: any[]; 
  currency: string; 
}) {
  return (
    <div className="overflow-x-auto">
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.month}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-gray-400" />
                  {new Date(item.month).toLocaleDateString("zh-CN", {
                    year: "numeric",
                    month: "short",
                  })}
                </div>
              </TableCell>
              <TableCell>
                {formatMoney(item.salary, currency)}
              </TableCell>
              <TableCell>
                {item.bonus > 0 ? (
                  <span className="text-green-600 font-medium">
                    {formatMoney(item.bonus, currency)}
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </TableCell>
              <TableCell>
                {item.longTermCash > 0 ? (
                  <span className="text-blue-600 font-medium">
                    {formatMoney(item.longTermCash, currency)}
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
