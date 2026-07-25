"use client";

import { create } from "zustand";

// 预测参数类型
export interface ForecastParams {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  cityId?: string; // 可选，用于覆盖用户当前城市
}

// 预测结果类型
export interface ForecastResult {
  month: string; // YYYY-MM-DD
  salary: number; // 工资
  bonus: number; // 奖金
  longTermCash: number; // 长期现金
  equityIncome: number; // 股权收入
  grossIncome: number; // 税前总收入
  socialInsurance: number; // 社保个人缴纳
  housingFund: number; // 公积金个人缴纳
  incomeTax: number; // 个税
  netIncome: number; // 税后收入
  taxRate: number; // 实际税率
  currency: string; // 币种

  // 累计字段
  cumulativeGrossIncome: number; // 税前累计收入
  cumulativeNetIncome: number; // 税后累计收入
  cumulativeSocialInsurance: number; // 累计社保缴纳
  cumulativeHousingFund: number; // 累计公积金缴纳
  cumulativeIncomeTax: number; // 累计个税缴纳
}

// 概况统计类型
export interface OverviewStats {
  totalGrossIncome: number; // 总税前收入
  totalNetIncome: number; // 总税后收入
  totalSocialInsurance: number; // 总社保
  totalHousingFund: number; // 总公积金
  totalTax: number; // 总个税
  averageTaxRate: number; // 平均税率
  monthlyAverage: number; // 月均税后收入
  yearOverYearGrowth: number; // 同比增长率
  monthsCount: number; // 统计月数
  currency: string; // 币种
  period: string; // 统计期间描述
}

// 收入管理状态类型
type IncomeState = {
  // 当前选中的Tab
  activeTab: "entry" | "forecast" | "overview";

  // 预测参数
  forecastParams: ForecastParams;

  // 预测结果缓存
  forecastData: ForecastResult[] | null;
  forecastLoading: boolean;
  forecastError: string | null;

  // 概况统计缓存
  overviewStats: OverviewStats | null;
  overviewLoading: boolean;
  overviewError: string | null;

  // 时序数据缓存（用于图表）
  timeseriesData: Record<
    string,
    Array<{ month: string; value: number }>
  > | null;
  timeseriesLoading: boolean;
  timeseriesError: string | null;

  // 最近一次收入回算触发，用于跨模块刷新
  recalcToken: number;

  // 操作方法
  setActiveTab: (tab: IncomeState["activeTab"]) => void;
  setForecastParams: (params: Partial<ForecastParams>) => void;
  setForecastData: (data: ForecastResult[] | null) => void;
  setForecastLoading: (loading: boolean) => void;
  setForecastError: (error: string | null) => void;
  setOverviewStats: (stats: OverviewStats | null) => void;
  setOverviewLoading: (loading: boolean) => void;
  setOverviewError: (error: string | null) => void;
  setTimeseriesData: (
    data: Record<string, Array<{ month: string; value: number }>> | null,
  ) => void;
  setTimeseriesLoading: (loading: boolean) => void;
  setTimeseriesError: (error: string | null) => void;
  notifyRecalc: () => void;
  clearCache: () => void;
  reset: () => void;
};

// 默认预测参数
const getDefaultForecastParams = (): ForecastParams => {
  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().substring(0, 10);
  return {
    startDate: `${currentYear}-01-01`,
    endDate: today, // 默认到今天
  };
};

export const useIncomeStore = create<IncomeState>((set, _get) => ({
  // 初始状态
  activeTab: "entry",
  forecastParams: getDefaultForecastParams(),

  // 预测相关状态
  forecastData: null,
  forecastLoading: false,
  forecastError: null,

  // 概况相关状态
  overviewStats: null,
  overviewLoading: false,
  overviewError: null,

  // 时序数据相关状态
  timeseriesData: null,
  timeseriesLoading: false,
  timeseriesError: null,

  // 回算触发
  recalcToken: 0,

  // 操作方法
  setActiveTab: (tab) => set({ activeTab: tab }),

  setForecastParams: (params) =>
    set((state) => ({
      forecastParams: { ...state.forecastParams, ...params },
    })),

  setForecastData: (data) => set({ forecastData: data }),
  setForecastLoading: (loading) => set({ forecastLoading: loading }),
  setForecastError: (error) => set({ forecastError: error }),

  setOverviewStats: (stats) => set({ overviewStats: stats }),
  setOverviewLoading: (loading) => set({ overviewLoading: loading }),
  setOverviewError: (error) => set({ overviewError: error }),

  setTimeseriesData: (data) => set({ timeseriesData: data }),
  setTimeseriesLoading: (loading) => set({ timeseriesLoading: loading }),
  setTimeseriesError: (error) => set({ timeseriesError: error }),

  notifyRecalc: () => set((state) => ({ recalcToken: state.recalcToken + 1 })),

  clearCache: () =>
    set({
      forecastData: null,
      forecastError: null,
      overviewStats: null,
      overviewError: null,
      timeseriesData: null,
      timeseriesError: null,
    }),

  reset: () =>
    set({
      activeTab: "entry",
      forecastParams: getDefaultForecastParams(),
      forecastData: null,
      forecastLoading: false,
      forecastError: null,
      overviewStats: null,
      overviewLoading: false,
      overviewError: null,
      timeseriesData: null,
      timeseriesLoading: false,
      timeseriesError: null,
      recalcToken: 0,
    }),
}));

// 选择器函数（用于性能优化）
export const selectForecastState = (state: IncomeState) => ({
  data: state.forecastData,
  loading: state.forecastLoading,
  error: state.forecastError,
  params: state.forecastParams,
});

export const selectOverviewState = (state: IncomeState) => ({
  stats: state.overviewStats,
  loading: state.overviewLoading,
  error: state.overviewError,
});

export const selectTimeseriesState = (state: IncomeState) => ({
  data: state.timeseriesData,
  loading: state.timeseriesLoading,
  error: state.timeseriesError,
});
