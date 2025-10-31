"use client";

import {
  CalendarIcon,
  InfoIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import RulesUpsertForm from "@/components/modules/identity/RulesUpsertForm";
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
import { upsertSocialSecurity, useSocialSecurity } from "@/lib/api/rules";
import { formatMoney } from "@/lib/domain/money";

// 示例数据
const EXAMPLE_DATA = [
  {
    name: "杭州 2025年 社保规则",
    data: [
      {
        city: "Hangzhou",
        startDate: "2025-01-01",
        baseMin: 4927,
        baseMax: 37014,
        ratePension: 0.08,
        rateMedical: 0.02,
        rateUnemployment: 0.005,
        fixedMedicalPersonal: 3,
      },
    ],
  },
  {
    name: "北京 2025年 社保规则",
    data: [
      {
        city: "Beijing",
        startDate: "2025-01-01",
        baseMin: 5869,
        baseMax: 33891,
        ratePension: 0.08,
        rateMedical: 0.02,
        rateUnemployment: 0.005,
        fixedMedicalPersonal: 3,
      },
    ],
  },
  {
    name: "上海 2025年 社保规则",
    data: [
      {
        city: "Shanghai",
        startDate: "2025-01-01",
        baseMin: 7310,
        baseMax: 36549,
        ratePension: 0.08,
        rateMedical: 0.02,
        rateUnemployment: 0.005,
        fixedMedicalPersonal: 0,
      },
    ],
  },
];

export default function SocialSecurityRulesPage() {
  const [query, setQuery] = useState({ city: "Hangzhou", on: "2025-01-01" });
  const { data, isLoading } = useSocialSecurity(query.city, query.on);

  // 计算社保费用示例（基于20000工资）
  const exampleCalculation = useMemo(() => {
    if (!data) return null;

    const salary = 20000;
    const baseMin = Number(data.baseMin);
    const baseMax = Number(data.baseMax);
    const socialBase = Math.max(baseMin, Math.min(baseMax, salary));

    const pension = socialBase * Number(data.ratePension);
    const medical =
      socialBase * Number(data.rateMedical) +
      Number((data as any).fixedMedicalPersonal || 0);
    const unemployment = socialBase * Number(data.rateUnemployment);
    const total = pension + medical + unemployment;

    return {
      socialBase,
      pension,
      medical,
      unemployment,
      total,
      rate: (total / salary) * 100,
    };
  }, [data]);

  return (
    <main className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheckIcon className="w-6 h-6 text-blue-600" />
            社保规则管理
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            管理城市社保缴费基数和比例配置
          </p>
        </div>
        <Badge className="flex items-center gap-2" variant="outline">
          <CalendarIcon className="w-4 h-4" />
          规则配置
        </Badge>
      </div>

      {/* 查询和展示当前规则 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <SearchIcon className="w-4 h-4" />
              规则查询
            </CardTitle>
            <CardDescription>查询指定城市和日期的社保规则</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  城市
                </label>
                <Input
                  onChange={(e) => setQuery({ ...query, city: e.target.value })}
                  placeholder="输入城市名称"
                  value={query.city}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  查询日期
                </label>
                <Input
                  onChange={(e) => setQuery({ ...query, on: e.target.value })}
                  type="date"
                  value={query.on}
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={isLoading}
              onClick={() => {
                /* SWR 自动刷新 */
              }}
            >
              {isLoading ? "查询中..." : "查询规则"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">当前规则详情</CardTitle>
            <CardDescription>
              {query.city} - {query.on} 的社保规则
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-gray-500">查询中...</div>
            ) : data ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">缴费基数范围：</span>
                    <div className="font-mono">
                      {formatMoney(Number(data.baseMin), "CNY")} -{" "}
                      {formatMoney(Number(data.baseMax), "CNY")}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">养老保险：</span>
                    <div className="font-mono text-blue-600">
                      {(Number(data.ratePension) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">医疗保险：</span>
                    <div className="font-mono text-green-600">
                      {(Number(data.rateMedical) * 100).toFixed(1)}% +{" "}
                      {Number((data as any).fixedMedicalPersonal || 0)}元
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">失业保险：</span>
                    <div className="font-mono text-orange-600">
                      {(Number(data.rateUnemployment) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* 计算示例 */}
                {exampleCalculation && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">
                      工资20,000元的社保计算示例
                    </h4>
                    <div className="text-xs space-y-1 text-blue-700">
                      <div>
                        缴费基数：
                        {formatMoney(exampleCalculation.socialBase, "CNY")}
                      </div>
                      <div>
                        养老保险：
                        {formatMoney(exampleCalculation.pension, "CNY")}
                      </div>
                      <div>
                        医疗保险：
                        {formatMoney(exampleCalculation.medical, "CNY")}
                      </div>
                      <div>
                        失业保险：
                        {formatMoney(exampleCalculation.unemployment, "CNY")}
                      </div>
                      <div className="font-semibold border-t border-blue-300 pt-1">
                        个人合计：{formatMoney(exampleCalculation.total, "CNY")}
                        ({exampleCalculation.rate.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <InfoIcon className="w-4 h-4" />
                未找到对应规则，请检查城市名称和日期
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 批量配置 */}
      <RulesUpsertForm
        description="支持同时配置多个城市或多个时间段的社保规则"
        examples={EXAMPLE_DATA}
        onSubmit={(items) => upsertSocialSecurity(items as any)}
        placeholder={`示例格式：
[
  {
    "city": "Hangzhou",
    "startDate": "2025-01-01",
    "baseMin": 4927,
    "baseMax": 37014,
    "ratePension": 0.08,
    "rateMedical": 0.02,
    "rateUnemployment": 0.005,
    "fixedMedicalPersonal": 3
  }
]`}
        title="批量配置社保规则"
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>字段名</TableHead>
                <TableHead>说明</TableHead>
                <TableHead>示例值</TableHead>
                <TableHead>必填</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono">city</TableCell>
                <TableCell>城市名称（英文）</TableCell>
                <TableCell className="font-mono">"Hangzhou"</TableCell>
                <TableCell>
                  <Badge variant="destructive">是</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">startDate</TableCell>
                <TableCell>规则生效日期</TableCell>
                <TableCell className="font-mono">"2025-01-01"</TableCell>
                <TableCell>
                  <Badge variant="destructive">是</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">baseMin</TableCell>
                <TableCell>缴费基数下限（元）</TableCell>
                <TableCell className="font-mono">4927</TableCell>
                <TableCell>
                  <Badge variant="destructive">是</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">baseMax</TableCell>
                <TableCell>缴费基数上限（元）</TableCell>
                <TableCell className="font-mono">37014</TableCell>
                <TableCell>
                  <Badge variant="destructive">是</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">ratePension</TableCell>
                <TableCell>养老保险个人费率</TableCell>
                <TableCell className="font-mono">0.08 (8%)</TableCell>
                <TableCell>
                  <Badge variant="destructive">是</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">rateMedical</TableCell>
                <TableCell>医疗保险个人费率</TableCell>
                <TableCell className="font-mono">0.02 (2%)</TableCell>
                <TableCell>
                  <Badge variant="destructive">是</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">rateUnemployment</TableCell>
                <TableCell>失业保险个人费率</TableCell>
                <TableCell className="font-mono">0.005 (0.5%)</TableCell>
                <TableCell>
                  <Badge variant="destructive">是</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">
                  fixedMedicalPersonal
                </TableCell>
                <TableCell>医疗保险个人固定额（元）</TableCell>
                <TableCell className="font-mono">3</TableCell>
                <TableCell>
                  <Badge variant="outline">否</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
