import { describe, expect, it } from "vitest";

import { formatMoney } from "@/lib/domain/money";

// 验证 formatMoney 在默认参数下输出固定格式避免水合差异
describe("formatMoney", () => {
  // 默认场景：人民币金额输出应固定为 ¥
  it("返回默认人民币金额格式", () => {
    expect(formatMoney(0)).toBe("¥0.00");
  });

  // 外币场景：确保使用 zh-CN 本地化时保留货币标识
  it("支持其他货币并保持符号一致", () => {
    expect(formatMoney(0, "USD")).toBe("US$0.00");
  });
});
