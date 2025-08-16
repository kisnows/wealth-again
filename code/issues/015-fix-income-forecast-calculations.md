## 015: 修复收入预测中的税前/社保/税计算并统一口径

**目标**:

- 税前收入=当月工资+当月奖金；社保与公积金仅按当月工资计提；税按累计预扣（支持任意起止区间）。
- 统一预测使用同一数据源：`IncomeChange`（工资）、`BonusPlan`（奖金）、`TaxService`（税务/社保配置）。

**成功标准**:

- 任意月份含奖金时，社保/公积金不因奖金而增加。
- 预测区间从任意月份开始时，首月按 1 个月基本减除（而非公历月序号）。
- 前端“收入预测”表格的“税前总收入、社保、税、税后总收入”口径一致且可解释。

**子任务**:

1. 方案 B 重构
   - [x] `src/lib/tax/service.ts` 新增 `calculateForecastWithholdingCumulative`
   - [x] `src/app/api/income/forecast/route.ts` 改为调用服务层累计预扣，逐月读取配置
   - [x] 保留杭州参数自动导入引导
2. 测试
   - [x] 更新 `src/tests/forecast.test.ts`（设置测试 DB 路径）
   - [x] 新增纯函数校验 `src/tests/tax-forecast-calc.test.ts`
3. 手动验证
   - [ ] 前端 `收入预测` 页面检查：税前=工资+奖金；社保/公积金=按工资计；税后=税前-社保-税

**测试**:

```bash
# 运行 forecast 接口测试（需要本地 SQLite 可写）
pnpm test -- src/tests/forecast.test.ts

# 运行纯函数计算测试
pnpm test -- src/tests/tax-forecast-calc.test.ts
```

**状态**: In Progress
