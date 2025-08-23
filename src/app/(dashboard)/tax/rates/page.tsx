"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowLeft,
  Edit,
  Save,
  X,
  Plus,
  Info
} from "lucide-react";

interface TaxBracket {
  id: string;
  minIncome: number;
  maxIncome?: number;
  rate: number;
  quickDeduction: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export default function TaxRatesPage() {
  const [taxBrackets, setTaxBrackets] = useState<TaxBracket[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 默认的国家标准税率表 (2025年)
  const defaultTaxBrackets: Omit<TaxBracket, 'id' | 'effectiveFrom' | 'effectiveTo'>[] = [
    { minIncome: 0, maxIncome: 36000, rate: 3, quickDeduction: 0 },
    { minIncome: 36000, maxIncome: 144000, rate: 10, quickDeduction: 2520 },
    { minIncome: 144000, maxIncome: 300000, rate: 20, quickDeduction: 16920 },
    { minIncome: 300000, maxIncome: 420000, rate: 25, quickDeduction: 31920 },
    { minIncome: 420000, maxIncome: 660000, rate: 30, quickDeduction: 52920 },
    { minIncome: 660000, maxIncome: 960000, rate: 35, quickDeduction: 85920 },
    { minIncome: 960000, rate: 45, quickDeduction: 181920 }
  ];

  useEffect(() => {
    // 模拟加载税率数据
    const mockData: TaxBracket[] = defaultTaxBrackets.map((bracket, index) => ({
      ...bracket,
      id: `bracket_${index + 1}`,
      effectiveFrom: "2025-01-01"
    }));
    
    setTaxBrackets(mockData);
    setLoading(false);
  }, []);

  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString()}`;
  };

  const formatPercentage = (rate: number) => {
    return `${rate}%`;
  };

  const getIncomeRange = (bracket: TaxBracket) => {
    if (!bracket.maxIncome) {
      return `≥ ${formatCurrency(bracket.minIncome)}`;
    }
    if (bracket.minIncome === 0) {
      return `≤ ${formatCurrency(bracket.maxIncome)}`;
    }
    return `${formatCurrency(bracket.minIncome)} - ${formatCurrency(bracket.maxIncome)}`;
  };

  const startEdit = (id: string) => {
    setEditingId(id);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = (id: string) => {
    // 这里应该调用API保存数据
    console.log('Saving tax bracket:', id);
    setEditingId(null);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* 页面头部 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Link href="/tax">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回税务管理
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">税率管理</h1>
            <p className="text-gray-600 mt-2">
              个人所得税七级超额累进税率表管理
            </p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <Button variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            添加税率档次
          </Button>
        </div>
      </div>

      {/* 税率说明卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Info className="w-5 h-5 text-blue-600" />
            <span>税率计算说明</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <strong>适用范围：</strong>
            本税率表适用于居民个人综合所得（工资薪金、劳务报酬、稿酬、特许权使用费）的年度汇算清缴。
          </div>
          <div>
            <strong>计算公式：</strong>
            应纳税额 = 应纳税所得额 × 适用税率 - 速算扣除数
          </div>
          <div>
            <strong>应纳税所得额：</strong>
            年度收入总额 - 费用扣除（60,000元） - 专项扣除（五险一金） - 专项附加扣除 - 其他扣除
          </div>
        </CardContent>
      </Card>

      {/* 当前生效税率表 */}
      <Card>
        <CardHeader>
          <CardTitle>当前生效税率表</CardTitle>
          <p className="text-sm text-gray-600">生效时间：2025年1月1日 至今</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>级数</TableHead>
                  <TableHead>应纳税所得额（年度）</TableHead>
                  <TableHead>税率</TableHead>
                  <TableHead>速算扣除数</TableHead>
                  <TableHead>生效时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxBrackets.map((bracket, index) => (
                  <TableRow key={bracket.id}>
                    <TableCell className="font-medium">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      {getIncomeRange(bracket)}
                    </TableCell>
                    <TableCell>
                      {editingId === bracket.id ? (
                        <Input
                          type="number"
                          defaultValue={bracket.rate}
                          className="w-20"
                          min="0"
                          max="100"
                        />
                      ) : (
                        <span className="text-green-600 font-semibold">
                          {formatPercentage(bracket.rate)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === bracket.id ? (
                        <Input
                          type="number"
                          defaultValue={bracket.quickDeduction}
                          className="w-24"
                          min="0"
                        />
                      ) : (
                        formatCurrency(bracket.quickDeduction)
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(bracket.effectiveFrom).toLocaleDateString('zh-CN')}
                      {bracket.effectiveTo && (
                        <span> - {new Date(bracket.effectiveTo).toLocaleDateString('zh-CN')}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === bracket.id ? (
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            onClick={() => saveEdit(bracket.id)}
                          >
                            <Save className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(bracket.id)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 税负计算示例 */}
      <Card>
        <CardHeader>
          <CardTitle>税负计算示例</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-lg font-semibold text-blue-800">年收入 ¥100,000</div>
              <div className="text-sm text-blue-600 mt-2">
                应纳税所得额：¥40,000<br/>
                适用税率：10%<br/>
                速算扣除数：¥2,520<br/>
                <strong>应纳税额：¥1,480</strong>
              </div>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-lg font-semibold text-green-800">年收入 ¥200,000</div>
              <div className="text-sm text-green-600 mt-2">
                应纳税所得额：¥140,000<br/>
                适用税率：10%<br/>
                速算扣除数：¥2,520<br/>
                <strong>应纳税额：¥11,480</strong>
              </div>
            </div>
            
            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="text-lg font-semibold text-orange-800">年收入 ¥500,000</div>
              <div className="text-sm text-orange-600 mt-2">
                应纳税所得额：¥440,000<br/>
                适用税率：30%<br/>
                速算扣除数：¥52,920<br/>
                <strong>应纳税额：¥79,080</strong>
              </div>
            </div>
          </div>
          
          <div className="mt-4 text-xs text-gray-500">
            * 示例基于年度费用扣除60,000元，未考虑专项扣除和专项附加扣除
          </div>
        </CardContent>
      </Card>

      {/* 历史版本 */}
      <Card>
        <CardHeader>
          <CardTitle>历史税率版本</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            暂无历史税率版本记录
          </div>
          <div className="flex justify-center">
            <Button variant="outline" size="sm">
              查看历史版本
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}