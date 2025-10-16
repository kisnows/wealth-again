# 收入管理模块：产品需求与技术规格

> **文档状态：已整合**
> 本文档是收入模块的唯一事实来源 (Single Source of Truth)，整合了产品需求、核心概念与技术规格。

## 1. 核心目标与原则

- **数据源唯一性**：所有收入相关的计算和预测逻辑**全部在服务端**完成。前端仅负责展示由 API 返回的数据。
- **核心实体 `IncomeRecord`**：`IncomeRecord` 表是所有月度收入计算结果的**唯一存储位置**。UI 上展示的所有“概览”、“时序”或“记录”，其数据源均为此表。
- **输入与输出分离**：用户或管理员操作的是**计算输入**（如工资变更、奖金、城市规则），而不是直接修改计算结果。系统响应这些输入，通过**自动化的回算过程**来更新 `IncomeRecord`。
- **页面功能不冗余**：除 `Dashboard` 作为全局信息聚合入口外，任何功能页面应有自己清晰独立的职责，**避免信息重复展示**。

## 2. 核心概念澄清

### 2.1 自动年度回算（Automated Recalculation）

**年度回算是一个自动化的内部数据对齐工具，而非报税工具。**

它的核心职责是：当任何影响收入计算的**输入**发生变化时（例如，用户补录了去年的工资变更、管理员更新了社保基数），系统会自动为所影响的年份创建一个**异步回算任务**。

- **自动化与延迟执行**：任务不会立即执行，而是会**延迟10分钟**。如果在这10分钟内，用户对同一年份的输入进行了多次修改，这些修改会**合并成一个回算任务**，避免了资源浪费。
- **手动触发**：系统依然提供“立即回算”的选项，供需要即时看到结果的用户使用。
- **任务状态追踪**：会有一个专门的 UI 界面（例如在 `/income/recalc-status`），用于展示所有回算任务的**状态**（排队中、运行中、已完成、失败），确保过程的透明性。

### 2.2 收入页面 (`/income`) 的整合视图

根据“页面功能不冗余”原则，原 `/reports/income` 页面被移除，其功能被整合进 `/income` 页面。现在，`/income` 页面是管理和分析收入的**唯一中心**，它包含以下视图：

1.  **收入概览 (Overview)**
    - **功能**: 对指定时间范围内的 `IncomeRecord` 数据进行**聚合 (Aggregation)**。它展示的是**累计值**，如“年度累计税前收入”、“平均月薪”、“总计个税”等。回答的是“我这段时间总共挣了多少钱？”的问题。

2.  **收入时序 (Timeseries)**
    - **功能**: 将 `IncomeRecord` 中的月度数据进行**可视化**，通常以折线图或柱状图展示。它关注的是**趋势与变化**，如“税后收入的逐月走势”、“个税在哪个月份有较大波动”。

3.  **月度收入记录 (Monthly Records)**
    - **功能**: **直接展示** `IncomeRecord` 表中的每一条记录，包含所有计算的中间值和最终值，用于**对账和审计**。
    - **关于“只能看不能改”**：这个设计是刻意的。用户不应直接修改一个计算结果。正确的做法是：
        - **修改输入**：去修改工资、奖金等原始数据，然后**等待系统自动回算**或**手动触发立即回算**。
        - **人工调整**：如果确实需要覆盖计算结果，系统提供了“人工调整”功能，并会在 UI 上明确提示此数据为人工覆盖。

## 3. 核心场景与流程

### 3.1 收入配置与录入
- **工资变更**: 字段 `effectiveFrom` (日期), `grossMonthly`, `currency`。同月内存在多条变更时，以 `effectiveFrom` 在当月内的最后一条为准 (逻辑：`effectiveFrom < nextMonthStart`)。
- **奖金**: 一次性收入，字段 `payDate`, `amount`, `currency`, `note`, `taxMethod` (默认并入工资累计计税)。
- **长期现金 (LTC)**: 字段 `totalAmount`, `grantDate`, `periods`, `recurrence`, `currency`。
- **股权激励**: Grant (`totalUnits`, `startVestDate`, `vestPeriods`, `vestInterval`, `currency`, `defaultFairValue`)。
- **专项附加扣除**: 按税年维护 `deductionAmount`。此扣除应用于月度计算中。
- **人工调整**: 对任意月份录入 `manualGross`, `manualNet`, `manualTaxable`, `manualIncomeTax` 等字段；存在人工值时覆盖计算结果并在界面标记来源。

### 3.2 自动化年度回算
(概念已在 2.1 节阐述)
- **触发机制**: 当任何影响收入计算的输入（如工资变更、规则更新）发生变化时，系统自动为受影响的年份创建一个**异步回算任务**。
- **任务合并**: 任务会延迟执行（例如10分钟），在此期间对同一年份的多次修改将合并为一个任务，以优化性能。
- **手动执行**: 系统保留“立即回算”的功能，供用户强制触发。
- **状态追踪**: 提供一个UI界面，用于监控回算任务的状态。

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
- 在每次回算时，以下字段将被计算并存入 `IncomeRecord`：
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

### 1 月
- 税前收入: 20,000 (工资) + 10,000 (LTC) = 30,000
- 当期应税: 30,000 - 2,103 - 2,400 - 6,000 = 19,497
- 当月个税: 19,497 * 3% = 584.91
- 税后实发: 30,000 - 2,103 - 2,400 - 584.91 = 24,912.09

### 2 月
- 税前收入: 20,000
- 当期应税: 20,000 - 2,103 - 2,400 - 6,000 = 9,497
- 累计应税: 19,497 + 9,497 = 28,994
- 当月个税: (28,994 * 3%) - 584.91 = 284.91
- 税后实发: 20,000 - 2,103 - 2,400 - 284.91 = 15,212.09

### 3 月
- 税前收入: 20,000 (工资) + 30,000 (奖金) = 50,000
- 当期应税: 50,000 - 2,103 - 2,400 - 6,000 = 39,497
- 累计应税: 28,994 + 39,497 = 68,491
- 累计应纳税: 36,000 * 3% + (68,491 - 36,000) * 10% = 4,329.1
- 当月个税: 4,329.1 - (584.91 + 284.91) = 3,459.28
- 税后实发: 50,000 - 2,103 - 2,400 - 3,459.28 = 42,037.72

## 7. 验收清单

- **计算准确性**: 输入示例参数，回算 1–3 月的当月个税与税后实发，数值与本文档计算示例一致。
- **数据一致性**: `IncomeRecord` 中的 `taxableCumulative`, `taxCumulative`, `taxPaid` 字段内部自洽。
- **规则可维护**: 规则与税制页面可维护新增的 `specialAdditionalDeductionMonthly` 字段。
- **操作可追溯**: 敏感操作（回算、人工调整、管理员模拟登录）均写入 `AuditLog`，便于追踪。
