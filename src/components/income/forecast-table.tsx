"use client";

import { useState } from "react";
import { CurrencyDisplay } from "@/components/shared/currency";

interface IncomeForecastTableProps {
  data: any[];
  userBaseCurrency: string;
}

/**
 * 收入预测表格组件
 */
export function IncomeForecastTable({ data, userBaseCurrency }: IncomeForecastTableProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  const columns = [
    { key: "ym", label: "月份", width: "w-24" },
    { key: "grossThisMonth", label: "税前总收入", highlight: true },
    { key: "net", label: "税后总收入", highlight: true, color: "text-green-600" },
    { key: "socialInsuranceThisMonth", label: "社保", color: "text-blue-600" },
    { key: "housingFundThisMonth", label: "公积金", color: "text-purple-600" },
    { key: "taxThisMonth", label: "税", color: "text-red-600" },
    { key: "salaryThisMonth", label: "工资" },
    { key: "bonusThisMonth", label: "奖金", color: "text-orange-600" },
    { key: "longTermCashThisMonth", label: "长期现金", color: "text-blue-600" },
    { key: "appliedTaxRate", label: "适用税率" },
    { key: "markers", label: "备注" },
    { key: "cumulativeIncome", label: "累计总收入" },
  ];

  const formatMarkers = (markers: any) => {
    if (!markers) return "-";

    const items = [
      markers.salaryChange ? "工资变动" : null,
      markers.bonusPaid ? "奖金" : null,
      markers.longTermCashPaid ? `长期现金(${markers.longTermCashCount || 0}期)` : null,
      markers.taxChange ? "税务调整" : null,
    ].filter(Boolean);

    return items.length > 0 ? items.join(" / ") : "-";
  };

  const renderCellValue = (column: any, value: any, row: any) => {
    switch (column.key) {
      case "ym":
        return value || `${new Date().getFullYear()}-${String(row.month).padStart(2, "0")}`;

      case "appliedTaxRate":
        return value != null ? `${Number(value).toFixed(2)}%` : "-";

      case "markers":
        return <span className="text-sm text-gray-600">{formatMarkers(value)}</span>;

      case "grossThisMonth":
      case "net":
      case "socialInsuranceThisMonth":
      case "housingFundThisMonth":
      case "taxThisMonth":
      case "salaryThisMonth":
      case "cumulativeIncome":
        return (
          <CurrencyDisplay
            amount={value}
            userBaseCurrency={userBaseCurrency}
            className={column.highlight ? "font-semibold" : ""}
          />
        );

      case "bonusThisMonth":
      case "longTermCashThisMonth":
        return value && Number(value) > 0 ? (
          <CurrencyDisplay
            amount={value}
            userBaseCurrency={userBaseCurrency}
            className="font-medium"
          />
        ) : (
          "-"
        );

      default:
        return value || "-";
    }
  };

  if (data.length === 0) {
    return <div className="text-center py-8 text-gray-500">暂无预测数据</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-gray-50">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`text-left py-3 px-2 text-sm font-medium text-gray-700 ${column.width || "min-w-24"}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row: any, index) => {
            const rowKey = row.ym || `month-${row.month || index}`;
            const isSelected = selectedMonth === rowKey;

            return (
              <tr
                key={rowKey}
                className={`
                  border-b cursor-pointer hover:bg-gray-50 transition-colors
                  ${isSelected ? "bg-blue-50" : ""}
                `}
                onClick={() => setSelectedMonth(isSelected ? "" : rowKey)}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`
                      py-3 px-2 text-sm
                      ${column.color || ""}
                      ${column.highlight ? "font-semibold" : ""}
                    `}
                  >
                    {renderCellValue(column, row[column.key], row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
