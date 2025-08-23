import { describe, expect, it } from "vitest";
import { formatCurrency, formatPercentage } from "@/lib/utils";

describe("utils formatting", () => {
  it("formatCurrency basic", () => {
    const s = formatCurrency(1234.5, "CNY", { locale: "zh-CN" });
    expect(s).toBeTypeOf("string");
  });
  it("formatCurrency fallback", () => {
    const s = formatCurrency(NaN as unknown as number);
    expect(s).toBe("-");
  });
  it("formatPercentage", () => {
    expect(formatPercentage(0.1234)).toBe("12.34%");
  });
});
