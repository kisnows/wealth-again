import { describe, it, expect } from "vitest";
import { computePerformance, twr, xirr } from "@/lib/performance";

describe("performance", () => {
  it("twr simple", () => {
    const v = twr([
      { startValue: 100, endValue: 110, netFlowDuring: 0 },
      { startValue: 110, endValue: 121, netFlowDuring: 0 },
    ]);
    expect(Number(v.toFixed(4))).toBeCloseTo(0.21, 2);
  });
  it("xirr simple", () => {
    const rate = xirr([
      { date: new Date("2024-01-01"), amount: -1000 },
      { date: new Date("2024-12-31"), amount: 1100 },
    ]);
    expect(rate).toBeGreaterThan(0.05);
  });
  it("computePerformance integration", () => {
    const perf = computePerformance(
      [
        { date: new Date("2024-01-01"), value: 1000 },
        { date: new Date("2024-06-01"), value: 1300 },
        { date: new Date("2024-12-31"), value: 1600 },
      ],
      [{ date: new Date("2024-03-01"), amount: 200 }]
    );
    expect(perf.endValue).toBe(1600);
    expect(perf.pnl).toBeCloseTo(1600 - 1000 - 200, 2);
  });
});
