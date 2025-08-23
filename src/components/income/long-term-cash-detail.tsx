"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyWithSeparator } from "@/lib/currency";

interface LongTermCashDetailProps {
  longTermCash: any[];
  selectedMonth: string; // YYYY-MM format
}

export default function LongTermCashDetail({
  longTermCash,
  selectedMonth,
}: LongTermCashDetailProps) {
  if (!longTermCash || longTermCash.length === 0) {
    return null;
  }

  // 计算指定月份的长期现金发放详情
  const calculateMonthlyDetails = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const details: any[] = [];

    longTermCash.forEach((ltc) => {
      // 检查是否在发放期内（每年1、4、7、10月）
      if ([1, 4, 7, 10].includes(month)) {
        // 计算生效日期与当前日期的季度差
        const startDate = new Date(ltc.effectiveDate);
        const currentDate = new Date(year, month - 1, 1); // 月份从0开始

        // 计算季度数（每年4个季度）
        const startYear = startDate.getFullYear();
        const startMonth = startDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();

        const startQuarter = Math.floor(startMonth / 3);
        const currentQuarter = Math.floor(currentMonth / 3);

        const quartersDiff =
          (currentYear - startYear) * 4 + (currentQuarter - startQuarter);

        // 检查是否在16个季度的发放期内
        if (quartersDiff >= 0 && quartersDiff < 16) {
          // 计算每季度应发放的金额
          const quarterlyAmount = Number(ltc.totalAmount) / 16;
          details.push({
            id: ltc.id,
            startDate: ltc.effectiveDate,
            quarterlyAmount,
            quartersDiff,
            totalAmount: ltc.totalAmount,
          });
        }
      }
    });

    return details;
  };

  const monthlyDetails = calculateMonthlyDetails();

  if (monthlyDetails.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>长期现金发放详情</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-2">
          {selectedMonth} 月共有 {monthlyDetails.length} 笔长期现金发放：
        </p>
        <div className="space-y-2">
          {monthlyDetails.map((detail) => (
            <div
              key={detail.id}
              className="flex justify-between items-center p-2 border rounded"
            >
              <div>
                <p className="font-medium">
                  发放金额:{" "}
                  {formatCurrencyWithSeparator(detail.quarterlyAmount)}
                </p>
                <p className="text-sm text-gray-500">
                  生效日期: {new Date(detail.startDate).toLocaleDateString()} |
                  第 {detail.quartersDiff + 1} 次发放
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
