import {
  ForecastParams,
  ForecastResult,
  OverviewStats,
} from "@/lib/state/income";

// API 基础配置
const API_BASE = "/api/v1";

// 获取收入预测数据
export async function fetchIncomeForecast(
  params: ForecastParams
): Promise<{ items: ForecastResult[] }> {
  const searchParams = new URLSearchParams({
    startDate: params.startDate,
    endDate: params.endDate,
  });

  if (params.cityId) {
    searchParams.set("cityId", params.cityId);
  }

  const response = await fetch(`${API_BASE}/income/forecast?${searchParams}`);

  if (!response.ok) {
    throw new Error(`预测计算失败: ${response.statusText}`);
  }

  return response.json();
}

// 获取收入概况统计
export async function fetchIncomeOverview(
  startDate: string,
  endDate: string,
  cityId?: string
): Promise<OverviewStats> {
  const searchParams = new URLSearchParams({
    startDate,
    endDate,
  });

  if (cityId) {
    searchParams.set("cityId", cityId);
  }

  const response = await fetch(`${API_BASE}/income/overview?${searchParams}`);

  if (!response.ok) {
    throw new Error(`获取收入概况失败: ${response.statusText}`);
  }

  return response.json();
}

// 获取收入时序数据（复用现有接口）
export async function fetchIncomeTimeseries(
  startDate: string,
  endDate: string
): Promise<{
  series: Record<string, Array<{ month: string; value: number }>>;
}> {
  const searchParams = new URLSearchParams({
    from: startDate,
    to: endDate,
  });

  const response = await fetch(
    `${API_BASE}/reports/income/timeseries?${searchParams}`
  );

  if (!response.ok) {
    throw new Error(`获取时序数据失败: ${response.statusText}`);
  }

  return response.json();
}

// 触发收入回算
export async function triggerIncomeRecalc(params: {
  taxYear: number;
  endMonth: number;
  cityId?: string;
}): Promise<{ updated: number }> {
  const response = await fetch(`${API_BASE}/income/recalc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`收入回算失败: ${response.statusText}`);
  }

  return response.json();
}

// 获取收入记录（复用现有接口）
export async function fetchIncomeRecords(
  startDate: string,
  endDate: string,
  userId?: string
): Promise<{ items: any[] }> {
  const searchParams = new URLSearchParams({
    from: startDate,
    to: endDate,
  });

  if (userId) {
    searchParams.set("userId", userId);
  }

  const response = await fetch(`${API_BASE}/income/records?${searchParams}`);

  if (!response.ok) {
    throw new Error(`获取收入记录失败: ${response.statusText}`);
  }

  return response.json();
}
