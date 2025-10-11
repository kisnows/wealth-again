# 收入管理 PRD（统一版）

> 适用范围：收入配置、累计预扣个税计算、年度回算、人工调整、规则维护，以及 `/income/*` 前端。  
> 单一实时来源：所有月度收入结果取自 `IncomeRecord`，前端只展示服务端计算输出或人工调整后的值。

## 1. 模块目标
- 以累计预扣法生成税前/税后收入预测，确保任意月份都可回算并对账。
- 集中维护工资、奖金、长期现金（LTC）、股权激励以及专项调整，管理员可配置城市社保/公积金与税制。
- 给普通用户提供高效的录入与核对体验；给管理员提供批量维护与追踪能力。
- 所有计算逻辑统一在服务层实现，前端调用 REST 接口并通过 SWR 获取数据，保证数值一致。

## 2. 角色职责
| 角色 | 核心操作 | 权限补充 |
| --- | --- | --- |
| 普通用户 | 维护工资变更、奖金、长期现金、股权激励、月度人工调整；查看年度收入与预测；触发年度回算；设置个人专项附加扣除 | 仅能操作本人数据 |
| 管理员 | 拥有普通用户全部能力；配置城市社保/公积金与税制；执行人工回算；模拟登录排查 | 敏感操作写入 `AuditLog`，记录管理员 ID、用户 ID、操作内容 |

## 3. 核心场景与流程

### 3.1 收入配置与录入
- **工资变更**：字段 `effectiveFrom`（日期）、`grossMonthly`、`currency`；同月多条取最新一条（`effectiveFrom < nextMonthStart`）。新增、编辑、删除时需要提示影响当月计算结果。
- **奖金**：一次性收入，字段 `payDate`、`amount`、`currency`、`note`、`taxMethod`（默认并入工资累计计税）。
- **长期现金（LTC）**：字段 `totalAmount`、`grantDate`、`periods`（默认 16）、`recurrence`（季度/按月等）、`currency`；默认等额拆分，可在计划内调整单期金额。
- **股权激励**：Grant（`totalUnits`、`startVestDate`、`vestPeriods`、`vestInterval`、`currency`、`defaultFairValue`），自动生成 Vest 列表；支持逐条维护 `units` 与 `fairValue`。
- **专项附加扣除**：按税年维护 `deductionAmount`，系统按照 12 个月平摊（后续可扩展自定义方式）。
- **人工调整**：对任意月份录入 `manualGross`、`manualNet`、`manualTaxable`、`manualIncomeTax` 等字段；存在人工值时覆盖计算结果并在界面标记来源。
- **操作约束**：写操作通过 `src/lib/api/*` 调用 REST API，并携带 `Idempotency-Key`；成功后需失效相关 SWR key。

### 3.2 年度回算与预测
- 参数：`taxYear`、`endMonth`、`cityId`（可选）、是否重新生成预测。
- 执行流程：服务层拉取该年度 1..N 月的工资/奖金/LTC/股权/人工调整、城市与税制配置 → 按下文计算规则重算 `IncomeRecord` → 回填对账字段。
- 回算完成后返回更新条数；前端收到响应后刷新概况、时序和记录列表。
- 回算操作写入 `AuditLog`，包括操作者、参数、耗时与结果。

### 3.3 数据展示与对账
- `IncomeOverview`：展示指定区间的税前收入、税后收入、社保、公积金、个税累计、月份数、同比/环比指标。
- `IncomeTimeseries`：提供税前/税后、社保、公积金、个税的按月序列，支持折线/柱状图切换。
- `IncomeForecast`：给出所选时间范围内的月度明细列表，包含核心对账字段。
- `IncomeRecord`：真实落库数据（含人工调整），字段见 4.3，页面可进行单月人工编辑。
- 所有展示组件从 SWR 读取，刷新 token `recalcToken` 用于回算后统一刷新。

## 4. 计算规则与字段

### 4.1 输入
- 当月工资（根据 3.1 规则取最新记录）。
- 当月奖金、LTC 分期金额、股权激励当期归属金额。
- 城市配置（社保、公积金）与税制配置（基础/专项扣除、税率表）。

### 4.2 计算流程（累计预扣法）
1. **基数**  
   ```
   social_base  = clamp(gross, social_lower, social_upper)
   housing_base = clamp(gross, housing_lower, housing_upper)
   ```
2. **五险一金（个人）**  
   ```
   pension_personal       = social_base * pension_rate_personal
   medical_personal       = social_base * medical_rate_personal + medical_fixed_personal
   unemployment_personal  = social_base * unemployment_rate_personal
   social_personal        = pension_personal + medical_personal + unemployment_personal
   housing_personal       = housing_base * housing_rate_personal
   ```
3. **当月税前收入**  
   ```
   month_income = salary + bonus + ltc + equity
   ```
4. **当期应纳税所得额**  
   ```
   taxable_current = month_income
                     - social_personal
                     - housing_personal
                     - basic_deduction_monthly
                     - special_additional_deduction_monthly
   ```
   若人工填写 `manualTaxable` 则优先使用。
5. **累计应纳税所得额**  
   ```
   taxable_cumulative = prev.taxable_cumulative + max(taxable_current, 0)
   ```
6. **累计应纳税额**  
   ```
   tax_cumulative = taxable_cumulative * rate - quick_deduction
   ```
7. **当月应预扣个税**  
   ```
   tax_due = max(tax_cumulative - prev.tax_paid_cumulative, 0)
   ```
   若人工填写 `manualIncomeTax` 则覆盖。
8. **实发**  
   ```
   net_income = month_income - social_personal - housing_personal - tax_due
   ```
   若人工填写 `manualNet` 则覆盖。

### 4.3 对账字段
- `taxableCurrent`
- `taxableCumulative`
- `taxCumulative`
- `taxPaidCumulative`
- `netIncome`
- 人工覆盖的字段需记录 `source = manual` 以便前端标记。

## 5. 配置项
- **城市规则 (`CityRuleSS/HF`)**：基数上下限、个人比例、医保固定额、生效日期。
- **税务配置 (`TaxConfig`)**：`basicDeductionMonthly`、`specialAdditionalDeductionMonthly`、适用城市/版本、生效日期。
- **税率表 (`TaxBracket`)**：阈值、税率、速算扣除数，按年份版本化。
- 配置变更后需触发相关 SWR key 失效，并支持历史版本重算。

## 6. 计算示例（2025 年 1–3 月）
示例场景同原文档，工资 20,000，LTC 每季度 10,000，3 月一次性奖金 30,000，社保=2,103，公积金=2,400。

### 共用中间量
- 社保（个人）：养老 1,600；医保 403；失业 100；合计 2,103。
- 公积金（个人）：2,400。

### 1 月
- 税前收入：30,000  
- 当期应税：20,497  
- 当月个税：614.91  
- 税后实发：24,882.09

### 2 月
- 税前收入：20,000  
- 当期应税：10,497  
- 当月个税：314.91  
- 税后实发：15,182.09

### 3 月
- 税前收入：60,000  
- 当期应税：50,497  
- 当月个税：4,699.28  
- 税后实发：50,797.72

> 校验：累计个税 5,629.10 = 614.91 + 314.91 + 4,699.28。

## 7. 验收清单
- 导入示例数据回算 1–3 月：社保=2,103，公积金=2,400，个税与实发金额与上文一致。
- 前端 `/income` 下的概览、录入、预测、记录等页面仅展示服务端最新数据，手动触发回算后自动刷新。
- 规则维护页面可编辑专项附加扣除；接口具幂等校验。
- 敏感操作（回算、人工调整、管理员模拟登录）写入 `AuditLog`，便于追踪。
- 所有导出的数字支持中文与英文环境下的金额格式化，保持 2 位小数。
