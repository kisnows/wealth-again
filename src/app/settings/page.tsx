"use client";

import { useState, useEffect } from "react";
import { Plus, MapPin, Calendar, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { useUserPrefsStore } from "@/lib/state/user-prefs";
import CitySelect from "@/components/modules/CitySelect";
import AddCityDialog from "@/components/modules/AddCityDialog";
import { toast } from "sonner";

interface UserInfo {
  id: string;
  email: string;
  name: string;
  baseCurrency: string;
  currentCityId: string;
}

interface CityChangeRecord {
  id: string;
  userId: string;
  toCityId: string;
  toCity: {
    id: string;
    name: string;
    country: string;
  };
  changeDate: string;
  reason?: string;
  createdAt: string;
}

export default function SettingsPage() {
  const {
    displayCurrency,
    asOfDate,
    tableDensity,
    setDisplayCurrency,
    setAsOfDate,
    setTableDensity,
  } = useUserPrefsStore();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [cityChanges, setCityChanges] = useState<CityChangeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshCities, setRefreshCities] = useState(0);
  
  // New city change form
  const [newChange, setNewChange] = useState({
    toCityId: "",
    changeDate: "",
    reason: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/auth/me").then((res) => res.json()),
      fetch("/api/v1/city-changes").then((res) => res.json())
    ])
      .then(([userData, cityChangesData]) => {
        setUser(userData);
        setCityChanges(cityChangesData);
      })
      .catch((error) => console.error("Failed to fetch data:", error))
      .finally(() => setLoading(false));
  }, []);

  const handleBaseCurrencyUpdate = async (currency: string) => {
    try {
      const response = await fetch("/api/v1/user/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ baseCurrency: currency }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "更新失败");
      }

      const updatedUser = await response.json();
      setUser(updatedUser);
      toast.success("基础币种已更新");
    } catch (error) {
      console.error("Update base currency error:", error);
      toast.error(error instanceof Error ? error.message : "更新失败");
    }
  };

  const handleCurrentCityUpdate = async (cityId: string) => {
    try {
      const response = await fetch("/api/v1/user/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currentCityId: cityId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "更新失败");
      }

      const updatedUser = await response.json();
      setUser(updatedUser);
      toast.success("当前城市已更新");
    } catch (error) {
      console.error("Update current city error:", error);
      toast.error(error instanceof Error ? error.message : "更新失败");
    }
  };

  const handleAddCityChange = async () => {
    if (!newChange.toCityId || !newChange.changeDate) {
      toast.error("请填写必要信息");
      return;
    }

    try {
      const response = await fetch("/api/v1/city-changes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newChange),
      });

      if (!response.ok) {
        throw new Error("Failed to add city change");
      }

      const newRecord = await response.json();
      setCityChanges(prev => [newRecord, ...prev]);
      toast.success("城市变更记录已添加");
      setNewChange({ toCityId: "", changeDate: "", reason: "" });
    } catch (error) {
      console.error("Add city change error:", error);
      toast.error("添加失败");
    }
  };

  if (loading) {
    return (
      <main className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-32 mb-4" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">用户设置</h1>
        <p className="text-muted-foreground mt-1">
          管理您的个人偏好和基础信息
        </p>
      </div>

      {/* 基础设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            基础设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="baseCurrency">基础币种</Label>
              <Select
                value={user?.baseCurrency || ""}
                onValueChange={handleBaseCurrencyUpdate}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择基础币种" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CNY">人民币 (CNY)</SelectItem>
                  <SelectItem value="USD">美元 (USD)</SelectItem>
                  <SelectItem value="EUR">欧元 (EUR)</SelectItem>
                  <SelectItem value="HKD">港币 (HKD)</SelectItem>
                  <SelectItem value="JPY">日元 (JPY)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="currentCity">当前工作城市</Label>
                <AddCityDialog 
                  onCityAdded={() => setRefreshCities(prev => prev + 1)} 
                />
              </div>
              <CitySelect
                key={refreshCities} // 强制刷新组件
                value={user?.currentCityId || ""}
                onValueChange={handleCurrentCityUpdate}
                placeholder="选择当前城市"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 城市变更记录 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            城市变更记录
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new city change */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-medium">添加城市变更记录</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newCity">迁移到城市</Label>
                <CitySelect
                  key={refreshCities} // 强制刷新组件
                  value={newChange.toCityId}
                  onValueChange={(cityId) => 
                    setNewChange(prev => ({ ...prev, toCityId: cityId }))
                  }
                  placeholder="选择目标城市"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="changeDate">变更日期</Label>
                <Input
                  type="date"
                  value={newChange.changeDate}
                  onChange={(e) => 
                    setNewChange(prev => ({ ...prev, changeDate: e.target.value }))
                  }
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reason">变更原因</Label>
                <Input
                  placeholder="如：工作调动、搬家等"
                  value={newChange.reason}
                  onChange={(e) => 
                    setNewChange(prev => ({ ...prev, reason: e.target.value }))
                  }
                />
              </div>
            </div>
            
            <Button onClick={handleAddCityChange} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              添加记录
            </Button>
          </div>

          {/* City change history */}
          <div>
            <h3 className="font-medium mb-3">历史记录</h3>
            {cityChanges.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>变更日期</TableHead>
                    <TableHead>目标城市</TableHead>
                    <TableHead>变更原因</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cityChanges.map((change) => (
                    <TableRow key={change.id}>
                      <TableCell>
                        {new Date(change.changeDate).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell>
                        {change.toCity?.name} ({change.toCity?.country})
                      </TableCell>
                      <TableCell>{change.reason || "-"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                暂无城市变更记录
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 显示偏好 */}
      <Card>
        <CardHeader>
          <CardTitle>显示偏好</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="displayCurrency">展示币种</Label>
            <Select
              value={displayCurrency ?? ""}
              onValueChange={(v) => setDisplayCurrency(v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择展示币种" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CNY">人民币 (CNY)</SelectItem>
                <SelectItem value="USD">美元 (USD)</SelectItem>
                <SelectItem value="EUR">欧元 (EUR)</SelectItem>
                <SelectItem value="HKD">港币 (HKD)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="asOfDate">统计日期</Label>
            <Input
              type="date"
              value={asOfDate ?? ""}
              onChange={(e) => setAsOfDate(e.target.value || null)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="tableDensity">表格密度</Label>
            <Select
              value={tableDensity}
              onValueChange={(v) => setTableDensity(v as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择表格密度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable">舒适</SelectItem>
                <SelectItem value="compact">紧凑</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
