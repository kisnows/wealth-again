"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface CityHistoryEntry {
  id: string;
  city: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
  createdAt: string;
}

interface CityData {
  currentCity: string;
  currentEffectiveCity: string;
  cityHistory: CityHistoryEntry[];
}

const CITIES = [
  "Beijing",
  "Shanghai", 
  "Shenzhen",
  "Hangzhou",
  "Guangzhou",
  "Nanjing",
  "Chengdu",
  "Wuhan",
  "Tianjin",
  "Xi'an",
  "Chongqing",
  "Qingdao",
  "Dalian",
  "Ningbo",
  "Xiamen"
];

export default function CityManagementPage() {
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state for adding new city change
  const [newCity, setNewCity] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load city data
  const loadCityData = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/user/city");
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "加载失败");
      }

      setCityData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载城市数据失败");
    } finally {
      setLoading(false);
    }
  };

  // Submit new city change
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCity) {
      setError("请选择城市");
      return;
    }

    if (!effectiveDate) {
      setError("请选择生效日期");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/user/city", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: newCity,
          effectiveFrom: effectiveDate,
          note: note || undefined
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "更新失败");
      }

      setSuccess("城市更新成功！");
      setNewCity("");
      setNote("");
      
      // Reload data to show updated information
      await loadCityData();

    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadCityData();
  }, []);

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit", 
      day: "2-digit"
    });
  };

  // Format datetime for display
  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
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
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">城市管理</h1>
          <p className="text-gray-600 mt-2">管理工作城市变更，影响社保公积金计算</p>
        </div>
        <Link href="/income">
          <Button variant="outline">返回收入管理</Button>
        </Link>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Current City Status */}
      {cityData && (
        <Card>
          <CardHeader>
            <CardTitle>当前城市状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-600">配置中的默认城市</Label>
                <div className="text-lg font-semibold">{cityData.currentCity}</div>
              </div>
              <div>
                <Label className="text-sm text-gray-600">当前实际生效城市</Label>
                <div className="text-lg font-semibold text-blue-600">{cityData.currentEffectiveCity}</div>
              </div>
            </div>
            
            {cityData.currentCity !== cityData.currentEffectiveCity && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
                💡 您的实际生效城市与默认城市不同，这是因为存在有生效日期的城市变更记录。
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add New City Change Form */}
      <Card>
        <CardHeader>
          <CardTitle>添加城市变更</CardTitle>
          <p className="text-sm text-gray-600">
            设置未来的城市变更，系统将在指定日期自动切换到新城市进行计算
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="newCity">选择城市</Label>
                <Select value={newCity} onValueChange={setNewCity}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择城市" />
                  </SelectTrigger>
                  <SelectContent>
                    {CITIES.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="effectiveDate">生效日期</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="note">备注说明（可选）</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="如：因工作调动搬迁至新城市"
                rows={3}
              />
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting ? "提交中..." : "添加城市变更"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* City History Table */}
      {cityData && (
        <Card>
          <CardHeader>
            <CardTitle>城市变更历史</CardTitle>
          </CardHeader>
          <CardContent>
            {cityData.cityHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                暂无城市变更记录
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>城市</TableHead>
                    <TableHead>生效起始</TableHead>
                    <TableHead>生效结束</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead>创建时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cityData.cityHistory.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.city}</TableCell>
                      <TableCell>{formatDate(entry.effectiveFrom)}</TableCell>
                      <TableCell>
                        {entry.effectiveTo ? formatDate(entry.effectiveTo) : "进行中"}
                      </TableCell>
                      <TableCell>{entry.note || "-"}</TableCell>
                      <TableCell>{formatDateTime(entry.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Help Text */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <div>
            <strong>城市影响范围：</strong>工作城市只影响社保、公积金的缴费基数和比例计算，不影响工资、奖金等收入数据本身。
          </div>
          <div>
            <strong>生效时间：</strong>城市变更将在指定的生效日期开始应用到社保公积金计算中。建议设置为下月1日。
          </div>
          <div>
            <strong>历史记录：</strong>系统保留所有城市变更历史，确保任意时间点的计算都能使用正确的城市政策。
          </div>
          <div>
            <strong>自动结束：</strong>当添加新的城市变更时，之前的城市记录会自动设置结束日期。
          </div>
        </CardContent>
      </Card>
    </div>
  );
}