## 009: 多币种与汇率支持完善

**目标**: 完整支持多币种账户与交易，统一估值与绩效换算到账户基础货币，打通 `FxRate` 的查询与使用闭环。

**成功标准**:

- 交易录入保留原币种；账户有 `baseCurrency`。
- 绩效与估值展示以账户 `baseCurrency` 展示；若交易存在不同币种，使用 `FxRate` 将现金流及估值换算到 `baseCurrency`。
- 若缺少当日汇率，回退到最近有效（不跨越超过 N 天，默认为 5），否则提示缺失。

**子任务**:

1. 基础设施
   - 新增 `src/lib/fx.ts`：
     - `getRate(base:string, quote:string, asOf:Date, toleranceDays=5)`
     - `convert(amount:number, from:string, to:string, asOf:Date)`
2. API 使用
   - 在 `/api/accounts/[id]/performance` 中：对 `flows` 与 `valuations` 做币种归一到 `Account.baseCurrency`。
   - 在估值快照写入接口中保留币种字段或约定以 `baseCurrency` 写入（当前仅数值，需文档标注）。
3. 前端
   - `AccountDetail` 若发现多币种交易，显示“已按汇率换算到 X”。
4. 测试
   - 新增 `src/tests/fx.test.ts`：
     - 场景 1：同日存在直达汇率
     - 场景 2：取最近有效汇率
     - 场景 3：超过容忍期报错

**测试命令**:

```bash
pnpm test -- src/tests/fx.test.ts
# 或
npx -y vitest run src/tests/fx.test.ts
```

**状态**: Completed
