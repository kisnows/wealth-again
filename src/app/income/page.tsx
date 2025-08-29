"use client";

import IncomeEntryModule from "@/components/modules/IncomeEntryModule";
import IncomeForecastModule from "@/components/modules/IncomeForecastModule";
import IncomeOverviewModule from "@/components/modules/IncomeOverviewModule";

export default function IncomePage() {
  return (
    <main className="space-y-8">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">收入管理中心</h1>
          <p className="text-sm text-gray-600 mt-1">
            管理收入信息、预测计算和统计分析
          </p>
        </div>
      </div>
      
      {/* 收入概况 */}
      <section>
        <IncomeOverviewModule />
      </section>
      
      {/* 收入录入 */}
      <section>
        <IncomeEntryModule />
      </section>
      
      {/* 收入预测 */}
      <section>
        <IncomeForecastModule />
      </section>
    </main>
  );
}
