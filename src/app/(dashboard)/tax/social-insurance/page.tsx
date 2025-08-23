"use client";

import { ArrowLeft, Banknote, Building2, Calendar, Edit, Info, Plus, Save, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SocialInsuranceConfig {
  id: string;
  city: string;
  type: "social" | "housing";
  category: string;
  employerRate: number;
  employeeRate: number;
  minBase: number;
  maxBase: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export default function SocialInsurancePage() {
  const [configs, setConfigs] = useState<SocialInsuranceConfig[]>([]);
  const [selectedCity, setSelectedCity] = useState("Hangzhou");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const cities = [
    "Hangzhou",
    "Beijing",
    "Shanghai",
    "Shenzhen",
    "Guangzhou",
    "Nanjing",
    "Chengdu",
    "Wuhan",
  ];

  // 模拟杭州2025年数据
  const hangzhouConfig: Omit<SocialInsuranceConfig, "id">[] = [
    // 社保
    {
      city: "Hangzhou",
      type: "social",
      category: "养老保险",
      employerRate: 14,
      employeeRate: 8,
      minBase: 4812,
      maxBase: 24930,
      effectiveFrom: "2025-01-01",
    },
    {
      city: "Hangzhou",
      type: "social",
      category: "医疗保险",
      employerRate: 9.5,
      employeeRate: 2,
      minBase: 4812,
      maxBase: 24930,
      effectiveFrom: "2025-01-01",
    },
    {
      city: "Hangzhou",
      type: "social",
      category: "失业保险",
      employerRate: 0.5,
      employeeRate: 0.5,
      minBase: 4812,
      maxBase: 24930,
      effectiveFrom: "2025-01-01",
    },
    {
      city: "Hangzhou",
      type: "social",
      category: "工伤保险",
      employerRate: 0.2,
      employeeRate: 0,
      minBase: 4812,
      maxBase: 24930,
      effectiveFrom: "2025-01-01",
    },
    {
      city: "Hangzhou",
      type: "social",
      category: "生育保险",
      employerRate: 0.5,
      employeeRate: 0,
      minBase: 4812,
      maxBase: 24930,
      effectiveFrom: "2025-01-01",
    },
    // 公积金
    {
      city: "Hangzhou",
      type: "housing",
      category: "住房公积金",
      employerRate: 12,
      employeeRate: 12,
      minBase: 2490,
      maxBase: 40694,
      effectiveFrom: "2025-07-01",
    },
  ];

  useEffect(() => {
    // 模拟加载数据
    const mockData: SocialInsuranceConfig[] = hangzhouConfig.map((config, index) => ({
      ...config,
      id: `config_${index + 1}`,
    }));

    setConfigs(mockData);
    setLoading(false);
  }, []);

  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString()}`;
  };

  const formatPercentage = (rate: number) => {
    return `${rate}%`;
  };

  const getCityConfigs = (type: "social" | "housing") => {
    return configs.filter((config) => config.city === selectedCity && config.type === type);
  };

  const calculateTotalRate = (type: "social" | "housing", rateType: "employer" | "employee") => {
    const cityConfigs = getCityConfigs(type);
    return cityConfigs.reduce((total, config) => {
      return total + (rateType === "employer" ? config.employerRate : config.employeeRate);
    }, 0);
  };

  const startEdit = (id: string) => {
    setEditingId(id);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = (id: string) => {
    console.log("Saving config:", id);
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
            <h1 className="text-3xl font-bold">社保公积金规则</h1>
            <p className="text-gray-600 mt-2">各城市社保和公积金缴费基数、比例管理</p>
          </div>
        </div>

        <div className="flex space-x-3">
          <Select value={selectedCity} onValueChange={setSelectedCity}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            添加配置
          </Button>
        </div>
      </div>

      {/* 城市概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <Building2 className="w-5 h-5 mr-2 text-blue-600" />
              当前城市
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{selectedCity}</div>
            <div className="text-sm text-gray-600 mt-1">配置生效时间：2025年1月1日起</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <Banknote className="w-5 h-5 mr-2 text-green-600" />
              社保总费率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between">
              <div>
                <div className="text-lg font-bold text-green-600">
                  {formatPercentage(calculateTotalRate("social", "employer"))}
                </div>
                <div className="text-xs text-gray-600">单位承担</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-orange-600">
                  {formatPercentage(calculateTotalRate("social", "employee"))}
                </div>
                <div className="text-xs text-gray-600">个人承担</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <Banknote className="w-5 h-5 mr-2 text-purple-600" />
              公积金费率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between">
              <div>
                <div className="text-lg font-bold text-purple-600">
                  {formatPercentage(calculateTotalRate("housing", "employer"))}
                </div>
                <div className="text-xs text-gray-600">单位承担</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-purple-600">
                  {formatPercentage(calculateTotalRate("housing", "employee"))}
                </div>
                <div className="text-xs text-gray-600">个人承担</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 配置管理标签页 */}
      <Tabs defaultValue="social" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="social">社会保险</TabsTrigger>
          <TabsTrigger value="housing">住房公积金</TabsTrigger>
        </TabsList>

        {/* 社会保险配置 */}
        <TabsContent value="social">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>社会保险配置 - {selectedCity}</span>
                <Button size="sm">
                  <Calendar className="w-4 h-4 mr-2" />
                  查看历史版本
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>险种</TableHead>
                      <TableHead>单位比例</TableHead>
                      <TableHead>个人比例</TableHead>
                      <TableHead>缴费基数下限</TableHead>
                      <TableHead>缴费基数上限</TableHead>
                      <TableHead>生效时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getCityConfigs("social").map((config) => (
                      <TableRow key={config.id}>
                        <TableCell className="font-medium">{config.category}</TableCell>
                        <TableCell>
                          {editingId === config.id ? (
                            <Input
                              type="number"
                              defaultValue={config.employerRate}
                              className="w-20"
                              step="0.1"
                              min="0"
                            />
                          ) : (
                            <span className="text-green-600 font-semibold">
                              {formatPercentage(config.employerRate)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === config.id ? (
                            <Input
                              type="number"
                              defaultValue={config.employeeRate}
                              className="w-20"
                              step="0.1"
                              min="0"
                            />
                          ) : (
                            <span className="text-orange-600 font-semibold">
                              {formatPercentage(config.employeeRate)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === config.id ? (
                            <Input type="number" defaultValue={config.minBase} className="w-28" />
                          ) : (
                            formatCurrency(config.minBase)
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === config.id ? (
                            <Input type="number" defaultValue={config.maxBase} className="w-28" />
                          ) : (
                            formatCurrency(config.maxBase)
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(config.effectiveFrom).toLocaleDateString("zh-CN")}
                        </TableCell>
                        <TableCell>
                          {editingId === config.id ? (
                            <div className="flex space-x-2">
                              <Button size="sm" onClick={() => saveEdit(config.id)}>
                                <Save className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEdit}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEdit(config.id)}
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
        </TabsContent>

        {/* 住房公积金配置 */}
        <TabsContent value="housing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>住房公积金配置 - {selectedCity}</span>
                <Button size="sm">
                  <Calendar className="w-4 h-4 mr-2" />
                  查看历史版本
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>类型</TableHead>
                      <TableHead>单位比例</TableHead>
                      <TableHead>个人比例</TableHead>
                      <TableHead>缴存基数下限</TableHead>
                      <TableHead>缴存基数上限</TableHead>
                      <TableHead>生效时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getCityConfigs("housing").map((config) => (
                      <TableRow key={config.id}>
                        <TableCell className="font-medium">{config.category}</TableCell>
                        <TableCell>
                          <span className="text-purple-600 font-semibold">
                            {formatPercentage(config.employerRate)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-purple-600 font-semibold">
                            {formatPercentage(config.employeeRate)}
                          </span>
                        </TableCell>
                        <TableCell>{formatCurrency(config.minBase)}</TableCell>
                        <TableCell>{formatCurrency(config.maxBase)}</TableCell>
                        <TableCell>
                          {new Date(config.effectiveFrom).toLocaleDateString("zh-CN")}
                          {config.effectiveTo && (
                            <div className="text-xs text-gray-500">
                              至 {new Date(config.effectiveTo).toLocaleDateString("zh-CN")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => startEdit(config.id)}>
                            <Edit className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 计算示例 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="w-5 h-5 mr-2 text-blue-600" />
            缴费计算示例 - {selectedCity}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-lg font-semibold text-blue-800">月薪 ¥8,000</div>
              <div className="text-sm text-blue-600 mt-2 space-y-1">
                <div>社保个人：¥852 (10.65%)</div>
                <div>公积金个人：¥960 (12%)</div>
                <div>
                  <strong>个人总扣除：¥1,812</strong>
                </div>
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-lg font-semibold text-green-800">月薪 ¥15,000</div>
              <div className="text-sm text-green-600 mt-2 space-y-1">
                <div>社保个人：¥1,598 (10.65%)</div>
                <div>公积金个人：¥1,800 (12%)</div>
                <div>
                  <strong>个人总扣除：¥3,398</strong>
                </div>
              </div>
            </div>

            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="text-lg font-semibold text-orange-800">月薪 ¥30,000</div>
              <div className="text-sm text-orange-600 mt-2 space-y-1">
                <div>社保个人：¥2,655 (按上限)</div>
                <div>公积金个人：¥3,600 (12%)</div>
                <div>
                  <strong>个人总扣除：¥6,255</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            * 示例基于当前{selectedCity}的社保公积金政策计算
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
