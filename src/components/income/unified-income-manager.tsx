"use client";

import { Award, DollarSign, Edit, Filter, Plus, Trash2, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { CurrencyDisplay, CurrencySelect } from "@/components/shared/currency";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFormSubmit } from "@/hooks/use-income-data";

// 收入记录类型定义
export type IncomeRecordType = "salary" | "bonus" | "long_term_cash";

export interface IncomeRecord {
  id: string;
  type: IncomeRecordType;
  amount: number;
  currency: string;
  effectiveDate: string;
  createdAt: string;
  // 特定字段
  grossMonthly?: number; // 工资变更
  totalAmount?: number; // 长期现金
}

interface UnifiedIncomeManagerProps {
  userBaseCurrency: string;
  onDataChange?: () => void;
}

const RECORD_TYPE_CONFIG = {
  salary: {
    label: "工资变更",
    icon: DollarSign,
    color: "blue",
    bgClass: "bg-blue-100",
    textClass: "text-blue-800",
    endpoint: "/api/income/changes",
  },
  bonus: {
    label: "奖金计划",
    icon: Award,
    color: "amber",
    bgClass: "bg-amber-100",
    textClass: "text-amber-800",
    endpoint: "/api/income/bonus",
  },
  long_term_cash: {
    label: "长期现金",
    icon: TrendingUp,
    color: "emerald",
    bgClass: "bg-green-100",
    textClass: "text-green-800",
    endpoint: "/api/income/long-term-cash",
  },
} as const;

/**
 * 统一的收入记录管理组件
 * 合并工资、奖金、长期现金的管理功能
 */
export function UnifiedIncomeManager({
  userBaseCurrency,
  onDataChange,
}: UnifiedIncomeManagerProps) {
  // ==================== 状态管理 ====================
  const [records, setRecords] = useState<IncomeRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<IncomeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 筛选状态
  const [typeFilter, setTypeFilter] = useState<IncomeRecordType | "all">("all");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // 编辑状态
  const [editingRecord, setEditingRecord] = useState<IncomeRecord | null>(null);

  // 表单状态
  const [formData, setFormData] = useState({
    type: "salary" as IncomeRecordType,
    amount: "",
    currency: userBaseCurrency,
    effectiveDate: new Date().toISOString().slice(0, 10),
    note: "",
  });

  // 提交状态
  const [submitting, setSubmitting] = useState(false);

  // ==================== 数据加载 ====================
  const loadRecords = async () => {
    setLoading(true);
    setError("");
    try {
      // 并发加载三种类型的数据
      const [salariesRes, bonusesRes, longTermRes] = await Promise.all([
        fetch("/api/income/changes?page=1&pageSize=50"),
        fetch("/api/income/bonus?page=1&pageSize=50"),
        fetch("/api/income/long-term-cash?page=1&pageSize=50"),
      ]);

      // 检查响应状态
      if (!salariesRes.ok || !bonusesRes.ok || !longTermRes.ok) {
        console.error("API responses:", {
          salaries: salariesRes.status,
          bonuses: bonusesRes.status,
          longTerm: longTermRes.status,
        });
        throw new Error("API 请求失败");
      }

      const [salariesData, bonusesData, longTermData] = await Promise.all([
        salariesRes.json(),
        bonusesRes.json(),
        longTermRes.json(),
      ]);

      console.log("API data received:", {
        salariesData,
        bonusesData,
        longTermData,
      });

      // 检查数据结构并安全地处理
      const salaryRecords = (salariesData?.data || []).map((item: any) => ({
        ...item,
        type: "salary" as IncomeRecordType,
        amount: item.grossMonthly || 0,
        effectiveDate: item.effectiveFrom || new Date().toISOString(),
        createdAt: item.createdAt || new Date().toISOString(),
      }));

      const bonusRecords = (bonusesData?.data || []).map((item: any) => ({
        ...item,
        type: "bonus" as IncomeRecordType,
        amount: item.amount || 0,
        effectiveDate: item.effectiveDate || new Date().toISOString(),
        createdAt: item.createdAt || new Date().toISOString(),
      }));

      const longTermRecords = (longTermData?.data || []).map((item: any) => ({
        ...item,
        type: "long_term_cash" as IncomeRecordType,
        amount: item.totalAmount || 0,
        effectiveDate: item.effectiveDate || new Date().toISOString(),
        createdAt: item.createdAt || new Date().toISOString(),
      }));

      // 组合并标准化数据
      const combinedRecords: IncomeRecord[] = [
        ...salaryRecords,
        ...bonusRecords,
        ...longTermRecords,
      ];

      console.log("Combined records:", combinedRecords);
      setRecords(combinedRecords);
    } catch (err) {
      console.error("Load records error:", err);
      setError(`加载数据失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setLoading(false);
    }
  };

  // ==================== 数据过滤和排序 ====================
  useEffect(() => {
    let filtered = [...records];

    // 按类型筛选
    if (typeFilter !== "all") {
      filtered = filtered.filter((record) => record.type === typeFilter);
    }

    // 排序
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "date") {
        comparison = new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime();
      } else {
        comparison = a.amount - b.amount;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    setFilteredRecords(filtered);
  }, [records, typeFilter, sortBy, sortOrder]);

  // 组件挂载时加载数据
  useEffect(() => {
    loadRecords();
  }, []);

  // ==================== 表单操作 ====================
  const resetForm = () => {
    setFormData({
      type: "salary",
      amount: "",
      currency: userBaseCurrency,
      effectiveDate: new Date().toISOString().slice(0, 10),
      note: "",
    });
    setEditingRecord(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const config = RECORD_TYPE_CONFIG[formData.type];
      const submitData: any = {
        currency: formData.currency,
        effectiveFrom: formData.effectiveDate,
      };

      // 根据类型设置不同的字段
      if (formData.type === "salary") {
        submitData.grossMonthly = Number(formData.amount);
      } else if (formData.type === "bonus") {
        submitData.amount = Number(formData.amount);
        submitData.effectiveDate = formData.effectiveDate;
        delete submitData.effectiveFrom;
      } else if (formData.type === "long_term_cash") {
        submitData.totalAmount = Number(formData.amount);
        submitData.effectiveDate = formData.effectiveDate;
        delete submitData.effectiveFrom;
      }

      const method = editingRecord ? "PUT" : "POST";
      const url = editingRecord ? `${config.endpoint}?id=${editingRecord.id}` : config.endpoint;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();

      if (result.success) {
        loadRecords();
        resetForm();
        onDataChange?.();
      } else {
        setError(result.error?.message || "操作失败");
      }
    } catch (err) {
      setError("网络错误，请稍后重试");
      console.error("Submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== 记录操作 ====================
  const handleEdit = (record: IncomeRecord) => {
    setEditingRecord(record);
    setFormData({
      type: record.type,
      amount: record.amount.toString(),
      currency: record.currency,
      effectiveDate: record.effectiveDate.slice(0, 10),
      note: "",
    });
  };

  const handleDelete = async (record: IncomeRecord) => {
    if (!confirm(`确定要删除这条${RECORD_TYPE_CONFIG[record.type].label}记录吗？`)) {
      return;
    }

    try {
      const config = RECORD_TYPE_CONFIG[record.type];
      const response = await fetch(`${config.endpoint}?id=${record.id}`, {
        method: "DELETE",
      });

      const result = await response.json();
      if (result.success) {
        loadRecords();
        onDataChange?.();
      } else {
        setError(result.error || "删除失败");
      }
    } catch (err) {
      setError("删除失败");
      console.error("Delete error:", err);
    }
  };

  // ==================== 渲染 ====================
  return (
    <div className="space-y-6">
      {/* 错误提示 */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError("")} className="ml-2 text-destructive hover:text-destructive/80">
            ×
          </button>
        </div>
      )}

      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <Plus className="w-5 h-5 text-primary" />
            {editingRecord ? "编辑收入记录" : "添加收入记录"}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs
            value={formData.type}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, type: value as IncomeRecordType }))
            }
          >
            <TabsList className="grid w-full grid-cols-3">
              {Object.entries(RECORD_TYPE_CONFIG).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {config.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {Object.entries(RECORD_TYPE_CONFIG).map(([key, config]) => (
              <TabsContent key={key} value={key}>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="amount" className="text-foreground">
                        {key === "salary" ? "月薪" : key === "bonus" ? "奖金金额" : "总金额"}
                      </Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="请输入金额"
                        value={formData.amount}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, amount: e.target.value }))
                        }
                        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="currency" className="text-foreground">货币</Label>
                      <CurrencySelect
                        value={formData.currency}
                        onChange={(value) => setFormData((prev) => ({ ...prev, currency: value }))}
                        data-testid="currency-select"
                      />
                    </div>

                    <div>
                      <Label htmlFor="effectiveDate" className="text-foreground">生效日期</Label>
                      <Input
                        id="effectiveDate"
                        type="date"
                        value={formData.effectiveDate}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, effectiveDate: e.target.value }))
                        }
                        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
                      {submitting ? "提交中..." : editingRecord ? "更新记录" : "添加记录"}
                    </Button>
                    {editingRecord && (
                      <Button
                        type="button"
                        onClick={resetForm}
                        variant="outline"
                        className="border-border bg-background text-foreground hover:bg-accent"
                      >
                        取消编辑
                      </Button>
                    )}
                  </div>
                </form>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* 记录列表 */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Filter className="w-5 h-5 text-muted-foreground" />
              收入记录管理
            </CardTitle>

            {/* 筛选和排序控件 */}
            <div className="flex items-center gap-3">
              <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  {Object.entries(RECORD_TYPE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={`${sortBy}-${sortOrder}`}
                onValueChange={(value) => {
                  const [by, order] = value.split("-");
                  setSortBy(by as "date" | "amount");
                  setSortOrder(order as "asc" | "desc");
                }}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">日期倒序</SelectItem>
                  <SelectItem value="date-asc">日期正序</SelectItem>
                  <SelectItem value="amount-desc">金额倒序</SelectItem>
                  <SelectItem value="amount-asc">金额正序</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {error ? (
            <div className="text-center py-8">
              <div className="text-destructive mb-2">{error}</div>
              <Button
                size="sm"
                variant="outline"
                onClick={loadRecords}
                className="border-border bg-background text-foreground hover:bg-accent"
              >
                重新加载
              </Button>
            </div>
          ) : loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {records.length === 0 ? "暂无数据" : "没有符合条件的记录"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-foreground">类型</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">金额</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">生效日期</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">创建时间</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => {
                    const config = RECORD_TYPE_CONFIG[record.type];
                    const Icon = config.icon;

                    return (
                      <tr key={`${record.type}-${record.id}`} className="border-b border-border hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bgClass} ${config.textClass}`}>
                            <Icon className="w-3 h-3" />
                            {config.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <CurrencyDisplay
                            amount={record.amount}
                            fromCurrency={record.currency}
                            userBaseCurrency={userBaseCurrency}
                            className="font-semibold text-foreground"
                            data-testid={`record-amount-${record.id}`}
                          />
                        </td>
                        <td className="py-3 px-4 text-foreground">{new Date(record.effectiveDate).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-foreground">{new Date(record.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(record)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(record)}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}