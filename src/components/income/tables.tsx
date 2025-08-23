"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { useFormSubmit } from "@/hooks/use-income-data";

interface DataTableProps {
  title: string;
  description?: string;
  columns: { key: string; label: string; render?: (value: any, row: any) => React.ReactNode }[];
  data: any[];
  actions?: {
    delete?: {
      endpoint: string;
      confirmMessage: string;
      successMessage: string;
    };
  };
  userBaseCurrency?: string;
}

/**
 * 通用数据表格组件
 */
export function DataTable({ 
  title, 
  description, 
  columns, 
  data, 
  actions,
  userBaseCurrency = "CNY"
}: DataTableProps) {
  const { submit: deleteItem, loading: deleteLoading } = useFormSubmit("", {
    method: "DELETE",
    successMessage: actions?.delete?.successMessage || "删除成功"
  });

  const handleDelete = async (id: string) => {
    if (!actions?.delete) return;
    
    if (!confirm(actions.delete.confirmMessage)) return;
    
    await deleteItem({}, `${actions.delete.endpoint}?id=${id}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && (
          <p className="text-sm text-gray-600">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                {columns.map((column) => (
                  <th key={column.key} className="text-left py-2">
                    {column.label}
                  </th>
                ))}
                {actions && <th className="text-left py-2">操作</th>}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (actions ? 1 : 0)} className="py-8 text-center text-gray-500">
                    暂无数据
                  </td>
                </tr>
              ) : (
                data.map((row, index) => (
                  <tr key={row.id || index} className="border-b">
                    {columns.map((column) => (
                      <td key={column.key} className="py-2">
                        {column.render ? column.render(row[column.key], row) : row[column.key]}
                      </td>
                    ))}
                    {actions && (
                      <td className="py-2">
                        {actions.delete && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(row.id)}
                            disabled={deleteLoading}
                          >
                            删除
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 工资变更记录表格组件
 */
interface SalaryChangesTableProps {
  data: any[];
  userBaseCurrency: string;
}

export function SalaryChangesTable({ data, userBaseCurrency }: SalaryChangesTableProps) {
  const columns = [
    { 
      key: "effectiveFrom", 
      label: "生效日期",
      render: (value: string) => new Date(value).toLocaleDateString()
    },
    { 
      key: "grossMonthly", 
      label: "月薪",
      render: (value: number, row: any) => (
        <CurrencyDisplay 
          amount={value} 
          fromCurrency={row.currency} 
          userBaseCurrency={userBaseCurrency}
        />
      )
    },
    { key: "currency", label: "币种" }
  ];

  return (
    <DataTable
      title="工资变更记录（最近）"
      columns={columns}
      data={data}
      userBaseCurrency={userBaseCurrency}
      actions={{
        delete: {
          endpoint: "/api/income/changes",
          confirmMessage: "确定要删除这条工资变更记录吗？",
          successMessage: "工资变更记录删除成功"
        }
      }}
    />
  );
}

/**
 * 奖金计划表格组件
 */
interface BonusPlansTableProps {
  data: any[];
  userBaseCurrency: string;
}

export function BonusPlansTable({ data, userBaseCurrency }: BonusPlansTableProps) {
  const columns = [
    { 
      key: "effectiveDate", 
      label: "生效日期",
      render: (value: string) => new Date(value).toLocaleDateString()
    },
    { 
      key: "amount", 
      label: "金额",
      render: (value: number, row: any) => (
        <CurrencyDisplay 
          amount={value} 
          fromCurrency={row.currency} 
          userBaseCurrency={userBaseCurrency}
        />
      )
    },
    { key: "currency", label: "币种" }
  ];

  return (
    <DataTable
      title="奖金计划（最近）"
      columns={columns}
      data={data}
      userBaseCurrency={userBaseCurrency}
      actions={{
        delete: {
          endpoint: "/api/income/bonus",
          confirmMessage: "确定要删除这条奖金计划吗？",
          successMessage: "奖金计划删除成功"
        }
      }}
    />
  );
}

/**
 * 长期现金计划表格组件
 */
interface LongTermCashTableProps {
  data: any[];
  userBaseCurrency: string;
}

export function LongTermCashTable({ data, userBaseCurrency }: LongTermCashTableProps) {
  const columns = [
    { 
      key: "effectiveDate", 
      label: "生效日期",
      render: (value: string) => new Date(value).toLocaleDateString()
    },
    { 
      key: "totalAmount", 
      label: "总金额",
      render: (value: number, row: any) => (
        <CurrencyDisplay 
          amount={value} 
          fromCurrency={row.currency} 
          userBaseCurrency={userBaseCurrency}
        />
      )
    },
    { key: "currency", label: "币种" },
    { 
      key: "quarterlyAmount", 
      label: "每季度金额",
      render: (value: any, row: any) => (
        <CurrencyDisplay 
          amount={Number(row.totalAmount) / 16} 
          fromCurrency={row.currency} 
          userBaseCurrency={userBaseCurrency}
        />
      )
    }
  ];

  return (
    <DataTable
      title="长期现金计划（最近）"
      columns={columns}
      data={data}
      userBaseCurrency={userBaseCurrency}
      actions={{
        delete: {
          endpoint: "/api/income/long-term-cash",
          confirmMessage: "确定要删除这条长期现金记录吗？",
          successMessage: "长期现金记录删除成功"
        }
      }}
    />
  );
}