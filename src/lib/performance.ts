/**
 * 现金流接口
 * @interface Cashflow
 * @property {Date} date - 现金流日期
 * @property {number} amount - 现金流金额
 */
export interface Cashflow {
  date: Date;
  amount: number;
}

/**
 * 期间接口
 * @interface Period
 * @property {number} startValue - 期初价值
 * @property {number} endValue - 期末价值
 * @property {number} netFlowDuring - 期间净流入
 */
export interface Period {
  startValue: number;
  endValue: number;
  netFlowDuring: number;
}

/**
 * 时间加权收益率 (TWR) 计算函数
 * 时间加权收益率通过链接各子期间的收益率来计算，消除了期间内资金流动的影响
 * @param {Period[]} periods - 期间数组
 * @returns {number} 时间加权收益率
 */
export function twr(periods: Period[]): number {
  if (!periods.length) return 0;
  return (
    periods.reduce(
      (acc, p) => acc * ((p.endValue - p.netFlowDuring) / (p.startValue || 1)),
      1
    ) - 1
  );
}

/**
 * 内部收益率 (XIRR) 计算函数
 * 使用牛顿-拉夫逊方法计算内部收益率，并提供备选方案
 * @param {Cashflow[]} cashflows - 现金流数组
 * @param {number} guess - 初始猜测值，默认为0.1
 * @returns {number} 内部收益率
 */
export function xirr(cashflows: Cashflow[], guess = 0.1): number {
  if (cashflows.length < 2) return 0;
  const dates = cashflows.map((cf) => cf.date.getTime());
  const minDate = Math.min(...dates);
  const yearMs = 365 * 24 * 3600 * 1000;
  const f = (r: number) =>
    cashflows.reduce(
      (acc, cf) =>
        acc +
        cf.amount / Math.pow(1 + r, (cf.date.getTime() - minDate) / yearMs),
      0
    );
  const df = (r: number) =>
    cashflows.reduce((acc, cf) => {
      const t = (cf.date.getTime() - minDate) / yearMs;
      return acc - (t * cf.amount) / Math.pow(1 + r, t + 1);
    }, 0);
  let rate = guess;
  for (let i = 0; i < 50; i++) {
    const fv = f(rate);
    if (Math.abs(fv) < 1e-8) return rate;
    const deriv = df(rate);
    if (Math.abs(deriv) < 1e-10) break;
    const next = rate - fv / deriv;
    if (!isFinite(next) || next < -0.9999) break;
    rate = next;
  }
  // 备选扫描方案
  let best = rate,
    bestAbs = Math.abs(f(rate));
  for (const r of [-0.9, -0.5, -0.2, 0, 0.05, 0.1, 0.2, 0.5, 1, 2]) {
    const val = Math.abs(f(r));
    if (val < bestAbs) {
      bestAbs = val;
      best = r;
    }
  }
  return best;
}

/**
 * 绩效分解接口
 * @interface PerformanceBreakdown
 * @property {number} startValue - 起始价值
 * @property {number} endValue - 结束价值
 * @property {number} netContribution - 净贡献（外部资金流入总和）
 * @property {number} pnl - 盈亏
 * @property {number} twr - 时间加权收益率
 * @property {number} xirr - 内部收益率
 */
export interface PerformanceBreakdown {
  startValue: number;
  endValue: number;
  netContribution: number; // sum external flows
  pnl: number;
  twr: number;
  xirr: number;
}

/**
 * 计算投资绩效
 * @param {Array<{date: Date, value: number}>} valuations - 估值数据数组
 * @param {Cashflow[]} externalFlows - 外部资金流入数组
 * @returns {PerformanceBreakdown} 绩效分解结果
 */
export function computePerformance(
  valuations: { date: Date; value: number }[],
  externalFlows: Cashflow[]
): PerformanceBreakdown {
  if (!valuations.length)
    return {
      startValue: 0,
      endValue: 0,
      netContribution: 0,
      pnl: 0,
      twr: 0,
      xirr: 0,
    };
  const orderedVals = [...valuations].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  const startValue = orderedVals[0].value;
  const endValue = orderedVals[orderedVals.length - 1].value;
  // 在估值点处分割期间；假设资金流发生在期间开始（简化处理）
  const periods: Period[] = [];
  for (let i = 0; i < orderedVals.length - 1; i++) {
    const vStart = orderedVals[i];
    const vEnd = orderedVals[i + 1];
    const flows = externalFlows
      .filter((cf) => cf.date > vStart.date && cf.date <= vEnd.date)
      .reduce((a, b) => a + b.amount, 0);
    periods.push({
      startValue: vStart.value,
      endValue: vEnd.value,
      netFlowDuring: flows,
    });
  }
  const netContribution = externalFlows.reduce((a, b) => a + b.amount, 0);
  const pnl = endValue - startValue - netContribution;
  const twrValue = twr(periods);
  // XIRR现金流：负值表示投资贡献；我们将正金额视为资金流入 -> 转换符号
  const last = orderedVals[orderedVals.length - 1];
  const xirrFlows: Cashflow[] = [
    { date: orderedVals[0].date, amount: -startValue },
    ...externalFlows.map((f) => ({ ...f, amount: f.amount })),
    { date: last.date, amount: endValue },
  ];
  const xirrValue = xirr(xirrFlows);
  return {
    startValue,
    endValue,
    netContribution,
    pnl,
    twr: twrValue,
    xirr: xirrValue,
  };
}

/**
 * 绩效序列点接口
 * @interface PerformanceSeriesPoint
 * @property {Date} date - 日期
 * @property {number} value - 价值
 * @property {number} cumulativeNetContribution - 累计净贡献
 * @property {number} twrCumulative - 累计时间加权收益率
 */
export interface PerformanceSeriesPoint {
  date: Date;
  value: number;
  cumulativeNetContribution: number;
  twrCumulative: number; // cumulative TWR up to this point
}

/**
 * 计算绩效序列
 * @param {Array<{date: Date, value: number}>} valuations - 估值数据数组
 * @param {Cashflow[]} externalFlows - 外部资金流入数组
 * @returns {PerformanceSeriesPoint[]} 绩效序列点数组
 */
export function computePerformanceSeries(
  valuations: { date: Date; value: number }[],
  externalFlows: Cashflow[]
): PerformanceSeriesPoint[] {
  if (!valuations.length) return [];
  const orderedVals = [...valuations].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  const points: PerformanceSeriesPoint[] = [];
  let cumulativeNetContribution = 0;
  let twrProduct = 1;
  for (let i = 0; i < orderedVals.length; i++) {
    const vEnd = orderedVals[i];
    if (i === 0) {
      // 第一个点：初始化
      points.push({
        date: vEnd.date,
        value: vEnd.value,
        cumulativeNetContribution,
        twrCumulative: 0,
      });
      continue;
    }
    const vStart = orderedVals[i - 1];
    const flows = externalFlows
      .filter((cf) => cf.date > vStart.date && cf.date <= vEnd.date)
      .reduce((a, b) => a + b.amount, 0);
    cumulativeNetContribution += flows;
    const r = (vEnd.value - flows) / (vStart.value || 1);
    twrProduct *= r;
    points.push({
      date: vEnd.date,
      value: vEnd.value,
      cumulativeNetContribution,
      twrCumulative: twrProduct - 1,
    });
  }
  return points;
}
