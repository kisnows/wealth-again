import type {
  ForecastParams,
  ForecastResult,
  OverviewStats,
} from "@/lib/state/income";
import type { IncomeRecord } from "@/server/db/types";

// API 基础配置
const API_BASE = "/api/v1";

// 获取收入预测数据
export async function fetchIncomeForecast(
  params: ForecastParams,
): Promise<{ items: ForecastResult[] }> {
  const searchParams = new URLSearchParams({
    startDate: params.startDate,
    endDate: params.endDate,
  });

  if (params.cityId) {
    searchParams.set("cityId", params.cityId);
  }

  const response = await fetch(
    `${API_BASE}/income-tax/forecast?${searchParams}`,
  );

  if (!response.ok) {
    throw new Error(`预测计算失败: ${response.statusText}`);
  }

  return response.json();
}

// 获取收入概况统计
export async function fetchIncomeOverview(
  startDate: string,
  endDate: string,
  cityId?: string,
): Promise<OverviewStats> {
  const searchParams = new URLSearchParams({
    startDate,
    endDate,
  });

  if (cityId) {
    searchParams.set("cityId", cityId);
  }

  const response = await fetch(
    `${API_BASE}/income-tax/overview?${searchParams}`,
  );

  if (!response.ok) {
    throw new Error(`获取收入概况失败: ${response.statusText}`);
  }

  return response.json();
}

// 获取收入时序数据（复用现有接口）
export async function fetchIncomeTimeseries(
  startDate: string,
  endDate: string,
): Promise<{
  series: Record<string, Array<{ month: string; value: number }>>;
}> {
  const searchParams = new URLSearchParams({
    from: startDate,
    to: endDate,
  });

  const response = await fetch(
    `${API_BASE}/reporting/income/timeseries?${searchParams}`,
  );

  if (!response.ok) {
    throw new Error(`获取时序数据失败: ${response.statusText}`);
  }

  return response.json();
}

// 获取收入记录（复用现有接口）
export async function fetchIncomeRecords(
  startDate: string,
  endDate: string,
  userId?: string,
): Promise<{ items: IncomeRecord[] }> {
  const searchParams = new URLSearchParams({
    from: startDate,
    to: endDate,
  });

  if (userId) {
    searchParams.set("userId", userId);
  }

  const response = await fetch(
    `${API_BASE}/income-tax/records?${searchParams}`,
  );

  if (!response.ok) {
    throw new Error(`获取收入记录失败: ${response.statusText}`);
  }

  return response.json();
}
