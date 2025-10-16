# 收入管理模块：产品需求与技术规格

> **文档状态：已整合**
> 本文档整合并替代了 `doc/prd-income.md` 和 `doc/plans/prd-income-implementation-plan.md`，是收入模块的唯一事实来源 (Single Source of Truth)。

## 1. 模块目标

- 以累计预扣法生成税前/税后收入预测，确保任意月份都可回算并对账。
- 集中维护工资、奖金、长期现金（LTC）、股权激励以及专项调整，管理员可配置城市社保/公积金与税制。
- 为用户提供高效的录入与核对体验，为管理员提供批量维护与追踪能力。
- 所有计算逻辑统一在服务层实现，前端通过 API 获取数据，保证数值一致性。

## 2. 角色职责

| 角色 | 核心操作 | 权限补充 |
| --- | --- | --- |
| 普通用户 | 维护工资变更、奖金、长期现金、股权激励、月度人工调整；查看年度收入与预测；触发年度回算；设置个人专项附加扣除 | 仅能操作本人数据 |
| 管理员 | 拥有普通用户全部能力；配置城市社保/公积金与税制；执行人工回算；模拟登录排查 | 敏感操作写入 `AuditLog`，记录管理员 ID、用户 ID、操作内容 |

## 3. 核心场景与流程

### 3.1 收入配置与录入
- **工资变更**: 字段 `effectiveFrom` (日期), `grossMonthly`, `currency`。同月内存在多条变更时，以 `effectiveFrom` 在当月内的最后一条为准 (逻辑：`effectiveFrom < nextMonthStart`)。
- **奖金**: 一次性收入，字段 `payDate`, `amount`, `currency`, `note`, `taxMethod` (默认并入工资累计计税)。
- **长期现金 (LTC)**: 字段 `totalAmount`, `grantDate`, `periods`, `recurrence`, `currency`。默认等额拆分，支持在计划内调整单期金额。
- **股权激励**: Grant (`totalUnits`, `startVestDate`, `vestPeriods`, `vestInterval`, `currency`, `defaultFairValue`)，自动生成 Vest 列表；支持逐条维护 `units` 与 `fairValue`。
- **专项附加扣除**: 按税年维护 `deductionAmount`。此扣除应用于月度计算中。
- **人工调整**: 对任意月份录入 `manualGross`, `manualNet`, `manualTaxable`, `manualIncomeTax` 等字段；存在人工值时覆盖计算结果并在界面标记来源。

### 3.2 自动化年度回算
- **触发机制**: 当任何影响收入计算的输入（如工资变更、规则更新）发生变化时，系统自动为受影响的年份创建一个**异步回算任务**。
- **任务合并**: 任务会延迟执行（例如10分钟），在此期间对同一年份的多次修改将合并为一个任务，以优化性能。
- **手动执行**: 系统保留“立即回算”的功能，供用户强制触发。
- **状态追踪**: 提供一个UI界面，用于监控回算任务的状态（排队中、运行中、已完成、失败）。

## 4. 计算规则与技术实现

### 4.1 数据模型关键变更
- `TaxConfig` 表增加字段: `specialAdditionalDeduction: Decimal?`，用于存储月度专项附加扣除额。
- `IncomeRecord` 表增加对账字段: `taxableCumulative: Decimal?` (累计应纳税所得额) 和 `taxCumulative: Decimal?` (累计应纳税额)。

### 4.2 计算流程 (累计预扣法)

1.  **基数 (Base Calculation)**
    ```
    social_base  = clamp(gross, social_lower, social_upper)
    housing_base = clamp(gross, housing_lower, housing_upper)
    ```

2.  **五险一金 (个人) (Social Insurance & Housing Fund - Personal)**
    ```
    pension_personal       = social_base * pension_rate_personal
    medical_personal       = social_base * medical_rate_personal + medical_fixed_personal
    unemployment_personal  = social_base * unemployment_rate_personal
    social_personal        = pension_personal + medical_personal + unemployment_personal
    housing_personal       = housing_base * housing_rate_personal
    ```

3.  **当月税前总收入 (Total Gross Income of the Month)**
    ```
    month_income = salary + bonus + ltc + equity
    ```

4.  **当期应纳税所得额 (Current Taxable Income)**
    ```
    taxable_current = month_income
                     - social_personal
                     - housing_personal
                     - basic_deduction_monthly
                     - special_additional_deduction_monthly // 新增扣除项
    ```
    - 若 `taxable_current < 0`，则记为 0。
    - 若人工填写 `manualTaxable` 则优先使用。

5.  **累计应纳税所得额 (Cumulative Taxable Income)**
    ```
    taxable_cumulative = prev.taxable_cumulative + taxable_current
    ```

6.  **累计应纳税额 (Cumulative Tax Payable)**
    - 根据 `taxable_cumulative` 查询适用税率表 (`TaxBracket`)。
    ```
    tax_cumulative = taxable_cumulative * rate - quick_deduction
    ```

7.  **当月应预扣个税 (Income Tax for the Month)**
    ```
    tax_due = max(tax_cumulative - prev.tax_paid_cumulative, 0)
    ```
    - 若人工填写 `manualIncomeTax` 则覆盖。

8.  **税后实发 (Net Income)**
    ```
    net_income = month_income - social_personal - housing_personal - tax_due
    ```
    - 若人工填写 `manualNet` 则覆盖。

### 4.3 对账与回填字段
- 在每次回算时，以下字段将被计算并存入 `IncomeRecord`，用于对账和后续计算：
  - `taxableCurrent`
  - `taxableCumulative`
  - `taxCumulative`
  - `taxPaidCumulative` (即 `prev.tax_cumulative`)
  - `netIncome`
- 人工覆盖的字段需记录 `source = manual` 以便前端标记。

## 5. 配置项

- **城市规则 (`CityRuleSS/HF`)**: 基数上下限、个人比例、医保固定额、生效日期。
- **税务配置 (`TaxConfig`)**: `basicDeductionMonthly` (月度基本减除)、`specialAdditionalDeductionMonthly` (月度专项附加扣除)、适用城市/版本、生效日期。
- **税率表 (`TaxBracket`)**: 年度累计应纳税所得额的阈值、税率、速算扣除数，按年份版本化。

## 6. 计算示例 (2025 年 1–3 月)

- **场景**: 工资 20,000/月，LTC 每季度 10,000 (1月发放)，3月一次性奖金 30,000。
- **规则**: 社保基数与比例等计算后，个人部分合计 2,103；公积金个人部分 2,400；月度基本减除 5,000；月度专项附加扣除 1,000。

### 共用中间量
- 社保（个人）: 2,103
- 公积金（个人）: 2,400
- 月度扣除总额: 5,000 + 1,000 = 6,000

### 1 月
- 税前收入: 20,000 (工资) + 10,000 (LTC) = 30,000
- 当期应税: 30,000 - 2,103 - 2,400 - 6,000 = 19,497
- 当月个税: 19,497 * 3% = 584.91
- 税后实发: 30,000 - 2,103 - 2,400 - 584.91 = 24,912.09

### 2 月
- 税前收入: 20,000
- 当期应税: 20,000 - 2,103 - 2,400 - 6,000 = 9,497
- 累计应税: 19,497 + 9,497 = 28,994
- 累计应纳税: 28,994 * 3% = 869.82
- 当月个税: 869.82 - 584.91 = 284.91
- 税后实发: 20,000 - 2,103 - 2,400 - 284.91 = 15,212.09

### 3 月
- 税前收入: 20,000 (工资) + 30,000 (奖金) = 50,000
- 当期应税: 50,000 - 2,103 - 2,400 - 6,000 = 39,497
- 累计应税: 28,994 + 39,497 = 68,491
- 累计应纳税: 36,000 * 3% + (68,491 - 36,000) * 10% = 1,080 + 3,249.1 = 4,329.1
- 当月个税: 4,329.1 - 869.82 = 3,459.28
- 税后实发: 50,000 - 2,103 - 2,400 - 3,459.28 = 42,037.72

## 7. 验收清单

- **计算准确性**: 输入示例参数，回算 1–3 月的当月个税与税后实发，数值与本文档计算示例一致。
- **数据一致性**: `IncomeRecord` 中的 `taxableCumulative`, `taxCumulative`, `taxPaid` 字段内部自洽。
- **规则可维护**: 规则与税制页面可维护新增的 `specialAdditionalDeductionMonthly` 字段。
- **操作可追溯**: 敏感操作（回算、人工调整、管理员模拟登录）均写入 `AuditLog`，便于追踪。
