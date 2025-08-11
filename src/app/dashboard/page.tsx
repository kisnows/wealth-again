import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  // 这里应该从API获取实际数据
  const incomeData = {
    monthlyIncome: 20000,
    annualIncome: 240000,
    annualTax: 35000,
    annualNetIncome: 205000,
  };

  const investmentData = {
    totalValue: 500000,
    todayPnl: 1500,
    monthlyPnl: 12000,
    annualReturn: 0.12,
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">财务概览</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>收入概览</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>本月税前收入</span>
                <span className="font-semibold">{formatCurrency(incomeData.monthlyIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span>年度税前收入</span>
                <span className="font-semibold">{formatCurrency(incomeData.annualIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span>年度税收</span>
                <span className="font-semibold text-red-500">{formatCurrency(incomeData.annualTax)}</span>
              </div>
              <div className="flex justify-between">
                <span>年度税后收入</span>
                <span className="font-semibold">{formatCurrency(incomeData.annualNetIncome)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>投资概览</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>总投资价值</span>
                <span className="font-semibold">{formatCurrency(investmentData.totalValue)}</span>
              </div>
              <div className="flex justify-between">
                <span>今日盈亏</span>
                <span className={`font-semibold ${investmentData.todayPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatCurrency(investmentData.todayPnl)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>本月盈亏</span>
                <span className={`font-semibold ${investmentData.monthlyPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatCurrency(investmentData.monthlyPnl)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>年度收益率</span>
                <span className="font-semibold">{(investmentData.annualReturn * 100).toFixed(2)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>财务健康度</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span>储蓄率</span>
                  <span>25%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '25%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span>投资资产占比</span>
                  <span>60%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-green-600 h-2.5 rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}