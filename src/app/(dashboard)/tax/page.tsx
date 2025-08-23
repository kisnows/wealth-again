"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calculator, 
  Settings, 
  TrendingUp, 
  Building2,
  FileText,
  ArrowRight
} from "lucide-react";

export default function TaxManagementPage() {
  const taxModules = [
    {
      title: "基础配置",
      description: "管理税务基础参数和政策配置",
      href: "/tax/config",
      icon: Settings,
      color: "text-blue-600",
      bgColor: "bg-blue-50 hover:bg-blue-100"
    },
    {
      title: "税率管理",
      description: "个人所得税七级累进税率表管理",
      href: "/tax/rates",
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50 hover:bg-green-100"
    },
    {
      title: "社保公积金",
      description: "各城市社保公积金缴费规则管理",
      href: "/tax/social-insurance",
      icon: Building2,
      color: "text-purple-600",
      bgColor: "bg-purple-50 hover:bg-purple-100"
    },
    {
      title: "税务计算器",
      description: "实时计算个人所得税和社保费用",
      href: "/income",
      icon: Calculator,
      color: "text-orange-600",
      bgColor: "bg-orange-50 hover:bg-orange-100"
    }
  ];

  const quickStats = [
    {
      label: "本年累计应税收入",
      value: "¥0",
      subtitle: "基于历史收入记录"
    },
    {
      label: "本年累计已缴税额",
      value: "¥0",
      subtitle: "包含预扣预缴税额"
    },
    {
      label: "当前适用税率",
      value: "3%",
      subtitle: "基于累计应税所得额"
    },
    {
      label: "下月预估税负",
      value: "¥0",
      subtitle: "基于收入预测计算"
    }
  ];

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* 页面头部 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">税务管理</h1>
          <p className="text-gray-600 mt-2">
            管理个人所得税、社保公积金等税务相关配置和计算
          </p>
        </div>
        <div className="flex space-x-3">
          <Link href="/income">
            <Button variant="outline">
              <Calculator className="w-4 h-4 mr-2" />
              税务计算
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">返回仪表板</Button>
          </Link>
        </div>
      </div>

      {/* 税务概览统计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 功能模块导航 */}
      <div>
        <h2 className="text-xl font-semibold mb-4">税务管理功能</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {taxModules.map((module) => {
            const IconComponent = module.icon;
            return (
              <Link key={module.href} href={module.href}>
                <Card className={`cursor-pointer transition-colors ${module.bgColor}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg bg-white`}>
                        <IconComponent className={`w-6 h-6 ${module.color}`} />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{module.title}</CardTitle>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">{module.description}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 最近政策更新 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>政策更新提醒</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">2025年个人所得税政策更新</p>
                <p className="text-xs text-gray-600 mt-1">
                  税率表和专项附加扣除标准已更新，请及时调整配置参数
                </p>
                <p className="text-xs text-blue-600 mt-2">生效日期: 2025-01-01</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">杭州社保缴费基数调整</p>
                <p className="text-xs text-gray-600 mt-1">
                  2025年杭州市社保缴费基数上下限已调整
                </p>
                <p className="text-xs text-yellow-600 mt-2">生效日期: 2025-07-01</p>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <Link href="/tax/config">
              <Button variant="outline" size="sm">
                查看所有政策配置
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 使用帮助 */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <div>
            <strong>基础配置：</strong>
            管理税务计算所需的基础参数，包括专项附加扣除、起征点等全国统一政策参数。
          </div>
          <div>
            <strong>税率管理：</strong>
            查看和管理个人所得税七级累进税率表，支持历史版本查询和未来政策录入。
          </div>
          <div>
            <strong>社保公积金：</strong>
            按城市管理社保和公积金的缴费基数、缴费比例等参数，支持时间版本管理。
          </div>
          <div>
            <strong>税务计算：</strong>
            在收入管理页面可以实时计算个人所得税、社保、公积金等费用。
          </div>
        </CardContent>
      </Card>
    </div>
  );
}