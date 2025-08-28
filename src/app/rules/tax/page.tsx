"use client";

import { CalculatorIcon, InfoIcon, Loader2, SettingsIcon } from "lucide-react";
import { useState } from "react";
import RulesUpsertForm from "@/components/modules/RulesUpsertForm";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  upsertTaxBrackets,
  upsertTaxConfig,
  useTaxBrackets,
} from "@/lib/api/rules";
import { formatMoney } from "@/lib/domain/money";

// 示例数据
const TAX_BRACKETS_EXAMPLE = [
  {
    name: "中国 2025年 个税税率表",
    data: [
      {
        country: "CN",
        taxYear: 2025,
        position: 1,
        threshold: 36000,
        taxRate: 0.03,
        quickDeduction: 0,
      },
      {
        country: "CN",
        taxYear: 2025,
        position: 2,
        threshold: 144000,
        taxRate: 0.1,
        quickDeduction: 2520,
      },
      {
        country: "CN",
        taxYear: 2025,
        position: 3,
        threshold: 300000,
        taxRate: 0.2,
        quickDeduction: 16920,
      },
      {
        country: "CN",
        taxYear: 2025,
        position: 4,
        threshold: 420000,
        taxRate: 0.25,
        quickDeduction: 31920,
      },
      {
        country: "CN",
        taxYear: 2025,
        position: 5,
        threshold: 660000,
        taxRate: 0.3,
        quickDeduction: 52920,
      },
      {
        country: "CN",
        taxYear: 2025,
        position: 6,
        threshold: 960000,
        taxRate: 0.35,
        quickDeduction: 85920,
      },
      {
        country: "CN",
        taxYear: 2025,
        position: 7,
        threshold: 1000000000,
        taxRate: 0.45,
        quickDeduction: 181920,
      },
    ],
  },
];

export default function TaxRulesPage() {
  const [configForm, setConfigForm] = useState({
    country: "CN",
    taxYear: "2025",
    standardDeduction: "5000",
    specialAdditionalDeduction: "0",
  });
  const [configLoading, setConfigLoading] = useState(false);

  const { data, isLoading } = useTaxBrackets(
    configForm.country,
    Number(configForm.taxYear),
  );

  const handleConfigSubmit = async () => {
    setConfigLoading(true);
    try {
      await upsertTaxConfig({
        country: configForm.country,
        taxYear: Number(configForm.taxYear),
        standardDeduction: Number(configForm.standardDeduction),
        specialAdditionalDeduction: Number(
          configForm.specialAdditionalDeduction,
        ),
      });
    } finally {
      setConfigLoading(false);
    }
  };

  const onChange = (field: string, value: string) => {
    setConfigForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <main className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalculatorIcon className="w-6 h-6 text-green-600" />
            税制与税率管理
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            管理个人所得税税率表和扣除标准
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <SettingsIcon className="w-4 h-4" />
          税务配置
        </Badge>
      </div>

      {/* 税制配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            税制基础配置
          </CardTitle>
          <CardDescription>设置税年、基本扣除额和专项附加扣除</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">国家</label>
              <Input
                placeholder="CN"
                value={configForm.country}
                onChange={(e) => onChange("country", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">税年</label>
              <Input
                type="number"
                placeholder="2025"
                value={configForm.taxYear}
                onChange={(e) => onChange("taxYear", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                基本扣除额(月)
              </label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="5000"
                  value={configForm.standardDeduction}
                  onChange={(e) =>
                    onChange("standardDeduction", e.target.value)
                  }
                  className="pr-10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  元
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                专项附加扣除(月)
              </label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0"
                  value={configForm.specialAdditionalDeduction}
                  onChange={(e) =>
                    onChange("specialAdditionalDeduction", e.target.value)
                  }
                  className="pr-10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  元
                </div>
              </div>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                onClick={handleConfigSubmit}
                disabled={configLoading}
                className="w-full"
              >
                {configLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  "保存配置"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 当前税率表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">当前税率表</CardTitle>
          <CardDescription>
            {configForm.country} - {configForm.taxYear} 税年的个人所得税税率表
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mr-3"></div>
              加载中...
            </div>
          ) : (data as any)?.items?.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">级数</TableHead>
                    <TableHead className="text-right">
                      年累计应纳税所得额
                    </TableHead>
                    <TableHead className="text-right">税率</TableHead>
                    <TableHead className="text-right">速算扣除数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data as any).items.map((bracket: any, index: number) => (
                    <TableRow
                      key={index}
                      className={index % 2 === 0 ? "bg-gray-50/50" : ""}
                    >
                      <TableCell className="text-center font-medium">
                        {bracket.position}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {index === 0
                          ? `≤ ${formatMoney(Number(bracket.threshold), "CNY")}`
                          : index === (data as any).items.length - 1
                            ? `> ${formatMoney(Number((data as any).items[index - 1].threshold), "CNY")}`
                            : `${formatMoney(Number((data as any).items[index - 1].threshold), "CNY")} - ${formatMoney(Number(bracket.threshold), "CNY")}`}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="font-mono">
                          {(Number(bracket.taxRate) * 100).toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(Number(bracket.quickDeduction), "CNY")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center p-8 text-gray-500">
              <InfoIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">暂无税率表</p>
              <p className="text-sm">请使用下方的批量配置功能添加税率表</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 批量配置税率表 */}
      <RulesUpsertForm
        title="批量配置税率表"
        description="配置个人所得税的累进税率表，支持多档税率"
        placeholder={`示例格式：
[
  {
    "country": "CN",
    "taxYear": 2025,
    "position": 1,
    "threshold": 36000,
    "taxRate": 0.03,
    "quickDeduction": 0
  }
]`}
        examples={TAX_BRACKETS_EXAMPLE}
        onSubmit={(items) => upsertTaxBrackets(items as any)}
      />

      {/* 字段说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <InfoIcon className="w-4 h-4" />
            字段说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">税制配置字段</h4>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono">country</TableCell>
                    <TableCell>国家代码</TableCell>
                    <TableCell className="font-mono">"CN"</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono">taxYear</TableCell>
                    <TableCell>税年</TableCell>
                    <TableCell className="font-mono">2025</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono">
                      standardDeduction
                    </TableCell>
                    <TableCell>月度基本扣除额</TableCell>
                    <TableCell className="font-mono">5000</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono">
                      specialAdditionalDeduction
                    </TableCell>
                    <TableCell>月度专项附加扣除</TableCell>
                    <TableCell className="font-mono">0</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div>
              <h4 className="font-medium mb-3">税率表字段</h4>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono">position</TableCell>
                    <TableCell>税率档位</TableCell>
                    <TableCell className="font-mono">1, 2, 3...</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono">threshold</TableCell>
                    <TableCell>年度阈值上限</TableCell>
                    <TableCell className="font-mono">36000</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono">taxRate</TableCell>
                    <TableCell>税率（小数形式）</TableCell>
                    <TableCell className="font-mono">0.03 (3%)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono">quickDeduction</TableCell>
                    <TableCell>速算扣除数（元）</TableCell>
                    <TableCell className="font-mono">0</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
