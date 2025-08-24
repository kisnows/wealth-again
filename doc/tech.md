下面是**第二份：技术设计文档**。
内容分三部分：**数据模型（表设计）→ 后端 API 设计（精简且可扩展）→ 前端页面与交互设计**。文档围绕你已采用的 **Prisma + SQLite**（可平滑迁移到 Postgres），结合你上一轮已确认/增强的数据结构（年度累计个税、城市社保/公积金、长期激励与股权激励、分录账本）。

---

# 一、数据模型（表设计）

## 1.1 设计准则与约束（关键取舍）

- **单一事实来源**：账务采用“**分录头 + 分录行**”(`TxnEntry` + `TxnLine`)，同/跨币种转账原子化写入。
- **币种不可变更**：`Account.baseCurrency` 创建后不允许更新（应用层校验；如迁到 Postgres 再加触发器）。
- **政策随时间生效**：`CityRuleSS/HF`、`TaxConfig/TaxBracket` 以 **\[start, end)** 区间管理，历史可追溯。
- **收入以月为单位**：`IncomeRecord` 用月份第一天 `monthDate` 作为唯一键（userId, monthDate）。
- **长期激励“计划 → 日程”**：`LongTermCashPlan/LongTermCashPayout`、`EquityGrant/EquityVest` 生成落库，计算时直接汇总当月事件。
- **精度**：SQLite 环境下用 `Decimal`；如迁移到 Postgres，可改为 `numeric(20,6)` 等。

## 1.2 数据表（Prisma 模型总览）

> 以下与上轮给你的 Prisma 方案一致，仅按“系统视角”分组说明字段要点。

### 用户与系统

- `User`：用户主档（`baseCurrency`, `currentCity` 用于默认汇率/城市规则）。
- `AuditLog`：审计日志。

### 账户与账务

- `Account`：账户（`accountType`：`SAVINGS/INVESTMENT/LOAN`；`baseCurrency` 固定）。
- `TxnEntry`：分录头（类型 `EntryTypeLike`：`DEPOSIT/WITHDRAW/TRANSFER/ADJUST/SYSTEM`；可携带 `fxRateId` 快照与 `meta`）。
- `TxnLine`：分录行（按**账户币种**记账，出负入正；转账一条出、一条入）。
- `ValuationSnapshot`：投资/负债估值快照（储蓄估值=本金）。
- `FxRate`：汇率（**USD 为 base** 的中间价快照）。

### 收入/税务/政策

- `IncomeChange`：工资变更（`effectiveFrom`）。
- `BonusPlan`：一次性奖金（`effectiveDate`）。
- `LongTermCashPlan` + `LongTermCashPayout`：长期现金计划与发放日程（季度/期数）。
- `EquityGrant` + `EquityVest`：股权激励授予与归属事件（年度/半年度；`fairValue` 可在归属日按行情回填）。
- `IncomeRecord`：**月度收入快照**（工资、奖金、其他、社保、公积金、月度应税基、当月个税、累计已缴、税后）。
- `City`：城市词表。
- `CityRuleSS`/`CityRuleHF`：城市社保/公积金规则（上下限与比例，时间区间）。
- `TaxConfig`/`TaxBracket`：税制（国家 + 税年 + 速算扣除，阈值为**年化累计档**）。

### 关键派生/约束（应用层保证）

- `TxnLine.currency === Account.baseCurrency`
- `Account.baseCurrency` 不可更新
- 转账写入必须**同一 `TxnEntry`** 下生成两条 `TxnLine`（原子性）

## 1.3 常用派生数据（服务层/SQL 视图等价查询）

- **账户本金（账户币种）**
  `principal = initialBalance + Σ(txnLine.amount)`（按账户聚合）。
- **账户估值**
  `SAVINGS → principal`；`INVESTMENT/LOAN → 最近一条 ValuationSnapshot.totalValue`。
- **收益/收益率**
  `profit = valuation - principal`；`roi = profit / principal`（principal≤0 → roi=null）。
- **净资产（展示币种）**
  用最新 USD 中间价将各账户估值折算到基准币种后聚合：资产合计 - 负债合计。

---

# 二、后端 API 设计（精简、优雅、可扩展）

## 2.1 统一规范

- **Base Path**：`/api/v1`
- **认证**：`Authorization: Bearer <JWT>`（或你公司统一 SSO）
- **幂等写入**：支持 `Idempotency-Key` 头（服务端做请求指纹缓存）
- **分页**：cursor 模式：`?limit=20&cursor=<opaque>`；返回 `nextCursor`
- **时间/货币**：时间用 ISO8601；金额用数字（展示端格式化）；货币代码用 ISO 4217
- **错误模型**：

  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "xxx", "details": {...} } }
  ```

## 2.2 资源与端点

### 2.2.1 账户 & 账务

#### 创建账户

- `POST /accounts`
- body

  ```json
  {
    "name": "Broker USD",
    "accountType": "INVESTMENT",
    "baseCurrency": "USD",
    "initialBalance": 0,
    "subType": "Securities",
    "description": "IBKR"
  }
  ```

- resp：`{ id, ... }`

#### 编辑/归档账户

- `PATCH /accounts/:id`（允许：`name/subType/description/status`；禁止更改 `baseCurrency`）
- `POST /accounts/:id/archive`

#### 列表/详情/汇总

- `GET /accounts?type=INVESTMENT&status=ACTIVE`
- `GET /accounts/:id`
- `GET /accounts/:id/summary` → 返回 `principal, valuation, profit, roi`（账户币种 + 折算到用户基准币种两套）

#### 存取款

- `POST /entries/deposit`

  - 币种默认为账户的 `baseCurrency`，服务端会校验并拒绝不一致的币种。

  ```json
  {
    "accountId": "acc-id",
    "occurredAt": "2025-08-01T10:00:00+08:00",
    "amount": 1000,
    "note": "cash in"
  }
  ```

- `POST /entries/withdraw`（同上，`amount` 正数；服务端写行时转成负号）

#### 转账（同/跨币种）

- `POST /entries/transfer`

  - `from`/`to` 的 `currency`（如提供）必须分别等于对应账户的 `baseCurrency`，服务器会校验并拒绝不一致的币种。

  ```json
  {
    "from": { "accountId": "acc-cny", "amount": 1000, "currency": "CNY" },
    "to": { "accountId": "acc-usd", "currency": "USD" },
    "occurredAt": "2025-08-01T10:00:00+08:00",
    "fx": {
      "fxRateId": "fx-id" // 推荐：以快照id固化
      // 或者 "base": "USD", "quote": "CNY", "rate": 7.10
    },
    "note": "CNY -> USD"
  }
  ```

- 行为：服务端根据 fx 计算 `to.amount`，一次 `TxnEntry` 落两条 `TxnLine`。

#### 查询流水

- `GET /accounts/:id/lines?from=2025-08-01&to=2025-08-31&limit=50&cursor=...`

#### 估值

- `POST /valuations`

  - `currency` 必须等于账户的 `baseCurrency`，服务器会校验并拒绝不一致的币种。

  ```json
  {
    "accountId": "...",
    "asOf": "2025-08-01T00:00:00+08:00",
    "totalValue": 123456.78,
    "currency": "USD",
    "fxRateId": "fx-id",
    "note": "Q3"
  }
  ```

#### 汇率（管理/查询）

- `PUT /fxrates`（幂等 upsert 批量）

  ```json
  [
    { "base": "USD", "quote": "CNY", "asOf": "2025-08-01", "rate": 7.1 },
    { "base": "USD", "quote": "HKD", "asOf": "2025-08-01", "rate": 7.8 }
  ]
  ```

- `GET /fxrates?base=USD&quotes=CNY,HKD&asOf=2025-08-01`

---

### 2.2.2 收入 & 税务

#### 工资变更

- `POST /income/changes`

  ```json
  { "effectiveFrom": "2025-03-01", "grossMonthly": 12000, "currency": "CNY" }
  ```

- `GET /income/changes?from=2024-01-01&to=2026-01-01`

#### 奖金计划（一次性）

- `POST /income/bonus-plans`
  - `taxMethod`: `MERGE`（并入工资综合计税）或 `SEPARATE`（单独计税），默认 `MERGE`

  ```json
  {
    "effectiveDate": "2025-07-10",
    "amount": 20000,
    "currency": "CNY",
    "taxMethod": "MERGE"
  }
  ```

- `GET /income/bonus-plans?year=2025`

#### 长期现金（计划 → 日程自动生成）

- `POST /income/ltc/plans`

  ```json
  {
    "totalAmount": 160000,
    "currency": "CNY",
    "startDate": "2025-01-01",
    "periods": 16,
    "recurrence": "QUARTERLY"
  }
  ```

- `POST /income/ltc/plans/:id/generate`（如需按非平均金额传自定义拆分数组）
- `GET /income/ltc/plans/:id/payouts?from=2025-01-01&to=2028-12-31`

#### 股权激励（授予 → 归属日程）

- `POST /income/equity/grants`

  ```json
  {
    "type": "RSU",
    "symbol": "AAPL",
    "grantDate": "2025-01-01",
    "totalUnits": 400,
    "startVestDate": "2025-07-01",
    "vestPeriods": 4,
    "vestInterval": "YEARLY"
  }
  ```

- `POST /income/equity/grants/:id/generate`
- 归属日回填市值（用于计税）：

  - `PATCH /income/equity/vests/:vestId`

    ```json
    { "fairValue": 12345.67, "currency": "CNY" }
    ```

#### 城市规则

- `PUT /rules/cities`（创建/更新城市）
- `PUT /rules/social-security`（`CityRuleSS` 批量 upsert）
- `PUT /rules/housing-fund`（`CityRuleHF` 批量 upsert）
- `GET /rules/social-security?city=Shanghai&on=2025-05-01`（返回当日有效规则）

#### 税制与税表

- `PUT /rules/tax/config`（`TaxConfig` upsert）
- `PUT /rules/tax/brackets`（`TaxBracket` 批量 upsert）
- `GET /rules/tax/brackets?country=CN&taxYear=2025`

#### 月度收入快照（读/写/回算）

- 读取区间：
  `GET /income/records?from=2025-05-01&to=2025-08-01`
- 写（人工修正）：
  `PATCH /income/records/:id`（覆盖 `socialInsuranceBase/housingFundBase/specialDeductions/...`）
- **年度累计回算**（核心）：
  `POST /income/recalc`

  ```json
  { "taxYear": 2025, "endMonth": 8, "cityId": "city-id-or-empty" }
  ```

  - 行为：按**1–8 月累计**计算，逐月回填 `IncomeRecord` 的 `ss/hf/taxableIncome/incomeTax/taxPaid/netIncome`；前端随后只取 5–8 月展示。

---

### 2.2.3 报表

#### Dashboard 总览

- `GET /reports/dashboard?asOf=2025-08-01&displayCurrency=CNY`

  - 返回：总资产/总负债/净资产（展示币种）、资产占比（S/I/L）、近 12 个月净资产曲线。

#### 资产与账户报表

- `GET /reports/accounts/summary?displayCurrency=CNY`
- `GET /reports/accounts/:id/timeseries?metric=valuation&from=2024-09-01&to=2025-08-01`

#### 收入与税收报表

- `GET /reports/income/timeseries?from=2025-01-01&to=2025-12-01`

  - 返回：工资、奖金、长期现金、股权激励、社保、公积金、个税、税后收入各曲线。

---

## 2.3 领域服务（后端内部）推荐拆分

- `LedgerService`：入账/转账/估值/本金与汇总查询
- `FxService`：汇率管理与折算
- `IncomeService`：工资/奖金/长期现金/股权激励聚合
- `TaxService`：规则读取、年度累计个税计算器
- `RuleService`：城市规则、税制管理
- `ReportService`：Dashboard 与各维度聚合

> 这样每个模块职责单一，API 层只做 DTO ↔ domain 的编解码。

---

# 三、前端页面与交互设计

## 3.1 技术栈建议

- **React + TypeScript + Tailwind + Shadcn/UI**（你已使用）
- **Zustand** 做轻量状态；**React Query**（或 SWR）做数据缓存与请求态
- **Route 结构**（建议）：

  ```
  /dashboard
  /accounts
    /:accountId
    /:accountId/transfer
    /:accountId/valuation
  /income
    /records
    /salary-changes
    /bonus
    /long-term-cash
    /equity
  /rules
    /cities
    /social-security
    /housing-fund
    /tax
  /settings
  ```

- **国际化/币种**：基准币种显示 +临时切换；金额格式化封装 `formatMoney(amount, currency)`。

## 3.2 页面明细

### A. Dashboard

- **卡片**：总资产 / 总负债 / 净资产（展示币种）
- **图表**：

  - 净资产 12 个月趋势（折线）
  - 资产占比（储蓄/投资/借贷）饼图，可点击跳转对应账户列表

- **最近变动**：最新 10 条 `TxnEntry` 与最新估值

### B. 账户列表 / 详情

- 列表：按 `type/status/currency` 过滤；每行显示 `principal/valuation/profit/roi`
- 详情：

  - 顶部：账户摘要（账户币种 + 折算基准币种）
  - Tab：

    1. **流水**（server-side 分页，筛选存/取/转/调；支持导出 CSV）
    2. **估值**（表格 + 折线）
    3. **操作**（存取款/转账/新增估值）

- **转账弹窗**：选择 from/to、金额、汇率快照（默认自动带入最近一次，支持手动覆盖）

### C. 收入与税务

- **收入快照表**（月维度）：列含工资、奖金、长期现金、股权激励、社保、公积金、当月应税基、当月个税、税后收入；顶部支持筛选区间（默认本年）
- **工资变更**：表单（生效日期/金额）；侧栏展示变更时间线
- **一次性奖金**：表单（生效月/金额/税法）
- **长期现金**：

  - 创建计划：总额、开始月、期数、频率（季度等）
  - 计划详情：发放日程表（可手动编辑某期金额/延期）

- **股权激励**：

  - 创建授予：类型/总份额/开始归属日/期数/间隔
  - 归属日程：按月分组；支持在归属日回填 `fairValue`

- **一键回算**：选择年份、截止月，点击“重新计算”，刷新快照表（反映“1–M 累计后再截取 5–8 展示”的口径）

### D. 规则管理（管理员）

- 城市列表
- 社保/公积金规则编辑（上下限、比例、生效时间）
- 税制编辑（年度起征额、税表档、速算扣除数）

### E. 设置

- 基准币种、默认城市、数据导入/导出、API 密钥、审计日志

## 3.3 关键交互流程

**跨币种转账**

1. 用户在“转账”弹窗填 from/to/金额
2. 前端调用 `GET /fxrates` 拉最近快照；展示“预计入账金额”
3. 提交 `POST /entries/transfer`（附 `fxRateId` 和 `Idempotency-Key`）
4. 成功后刷新账户摘要与流水

**年度累计回算**

1. 用户在收入页选择年份=2025、截止月=8
2. 调 `POST /income/recalc`
3. 前端 `GET /income/records?from=2025-05-01&to=2025-08-01` 更新表格与图

## 3.4 前端数据层（类型与 hooks 略例）

```ts
// types
export type Money = { amount: number; currency: string };
export type AccountSummary = {
  id: string;
  name: string;
  type: "SAVINGS" | "INVESTMENT" | "LOAN";
  currency: string;
  principal: Money;
  valuation: Money;
  profit: Money;
  roi: number | null;
};

// hooks
export function useAccountSummary(id: string) {
  return useQuery(["accountSummary", id], () =>
    api.get(`/accounts/${id}/summary`).then((r) => r.data)
  );
}

export function useRecalcIncome() {
  const qc = useQueryClient();
  return useMutation(
    (p: { taxYear: number; endMonth: number; cityId?: string }) =>
      api.post("/income/recalc", p),
    {
      onSuccess: () => qc.invalidateQueries(["incomeRecords"]),
    }
  );
}
```

## 3.5 组件与样式

- **表单**：Shadcn 表单控件（日期/数字/选择）、zod 校验
- **表格**：虚拟化表格（百万级流水时也流畅），支持列选择导出
- **图表**：Recharts 折线/饼图；统一数值格式化
- **可访问性**：表单 `aria-describedby`、键盘操作、图表提供数据表格替代视图

---

# 四、计算与一致性细节

## 4.1 年度累计个税（中国综合所得）

- 逐月：
  `gross + bonus + otherIncome + ltc + equityFairValue - ss - hf - standardDeduction - special - others - charity >= 0 → monthlyTaxable`
- 累计到当月：`cumulativeTaxable = Σ monthlyTaxable(1..M)`
- 映射 `TaxBracket(M 年)`：
  `cumulativeTax = cumulativeTaxable * rate - quickDeduction`
- 当月应缴：`monthTaxDue = cumulativeTax - lastCumulativePaid; if <0 → 0`
- 累计已缴：`cumulativePaid += monthTaxDue`
- 税后：`net = grossTotal - ss - hf - monthTaxDue`
- 将 `ss/hf/monthlyTaxable/monthTaxDue/cumulativePaid/net` 回填 `IncomeRecord`

## 4.2 账户与估值

- `SAVINGS`：估值=本金；**不允许**录入估值快照（或忽略）
- `INVESTMENT/LOAN`：取最近估值；若缺失 → 可提示“估值过期”

## 4.3 汇率选择

- 转账 **必须**使用当时快照（idempotent）；报表默认取**最近日期**的中间价（可在 UI 允许“截至日期”选择）

---

# 五、测试与发布

## 5.1 最小可用测试清单

- **账务**：存取款/同币种转账/跨币种转账（含幂等重试）
- **估值**：投资账户估值更新影响收益/ROI
- **规则**：5 月前后社保上下限不同，月度计算结果两侧断点正确
- **个税**：1–8 月累计后，5–8 月展示税率不会“从 3% 重新开始”
- **长期现金**：16 期季度发放正确分布到 16 个不同月份
- **RSU**：年度/半年度归属，归属月计入 `otherIncome`（或专列），回算正确
- **报表**：净资产折算与趋势曲线端到端验证

## 5.2 迁移与演进

- SQLite → Postgres：

  - Decimal 精度迁移到 `numeric(20,6)`；
  - 增加触发器保障“账户币种不可变”“分录行币种=账户币种”；
  - 可引入**物化视图**做汇总加速。

---

# 六、落地顺序（建议 Sprints）

1. **Sprint 1（账本 MVP）**

   - 账户/分录/转账/估值/汇率
   - Dashboard 基础（净资产/资产占比/最新流水）

2. **Sprint 2（收入与规则）**

   - IncomeChange/BonusPlan/IncomeRecord；TaxConfig/TaxBracket；City/SS/HF
   - “年度累计回算”服务 + 收入页

3. **Sprint 3（长期激励）**

   - LongTermCashPlan/Payout、EquityGrant/Vest + 计划生成器
   - 收入页整合长期现金/股权激励

4. **Sprint 4（报表与打磨）**

   - 收入/税收报表、估值时效提醒、审计日志完善
