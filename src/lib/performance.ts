export interface Cashflow {
  date: Date;
  amount: number;
}
export interface Period {
  startValue: number;
  endValue: number;
  netFlowDuring: number;
}

// Time-Weighted Return: chain of subperiod returns removing impact of intra-period flows
export function twr(periods: Period[]): number {
  if (!periods.length) return 0;
  return (
    periods.reduce(
      (acc, p) => acc * ((p.endValue - p.netFlowDuring) / (p.startValue || 1)),
      1
    ) - 1
  );
}

// Internal Rate (XIRR) via Newton-Raphson with fallbacks
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
  // fallback scan
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

export interface PerformanceBreakdown {
  startValue: number;
  endValue: number;
  netContribution: number; // sum external flows
  pnl: number;
  twr: number;
  xirr: number;
}

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
  // Build periods splitting at valuation points; assume flows occur at period start (simplification)
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
  // XIRR cashflows: negative contributions (investments) standard sign; we treat positive amount as contribution in flows -> invert sign
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

export interface PerformanceSeriesPoint {
  date: Date;
  value: number;
  cumulativeNetContribution: number;
  twrCumulative: number; // cumulative TWR up to this point
}

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
      // First point: initialize
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
