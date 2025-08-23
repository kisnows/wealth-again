"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft,
  Coins,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  Globe,
  Save,
  Plus
} from "lucide-react";

interface Currency {
  code: string;
  name: string;
  symbol: string;
  rate: number;
  lastUpdated: string;
  change24h: number;
}

interface CurrencySettings {
  baseCurrency: string;
  displayCurrencies: string[];
  autoUpdateInterval: number;
  lastUpdateTime: string;
}

export default function CurrencySettingsPage() {
  const [settings, setSettings] = useState<CurrencySettings | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const supportedCurrencies = [
    { code: "CNY", name: "人民币", symbol: "¥" },
    { code: "USD", name: "美元", symbol: "$" },
    { code: "EUR", name: "欧元", symbol: "€" },
    { code: "JPY", name: "日元", symbol: "¥" },
    { code: "GBP", name: "英镑", symbol: "£" },
    { code: "HKD", name: "港币", symbol: "HK$" },
    { code: "KRW", name: "韩元", symbol: "₩" },
    { code: "SGD", name: "新加坡元", symbol: "S$" }
  ];

  useEffect(() => {
    // 模拟加载数据
    const mockSettings: CurrencySettings = {
      baseCurrency: "CNY",
      displayCurrencies: ["CNY", "USD", "EUR"],
      autoUpdateInterval: 60, // 分钟
      lastUpdateTime: new Date().toISOString()
    };

    const mockCurrencies: Currency[] = [
      { code: "CNY", name: "人民币", symbol: "¥", rate: 1, lastUpdated: new Date().toISOString(), change24h: 0 },
      { code: "USD", name: "美元", symbol: "$", rate: 0.138, lastUpdated: new Date().toISOString(), change24h: 0.5 },
      { code: "EUR", name: "欧元", symbol: "€", rate: 0.133, lastUpdated: new Date().toISOString(), change24h: -0.2 },
      { code: "JPY", name: "日元", symbol: "¥", rate: 21.2, lastUpdated: new Date().toISOString(), change24h: 1.1 },
      { code: "GBP", name: "英镑", symbol: "£", rate: 0.113, lastUpdated: new Date().toISOString(), change24h: -0.8 },
      { code: "HKD", name: "港币", symbol: "HK$", rate: 1.074, lastUpdated: new Date().toISOString(), change24h: 0.3 }
    ];

    setSettings(mockSettings);
    setCurrencies(mockCurrencies);
    setLoading(false);
  }, []);

  const updateExchangeRates = async () => {
    setUpdating(true);
    setError("");
    
    try {
      // 模拟API调用更新汇率
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const updatedCurrencies = currencies.map(currency => ({
        ...currency,
        rate: currency.code === "CNY" ? 1 : currency.rate * (0.98 + Math.random() * 0.04),
        change24h: (Math.random() - 0.5) * 4,
        lastUpdated: new Date().toISOString()
      }));
      
      setCurrencies(updatedCurrencies);
      
      if (settings) {
        setSettings({
          ...settings,
          lastUpdateTime: new Date().toISOString()
        });
      }
      
      setMessage("汇率更新成功！");
    } catch (err) {
      setError("汇率更新失败，请重试");
    } finally {
      setUpdating(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setError("");
    
    try {
      // 模拟保存设置
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMessage("设置保存成功！");
    } catch (err) {
      setError("设置保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const formatRate = (rate: number, currency: string) => {
    if (currency === "CNY") return "1.0000";
    return rate.toFixed(4);
  };

  const formatChange = (change: number) => {
    const isPositive = change >= 0;
    return (
      <span className={`flex items-center ${isPositive ? "text-green-600" : "text-red-600"}`}>
        {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
        {Math.abs(change).toFixed(2)}%
      </span>
    );
  };

  const getCurrencyInfo = (code: string) => {
    return supportedCurrencies.find(c => c.code === code) || { code, name: code, symbol: code };
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
          <Link href="/settings">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回设置
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">货币设置</h1>
            <p className="text-gray-600 mt-2">
              管理默认货币、汇率更新和多币种显示偏好
            </p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <Button 
            variant="outline" 
            onClick={updateExchangeRates} 
            disabled={updating}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${updating ? 'animate-spin' : ''}`} />
            {updating ? '更新中...' : '更新汇率'}
          </Button>
        </div>
      </div>

      {/* 消息提示 */}
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {message}
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* 货币概览卡片 */}
      {settings && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Coins className="w-5 h-5 mr-2 text-yellow-600" />
                基础货币
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {getCurrencyInfo(settings.baseCurrency).symbol} {settings.baseCurrency}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {getCurrencyInfo(settings.baseCurrency).name}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Globe className="w-5 h-5 mr-2 text-blue-600" />
                显示货币
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {settings.displayCurrencies.length}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                已配置货币种类
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Clock className="w-5 h-5 mr-2 text-green-600" />
                更新频率
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {settings.autoUpdateInterval}分钟
              </div>
              <div className="text-sm text-gray-600 mt-1">
                自动更新间隔
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <RefreshCw className="w-5 h-5 mr-2 text-purple-600" />
                最近更新
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-semibold text-purple-600">
                {new Date(settings.lastUpdateTime).toLocaleTimeString('zh-CN')}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {new Date(settings.lastUpdateTime).toLocaleDateString('zh-CN')}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 货币管理标签页 */}
      <Tabs defaultValue="rates" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rates">实时汇率</TabsTrigger>
          <TabsTrigger value="settings">货币配置</TabsTrigger>
          <TabsTrigger value="history">历史记录</TabsTrigger>
        </TabsList>

        {/* 实时汇率 */}
        <TabsContent value="rates">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>实时汇率表</span>
                <div className="text-sm text-gray-600">
                  基准货币: {settings?.baseCurrency} ({getCurrencyInfo(settings?.baseCurrency || "CNY").name})
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>货币</TableHead>
                      <TableHead>汇率</TableHead>
                      <TableHead>24小时变化</TableHead>
                      <TableHead>最后更新</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currencies.map((currency) => {
                      const currencyInfo = getCurrencyInfo(currency.code);
                      return (
                        <TableRow key={currency.code}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold">
                                {currencyInfo.symbol}
                              </div>
                              <div>
                                <div className="font-medium">{currency.code}</div>
                                <div className="text-xs text-gray-600">{currencyInfo.name}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">
                            {formatRate(currency.rate, currency.code)}
                          </TableCell>
                          <TableCell>
                            {formatChange(currency.change24h)}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {new Date(currency.lastUpdated).toLocaleTimeString('zh-CN')}
                          </TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm">
                              设置提醒
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 货币配置 */}
        <TabsContent value="settings">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>基本设置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {settings && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label>默认基础货币</Label>
                        <Select 
                          value={settings.baseCurrency} 
                          onValueChange={(value) => setSettings({...settings, baseCurrency: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {supportedCurrencies.map(currency => (
                              <SelectItem key={currency.code} value={currency.code}>
                                {currency.symbol} {currency.code} - {currency.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>自动更新间隔 (分钟)</Label>
                        <Select 
                          value={settings.autoUpdateInterval.toString()} 
                          onValueChange={(value) => setSettings({...settings, autoUpdateInterval: parseInt(value)})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">15分钟</SelectItem>
                            <SelectItem value="30">30分钟</SelectItem>
                            <SelectItem value="60">1小时</SelectItem>
                            <SelectItem value="240">4小时</SelectItem>
                            <SelectItem value="1440">1天</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      <Button onClick={saveSettings} disabled={saving}>
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? "保存中..." : "保存设置"}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>显示货币管理</CardTitle>
                <p className="text-sm text-gray-600">
                  选择在收入和投资管理中显示的货币种类
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {supportedCurrencies.map(currency => {
                    const isSelected = settings?.displayCurrencies.includes(currency.code);
                    return (
                      <div 
                        key={currency.code}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50 border-blue-200' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          if (settings) {
                            const newCurrencies = isSelected 
                              ? settings.displayCurrencies.filter(c => c !== currency.code)
                              : [...settings.displayCurrencies, currency.code];
                            setSettings({...settings, displayCurrencies: newCurrencies});
                          }
                        }}
                      >
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs">
                            {currency.symbol}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{currency.code}</div>
                            <div className="text-xs text-gray-600">{currency.name}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 历史记录 */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>汇率历史记录</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                暂无历史汇率数据
              </div>
              <div className="flex justify-center">
                <Button variant="outline" size="sm">
                  查看更多历史
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 汇率计算器 */}
      <Card>
        <CardHeader>
          <CardTitle>汇率计算器</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label>金额</Label>
              <Input type="number" placeholder="请输入金额" defaultValue="1000" />
            </div>
            <div>
              <Label>从</Label>
              <Select defaultValue="CNY">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {supportedCurrencies.map(currency => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>到</Label>
              <Select defaultValue="USD">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {supportedCurrencies.map(currency => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-800">
              $138.00 USD
            </div>
            <div className="text-sm text-blue-600 mt-1">
              按当前汇率 1 CNY = 0.138 USD 计算
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}