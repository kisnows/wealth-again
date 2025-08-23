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
    bgClass: "bg-income-salary",
    textClass: "text-income-salary",
    endpoint: "/api/income/changes",
  },
  bonus: {
    label: "奖金计划",
    icon: Award,
    color: "amber",
    bgClass: "bg-income-bonus",
    textClass: "text-income-bonus",
    endpoint: "/api/income/bonus",
  },
  long_term_cash: {
    label: "长期现金",
    icon: TrendingUp,
    color: "emerald",
    bgClass: "bg-income-investment",
    textClass: "text-income-investment",
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
    try {
      // 并发加载三种类型的数据
      const [salariesRes, bonusesRes, longTermRes] = await Promise.all([
        fetch("/api/income/changes?page=1&pageSize=50"),
        fetch("/api/income/bonus?page=1&pageSize=50"),
        fetch("/api/income/long-term-cash?page=1&pageSize=50"),
      ]);

      const [salariesData, bonusesData, longTermData] = await Promise.all([
        salariesRes.json(),
        bonusesRes.json(),
        longTermRes.json(),
      ]);

      // 组合并标准化数据
      const combinedRecords: IncomeRecord[] = [
        ...salariesData.data.map((item: any) => ({
          ...item,
          type: "salary" as IncomeRecordType,
          amount: item.grossMonthly,
          effectiveDate: item.effectiveFrom,
        })),
        ...bonusesData.data.map((item: any) => ({
          ...item,
          type: "bonus" as IncomeRecordType,
          effectiveDate: item.effectiveDate,
        })),
        ...longTermData.data.map((item: any) => ({
          ...item,
          type: "long_term_cash" as IncomeRecordType,
          amount: item.totalAmount,
          effectiveDate: item.effectiveDate,
        })),
      ];

      setRecords(combinedRecords);
    } catch (err) {
      setError("加载数据失败");
      console.error("Load records error:", err);
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
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError("")} className="ml-2 text-red-500 hover:text-red-700">
            ×
          </button>
        </div>
      )}

      <Card className="wealth-card">
        <CardHeader className="wealth-card-header">
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            {editingRecord ? "编辑收入记录" : "添加收入记录"}
          </CardTitle>
        </CardHeader>
        <CardContent className="wealth-card-content">
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
                      <Label htmlFor="amount">
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
                        className="wealth-input"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="currency">货币</Label>
                      <CurrencySelect
                        value={formData.currency}
                        onChange={(value) => setFormData((prev) => ({ ...prev, currency: value }))}
                        data-testid="currency-select"
                      />
                    </div>

                    <div>
                      <Label htmlFor="effectiveDate">生效日期</Label>
                      <Input
                        id="effectiveDate"
                        type="date"
                        value={formData.effectiveDate}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, effectiveDate: e.target.value }))
                        }
                        className="wealth-input"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button type="submit" disabled={submitting} className="wealth-button-primary">
                      {submitting ? "提交中..." : editingRecord ? "更新记录" : "添加记录"}
                    </Button>
                    {editingRecord && (
                      <Button
                        type="button"
                        onClick={resetForm}
                        variant="outline"
                        className="wealth-button-secondary"
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
      <Card className="wealth-card">
        <CardHeader className="wealth-card-header">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-600" />
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
        <CardContent className="wealth-card-content">
          {loading ? (
            <div className="text-center py-8 text-slate-500">加载中...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-slate-500">暂无数据</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="wealth-table">
                <thead>
                  <tr>
                    <th>类型</th>
                    <th>金额</th>
                    <th>生效日期</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => {
                    const config = RECORD_TYPE_CONFIG[record.type];
                    const Icon = config.icon;

                    return (
                      <tr key={`${record.type}-${record.id}`}>
                        <td>
                          <span
                            className={`wealth-badge wealth-badge-${config.color} inline-flex items-center gap-1`}
                          >
                            <Icon className="w-3 h-3" />
                            {config.label}
                          </span>
                        </td>
                        <td>
                          <CurrencyDisplay
                            amount={record.amount}
                            fromCurrency={record.currency}
                            userBaseCurrency={userBaseCurrency}
                            className="font-semibold"
                            data-testid={`record-amount-${record.id}`}
                          />
                        </td>
                        <td>{new Date(record.effectiveDate).toLocaleDateString()}</td>
                        <td>{new Date(record.createdAt).toLocaleDateString()}</td>
                        <td>
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
