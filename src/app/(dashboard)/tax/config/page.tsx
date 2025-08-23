"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const defaultParams = {
  city: "Hangzhou",
  monthlyBasicDeduction: 5000,
  taxBrackets: [
    { minIncome: 0, maxIncome: 36000, taxRate: 0.03, quickDeduction: 0 },
    { minIncome: 36000, maxIncome: 144000, taxRate: 0.1, quickDeduction: 2520 },
    { minIncome: 144000, maxIncome: 300000, taxRate: 0.2, quickDeduction: 16920 },
    { minIncome: 300000, maxIncome: 420000, taxRate: 0.25, quickDeduction: 31920 },
    { minIncome: 420000, maxIncome: 660000, taxRate: 0.3, quickDeduction: 52920 },
    { minIncome: 660000, maxIncome: 960000, taxRate: 0.35, quickDeduction: 85920 },
    { minIncome: 960000, maxIncome: null, taxRate: 0.45, quickDeduction: 181920 },
  ],
  socialInsurance: {
    socialMinBase: 5000,
    socialMaxBase: 28017,
    pensionRate: 0.08,
    medicalRate: 0.02,
    unemploymentRate: 0.005,
    housingFundMinBase: 5000,
    housingFundMaxBase: 28017,
    housingFundRate: 0.12,
  },
};

// 转换旧格式到新格式
function convertLegacyToNewFormat(legacyParams: any) {
  return {
    city: legacyParams.city,
    monthlyBasicDeduction: legacyParams.monthlyBasicDeduction || 5000,
    taxBrackets:
      legacyParams.brackets?.map((bracket: any, index: number, array: any[]) => ({
        minIncome: bracket.threshold,
        maxIncome: index < array.length - 1 ? array[index + 1].threshold : null,
        taxRate: bracket.rate,
        quickDeduction: bracket.quickDeduction,
      })) || [],
    socialInsurance: {
      socialMinBase: legacyParams.sihfBase?.min || 5000,
      socialMaxBase: legacyParams.sihfBase?.max || 28017,
      pensionRate: legacyParams.sihfRates?.pension || 0.08,
      medicalRate: legacyParams.sihfRates?.medical || 0.02,
      unemploymentRate: legacyParams.sihfRates?.unemployment || 0.005,
      housingFundMinBase: legacyParams.housingFund?.baseMin || legacyParams.sihfBase?.min || 5000,
      housingFundMaxBase: legacyParams.housingFund?.baseMax || legacyParams.sihfBase?.max || 28017,
      housingFundRate: legacyParams.housingFund?.rate || 0.12,
    },
  };
}

export default function TaxConfigPage() {
  const [json, setJson] = useState(JSON.stringify(defaultParams, null, 2));
  const [parsedParams, setParsedParams] = useState(defaultParams);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [effectiveFrom, setEffectiveFrom] = useState<string>(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    // 尝试从服务器加载现有配置
    loadConfig();
  }, []);

  useEffect(() => {
    // 更新 JSON 字符串以便在需要时查看
    setJson(JSON.stringify(parsedParams, null, 2));
  }, [parsedParams]);

  async function loadConfig() {
    try {
      // 加载当前配置
      const res = await fetch(
        `/api/config/tax-params?city=Hangzhou&year=2025&page=${page}&pageSize=50`,
      );
      if (res.ok) {
        const data = await res.json();
        // 处理新格式或旧格式的数据
        if (data && data.config) {
          // 新格式数据
          setJson(JSON.stringify(data.config, null, 2));
        } else if (data && data.params) {
          // 旧格式数据，需要转换为新格式
          const converted = convertLegacyToNewFormat(data.params);
          setJson(JSON.stringify(converted, null, 2));
        }
      }

      // 加载历史记录
      const historyRes = await fetch(
        `/api/config/tax-params/history?city=Hangzhou&page=1&pageSize=50`,
      );
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setRecords(historyData.records || []);
      }
    } catch (err) {
      console.log("No existing config found, using default", err);
    }
  }

  async function save() {
    setLoading(true);
    setError("");
    setMsg("");

    try {
      const bodyObj = parsedParams;

      const res = await fetch("/api/config/tax-params", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...bodyObj, effectiveFrom }),
      });

      const data = await res.json();

      if (res.ok) {
        setMsg("税务信息保存成功！");
        // 重新加载历史记录
        loadConfig();
      } else {
        setError(data.error || "保存失败");
      }
    } catch (err: any) {
      setError(err.message || "保存失败");
    } finally {
      setLoading(false);
    }
  }

  async function deleteHistoryRecord(id: string) {
    if (!confirm("确定要删除这条历史记录吗？此操作不可撤销。")) {
      return;
    }

    setLoading(true);
    setError("");
    setMsg("");

    try {
      const res = await fetch(`/api/config/tax-params/history/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMsg("历史记录删除成功！");
        // 重新加载历史记录
        loadConfig();
      } else {
        setError(data.error || "删除失败");
      }
    } catch (err: any) {
      setError(err.message || "删除失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>税务信息管理</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 城市和基本扣除额设置 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">城市</Label>
                <Input
                  id="city"
                  value={parsedParams.city}
                  onChange={(e) => setParsedParams({ ...parsedParams, city: e.target.value })}
                  placeholder="请输入城市名称"
                />
              </div>
              <div>
                <Label htmlFor="monthlyBasicDeduction">月基本扣除额 (元)</Label>
                <Input
                  id="monthlyBasicDeduction"
                  type="number"
                  value={parsedParams.monthlyBasicDeduction}
                  onChange={(e) =>
                    setParsedParams({
                      ...parsedParams,
                      monthlyBasicDeduction: Number(e.target.value),
                    })
                  }
                  min="0"
                />
              </div>
            </div>

            {/* 社保公积金配置 */}
            <Card>
              <CardHeader>
                <CardTitle>社保公积金配置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="socialMinBase">社保缴费基数下限 (元)</Label>
                    <Input
                      id="socialMinBase"
                      type="number"
                      value={parsedParams.socialInsurance.socialMinBase}
                      onChange={(e) =>
                        setParsedParams({
                          ...parsedParams,
                          socialInsurance: {
                            ...parsedParams.socialInsurance,
                            socialMinBase: Number(e.target.value),
                          },
                        })
                      }
                      min="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="socialMaxBase">社保缴费基数上限 (元)</Label>
                    <Input
                      id="socialMaxBase"
                      type="number"
                      value={parsedParams.socialInsurance.socialMaxBase}
                      onChange={(e) =>
                        setParsedParams({
                          ...parsedParams,
                          socialInsurance: {
                            ...parsedParams.socialInsurance,
                            socialMaxBase: Number(e.target.value),
                          },
                        })
                      }
                      min="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="pensionRate">养老保险缴费比例 (%)</Label>
                    <Input
                      id="pensionRate"
                      type="number"
                      step="0.1"
                      value={parsedParams.socialInsurance.pensionRate * 100}
                      onChange={(e) =>
                        setParsedParams({
                          ...parsedParams,
                          socialInsurance: {
                            ...parsedParams.socialInsurance,
                            pensionRate: Number(e.target.value) / 100,
                          },
                        })
                      }
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="medicalRate">医疗保险缴费比例 (%)</Label>
                    <Input
                      id="medicalRate"
                      type="number"
                      step="0.1"
                      value={parsedParams.socialInsurance.medicalRate * 100}
                      onChange={(e) =>
                        setParsedParams({
                          ...parsedParams,
                          socialInsurance: {
                            ...parsedParams.socialInsurance,
                            medicalRate: Number(e.target.value) / 100,
                          },
                        })
                      }
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="unemploymentRate">失业保险缴费比例 (%)</Label>
                    <Input
                      id="unemploymentRate"
                      type="number"
                      step="0.1"
                      value={parsedParams.socialInsurance.unemploymentRate * 100}
                      onChange={(e) =>
                        setParsedParams({
                          ...parsedParams,
                          socialInsurance: {
                            ...parsedParams.socialInsurance,
                            unemploymentRate: Number(e.target.value) / 100,
                          },
                        })
                      }
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="housingFundMinBase">公积金缴费基数下限 (元)</Label>
                    <Input
                      id="housingFundMinBase"
                      type="number"
                      value={parsedParams.socialInsurance.housingFundMinBase}
                      onChange={(e) =>
                        setParsedParams({
                          ...parsedParams,
                          socialInsurance: {
                            ...parsedParams.socialInsurance,
                            housingFundMinBase: Number(e.target.value),
                          },
                        })
                      }
                      min="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="housingFundMaxBase">公积金缴费基数上限 (元)</Label>
                    <Input
                      id="housingFundMaxBase"
                      type="number"
                      value={parsedParams.socialInsurance.housingFundMaxBase}
                      onChange={(e) =>
                        setParsedParams({
                          ...parsedParams,
                          socialInsurance: {
                            ...parsedParams.socialInsurance,
                            housingFundMaxBase: Number(e.target.value),
                          },
                        })
                      }
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="housingFundRate">公积金缴费比例 (%)</Label>
                  <Input
                    id="housingFundRate"
                    type="number"
                    step="0.1"
                    value={parsedParams.socialInsurance.housingFundRate * 100}
                    onChange={(e) =>
                      setParsedParams({
                        ...parsedParams,
                        socialInsurance: {
                          ...parsedParams.socialInsurance,
                          housingFundRate: Number(e.target.value) / 100,
                        },
                      })
                    }
                    min="0"
                    max="100"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 个人所得税率区间配置 */}
            <Card>
              <CardHeader>
                <CardTitle>个人所得税率区间</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>应纳税所得额区间</TableHead>
                      <TableHead>税率 (%)</TableHead>
                      <TableHead>速算扣除数 (元)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(parsedParams.taxBrackets || []).map((bracket, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          ¥{(bracket.minIncome || 0).toLocaleString()} -{" "}
                          {bracket.maxIncome ? `¥${bracket.maxIncome.toLocaleString()}` : "以上"}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.1"
                            value={bracket.taxRate * 100}
                            onChange={(e) => {
                              const newBrackets = [...parsedParams.taxBrackets];
                              newBrackets[index] = {
                                ...newBrackets[index],
                                taxRate: Number(e.target.value) / 100,
                              };
                              setParsedParams({
                                ...parsedParams,
                                taxBrackets: newBrackets,
                              });
                            }}
                            min="0"
                            max="100"
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={bracket.quickDeduction}
                            onChange={(e) => {
                              const newBrackets = [...parsedParams.taxBrackets];
                              newBrackets[index] = {
                                ...newBrackets[index],
                                quickDeduction: Number(e.target.value),
                              };
                              setParsedParams({
                                ...parsedParams,
                                taxBrackets: newBrackets,
                              });
                            }}
                            min="0"
                            className="w-24"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* 专项附加扣除说明 */}
            <Card>
              <CardHeader>
                <CardTitle>专项附加扣除说明</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-600">
                    专项附加扣除包括：子女教育（1000元/月）、继续教育（400元/月）、住房贷款利息（1000元/月）、
                    住房租金（1500-800元/月）、赡养老人（2000元/月）、大病医疗（最高80000元/年）等。
                    具体扣除标准请参考最新税法规定。
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 生效日期和保存按钮 */}
            <div className="flex gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm">生效日期</Label>
                <Input
                  type="date"
                  className="border rounded px-2 py-1"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                />
              </div>
              <Button onClick={save} disabled={loading}>
                {loading ? "保存中..." : "保存税务信息"}
              </Button>
              <Button variant="outline" onClick={() => setParsedParams(defaultParams)}>
                重置为默认值
              </Button>
            </div>

            {error && <div className="p-2 bg-red-100 text-red-800 rounded-md">错误: {error}</div>}
            {msg && <div className="p-2 bg-green-100 text-green-800 rounded-md">{msg}</div>}
          </div>
        </CardContent>
      </Card>

      {/* 可视化展示区域 */}
      <Card>
        <CardHeader>
          <CardTitle>税务信息预览</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 基本信息 */}
          <div>
            <h3 className="text-lg font-medium mb-2">基本信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 border rounded-md">
                <p className="text-sm text-gray-500">城市</p>
                <p className="font-medium">{parsedParams.city}</p>
              </div>
              <div className="p-3 border rounded-md">
                <p className="text-sm text-gray-500">月基本扣除额</p>
                <p className="font-medium">
                  ¥{(parsedParams.monthlyBasicDeduction || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* 税率区间表 */}
          <div>
            <h3 className="text-lg font-medium mb-2">个人所得税率区间</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>应纳税所得额区间</TableHead>
                  <TableHead>税率</TableHead>
                  <TableHead>速算扣除数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(parsedParams.taxBrackets || []).map((bracket, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      ¥{(bracket.minIncome || 0).toLocaleString()} -{" "}
                      {bracket.maxIncome ? `¥${bracket.maxIncome.toLocaleString()}` : "以上"}
                    </TableCell>
                    <TableCell>{((bracket.taxRate || 0) * 100).toFixed(1)}%</TableCell>
                    <TableCell>¥{(bracket.quickDeduction || 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* 社保公积金比例 */}
          <div>
            <h3 className="text-lg font-medium mb-2">社保公积金比例</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3 border rounded-md">
                <p className="text-sm text-gray-500">养老保险</p>
                <p className="font-medium">
                  {((parsedParams.socialInsurance?.pensionRate || 0) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="p-3 border rounded-md">
                <p className="text-sm text-gray-500">医疗保险</p>
                <p className="font-medium">
                  {((parsedParams.socialInsurance?.medicalRate || 0) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="p-3 border rounded-md">
                <p className="text-sm text-gray-500">失业保险</p>
                <p className="font-medium">
                  {((parsedParams.socialInsurance?.unemploymentRate || 0) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="p-3 border rounded-md">
                <p className="text-sm text-gray-500">住房公积金</p>
                <p className="font-medium">
                  {((parsedParams.socialInsurance?.housingFundRate || 0) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 border rounded-md">
                <p className="text-sm text-gray-500">社保缴费基数范围</p>
                <p className="font-medium">
                  ¥{(parsedParams.socialInsurance?.socialMinBase || 0).toLocaleString()} - ¥
                  {(parsedParams.socialInsurance?.socialMaxBase || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-3 border rounded-md">
                <p className="text-sm text-gray-500">公积金缴费基数范围</p>
                <p className="font-medium">
                  ¥{(parsedParams.socialInsurance?.housingFundMinBase || 0).toLocaleString()} - ¥
                  {(parsedParams.socialInsurance?.housingFundMaxBase || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* 专项附加扣除说明 */}
          <div>
            <h3 className="text-lg font-medium mb-2">专项附加扣除说明</h3>
            <div className="p-4 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">
                专项附加扣除包括：子女教育（1000元/月）、继续教育（400元/月）、住房贷款利息（1000元/月）、
                住房租金（1500-800元/月）、赡养老人（2000元/月）、大病医疗（最高80000元/年）等。
                具体扣除标准请参考最新税法规定。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>税务信息变更历史</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">生效日期</th>
                  <th className="text-left py-2">社保基数范围</th>
                  <th className="text-left py-2">公积金基数范围</th>
                  <th className="text-left py-2">社保比例</th>
                  <th className="text-left py-2">公积金比例</th>
                  <th className="text-left py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r: any) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-2">{new Date(r.effectiveFrom).toLocaleDateString()}</td>
                    <td className="py-2">
                      ¥{r.socialMinBase?.toLocaleString()} - ¥{r.socialMaxBase?.toLocaleString()}
                    </td>
                    <td className="py-2">
                      ¥{r.housingFundMinBase?.toLocaleString()} - ¥
                      {r.housingFundMaxBase?.toLocaleString()}
                    </td>
                    <td className="py-2">
                      养老{((r.pensionRate || 0) * 100).toFixed(1)}% + 医疗
                      {((r.medicalRate || 0) * 100).toFixed(1)}% + 失业
                      {((r.unemploymentRate || 0) * 100).toFixed(1)}%
                    </td>
                    <td className="py-2">{((r.housingFundRate || 0) * 100).toFixed(1)}%</td>
                    <td className="py-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteHistoryRecord(r.id)}
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
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPage(Math.max(1, page - 1));
                loadConfig();
              }}
              disabled={page === 1}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPage(page + 1);
                loadConfig();
              }}
            >
              下一页
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
