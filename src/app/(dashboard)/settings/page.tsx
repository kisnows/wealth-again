"use client";

import { ArrowRight, Bell, Coins, Database, MapPin, Settings, Shield, User } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const settingsModules = [
    {
      title: "用户档案",
      description: "个人信息、密码和账户安全设置",
      href: "/settings/profile",
      icon: User,
      color: "text-blue-600",
      bgColor: "bg-blue-50 hover:bg-blue-100",
      status: "完善度: 80%",
    },
    {
      title: "城市管理",
      description: "工作城市变更，影响社保公积金计算",
      href: "/settings/city",
      icon: MapPin,
      color: "text-green-600",
      bgColor: "bg-green-50 hover:bg-green-100",
      status: "当前: 杭州",
    },
    {
      title: "货币设置",
      description: "默认货币、汇率更新和显示偏好",
      href: "/settings/currency",
      icon: Coins,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50 hover:bg-yellow-100",
      status: "默认: CNY",
    },
  ];

  const systemSettings = [
    {
      title: "系统配置",
      description: "系统级参数和高级配置选项",
      icon: Settings,
      color: "text-gray-600",
      status: "需要管理员权限",
    },
    {
      title: "安全设置",
      description: "登录安全、数据加密和隐私保护",
      icon: Shield,
      color: "text-red-600",
      status: "安全级别: 高",
    },
    {
      title: "通知设置",
      description: "收入提醒、税务到期和系统通知",
      icon: Bell,
      color: "text-purple-600",
      status: "已开启",
    },
    {
      title: "数据管理",
      description: "数据备份、导出和清理功能",
      icon: Database,
      color: "text-indigo-600",
      status: "最近备份: 今天",
    },
  ];

  const quickActions = [
    { label: "修改密码", action: "profile" },
    { label: "更换工作城市", action: "city" },
    { label: "更新汇率", action: "currency" },
    { label: "导出数据", action: "export" },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">设置</h1>
          <p className="page-subtitle">管理个人信息、系统配置和应用偏好设置</p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" size="sm" className="back-button">
            <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
            返回仪表板
          </Button>
        </Link>
      </div>

      {/* 账户概览 */}
      <Card className="app-card">
        <CardHeader className="app-card-header">
          <CardTitle className="app-card-title">账户概览</CardTitle>
        </CardHeader>
        <CardContent className="app-card-content">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-primary">Demo User</div>
                <div className="text-sm text-secondary">demo@example.com</div>
              </div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">¥</div>
              <div className="text-sm text-secondary">默认货币</div>
              <div className="text-xs text-muted">人民币</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">杭州</div>
              <div className="text-sm text-secondary">工作城市</div>
              <div className="text-xs text-muted">影响社保计算</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">3</div>
              <div className="text-sm text-secondary">活跃月份</div>
              <div className="text-xs text-muted">使用天数: 90</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 主要设置模块 */}
      <div>
        <h2 className="section-title">主要设置</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {settingsModules.map((module) => {
            const IconComponent = module.icon;
            return (
              <Link key={module.href} href={module.href}>
                <Card className={`feature-card ${module.href.includes('profile') ? 'feature-card-blue' : 
                  module.href.includes('city') ? 'feature-card-green' : 'feature-card-orange'}`}>
                  <CardHeader className="app-card-header pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-white">
                          <IconComponent className={`w-6 h-6 ${module.color}`} />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{module.title}</CardTitle>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </CardHeader>
                  <CardContent className="app-card-content">
                    <p className="text-sm text-secondary mb-2">{module.description}</p>
                    <div className="text-xs text-muted bg-white px-2 py-1 rounded">
                      {module.status}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 快捷操作 */}
      <Card className="app-card">
        <CardHeader className="app-card-header">
          <CardTitle className="app-card-title">快捷操作</CardTitle>
        </CardHeader>
        <CardContent className="app-card-content">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <Button
                key={action.action}
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={() => {
                  if (action.action === "profile") window.location.href = "/settings/profile";
                  if (action.action === "city") window.location.href = "/settings/city";
                  if (action.action === "currency") window.location.href = "/settings/currency";
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 系统设置 */}
      <div>
        <h2 className="section-title">系统设置</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {systemSettings.map((setting, index) => {
            const IconComponent = setting.icon;
            return (
              <Card key={index} className="feature-card">
                <CardHeader className="app-card-header pb-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-gray-100">
                      <IconComponent className={`w-5 h-5 ${setting.color}`} />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{setting.title}</CardTitle>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </div>
                </CardHeader>
                <CardContent className="app-card-content">
                  <p className="text-sm text-secondary mb-2">{setting.description}</p>
                  <div className="text-xs text-muted">{setting.status}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 使用说明 */}
      <Card className="app-card">
        <CardHeader className="app-card-header">
          <CardTitle className="app-card-title">使用说明</CardTitle>
        </CardHeader>
        <CardContent className="app-card-content space-y-3 text-sm text-secondary">
          <div>
            <strong className="text-primary">用户档案：</strong>
            管理个人基本信息、登录密码和账户安全设置。建议定期更新密码保障账户安全。
          </div>
          <div>
            <strong className="text-primary">城市管理：</strong>
            工作城市变更会影响社保和公积金计算。如需更换工作城市，请提前设置生效日期。
          </div>
          <div>
            <strong className="text-primary">货币设置：</strong>
            设置默认显示货币和汇率更新频率。支持多币种投资记录和自动汇率换算。
          </div>
          <div>
            <strong className="text-primary">数据安全：</strong>
            系统自动备份重要数据，您也可以手动导出个人财务数据进行备份。
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
