# UI 与页面路由规划

## 1. 路由树概览
```
/app
├─ layout.tsx                 # 全局导航、主题、会话守卫
├─ page.tsx                   # 重定向 → /dashboard
├─ signin/page.tsx            # 登录页
├─ dashboard/page.tsx         # 财务总览
├─ income/
│   ├─ page.tsx               # 收入管理首页（概览 + 录入 + 预测）
│   ├─ salary-changes/*       # 工资变更管理（表格 + 抽屉表单）
│   ├─ bonus/*                # 奖金计划
│   ├─ long-term-cash/*       # 长期现金激励计划
│   ├─ equity/*               # 股权激励计划
│   ├─ records/*              # 月度收入记录（含人工调整）
│   └─ recalc/*               # 年度回算入口
├─ accounts/page.tsx          # 账户列表
├─ entries/*                  # 交易流水录入（存入/取出/转账）
├─ reports/*                  # 报表（资产、收入、税务）
├─ rules/*                    # 城市社保、公积金、税务配置
└─ settings/page.tsx          # 用户设置（币种、城市、年度扣除）
```
> `*` 表示该目录下由组件或 Route Handler 支撑的子视图；部分仍需补充 `page.tsx` 或统一在父页面内通过对话框/抽屉实现。

## 2. 页面与模块说明

### 2.1 /dashboard
- **目的**：呈现 PRD 要求的“本年度截至当前”的资产、负债、净资产、收入、税费等关键指标。
- **主要组件**：
  - `NetWorthLine`, `AllocPie`, `TopAccounts`（已存在于 `components/modules/Charts`）。
  - 收入卡片：依赖 `useIncomeTimeseries`（`src/lib/api/reports`）。
- **数据依赖**：`useDashboard`、`useAccountsSummary`、`useIncomeTimeseries`。
- **交互**：
  - 顶部展示当前展示币种与统计日期（只读 Badge/Breadcrumb），提供跳转 `/settings` 的入口以修改偏好。
  - 管理员 impersonate 模式下在标题旁显示当前视角用户。

### 2.2 /income
- **结构**：主页面由 `IncomeAnalyticsPanel`（概览）、`IncomeEntryModule`（配置与录入）、`IncomeForecastModule`（预测与回算）组成；子目录用于更细化的表单视图。
- **关键需求映射**：
  - `IncomeAnalyticsPanel` 作为唯一的收入统计组件，展示累计税前/税后收入、社保、公积金、税额，并输出月度明细；`/reports/income` 同样复用该组件，保证数据与渲染逻辑一致。
  - `IncomeEntryModule` 中包含导航到工资/奖金/LTC/股权管理的卡片或 tab。
  - `IncomeForecastModule` 提供历史与未来预测图，使用 `useIncomeForecast`（待在 `src/lib/api/income` 增补）。
- **人工调整**：
  - 在 `records` 子模块中提供月度表格，支持编辑人工字段，调用 `/api/income/records/[id]` PATCH。
  - UI 上需以 Tag 或图标标识正在使用人工值。
- **年度回算**：`recalc` 子模块提供表单（税年、截止月份、城市、是否使用人工调整），调用 `/api/income/recalc`。执行后需触发 SWR `mutate`。

### 2.3 /income/salary-changes
- **页面组成**：表格列出历史记录，右侧抽屉或对话框用于新增/编辑。
- **表单字段**：`effectiveFrom`、`grossMonthly`、`currency`（默认用户基准币种）。
- **校验**：同月多条允许存在，保存时按后端顺序覆盖；应提醒用户生效逻辑。

### 2.4 /income/bonus
- **功能**：新增/编辑一次性奖金，批量导入（CSV）放在对话框内。
- **额外字段**：`taxMethod`（默认并入工资），`note`。
- **列表视图**：按照时间倒序；支持筛选“历史/未来”。

### 2.5 /income/long-term-cash
- **功能**：维护长期现金计划与 payout。
- **UI**：
  - 计划列表（名称、总额、起始日、周期、下次发放日）。
  - “生成分期”按钮调用 `/api/income/ltc/plans/{id}/generate`。
  - payout 表格支持单期编辑金额/日期。

### 2.6 /income/equity
- **功能**：维护股权激励；Grant 与 Vest 列表。
- **UI**：
  - Grant Card 展示总量、起始归属日、间隔。
  - Vest 列表允许录入 `fairValue`、`currency`，并显示是否计入当月收入。

### 2.7 /income/records
- **目的**：展示月度收入记录，可切换年度。
- **表格字段**：月份、税前收入、奖金、LTC、股权、社保、公积金、专线扣除（显示分摊额）、个税、税后、人工覆盖标记、备注。
- **交互**：
  - 行操作“人工调整” → 打开对话框填写 `manualGross/manualNet/manualTaxable/manualIncomeTax/manualComment`。
  - 支持导出（CSV）。
  - 管理员模式下可切换用户（下拉框）。

### 2.8 /accounts
- **页面结构**：
  - 顶部操作按钮（新增账户、导入）。
  - 汇率面板 `AccountFxPanel`：按账户实际使用的币种展示最新 USD 中间价、上次更新时间，并支持录入新快照（调用 `/api/v1/fxrates`）。
  - 账户列表（类型、余额、估值、收益率、币种），汇总卡片按展示币种折算金额。
  - 归档切换、快速筛选。
- **关联页面**：
  - `/entries` 模块负责具体交易录入（存入/取出/转账）。
  - `/reports/accounts` 展示账户报表。

### 2.9 /entries
- **视图**：
  - `entries/deposit`、`entries/withdraw`、`entries/transfer` 可复用同一表单组件，通过 props 切换模式。
  - 转账需要选择汇率快照（调用 `useFxRates`）。

### 2.10 /rules
- **分区**：
  - 社保规则（CityRuleSS）
  - 公积金规则（CityRuleHF）
  - 税制配置（TaxConfig + TaxBracket）
  - 年度专线扣除导入（管理员查看）
- **UI**：分 Tab 呈现；每个 Tab 含表格（按城市/年份）+ 编辑对话框。

### 2.11 /reports
- **模块**：
  - `reports/dashboard`（全局趋势）
  - `reports/income`（收入时序，复用 `IncomeAnalyticsPanel`）
  - `reports/tax`（年度税务分析）
- **数据源**：`src/lib/api/reports` 提供统一钩子。

### 2.12 /settings
- **功能**：
  - “全局偏好”分区统一维护展示币种与报表统计日期，更新后写入 `useUserPrefsStore` 并刷新关联 SWR key；其他页面只能读取这些值。
  - 基准币种更新（调用 `/api/v1/user/profile`）。
  - 工作城市切换（需设置生效日期）。
  - 年度专线扣除维护（列表 + 新增/编辑对话框）。
  - 通知偏好。
- **数据流**：全局偏好通过 `useUserPrefsStore` 管理（仅在此页面调用 setter）；保存时调用 `/api/settings`（偏好）和 `/api/v1/user/profile`（基准币种）等接口。

### 2.13 管理员工作台（待补充）
- 建议路径：`/admin/users`、`/admin/activity`。
- **/admin/users**：展示所有用户的资产、收入摘要，可触发“模拟登录”。
- **/admin/activity**：查看 AuditLog。
- 目前代码未实现此路由，需按 PRD 新增。

## 3. 通用 UI 约束
- 配色与排版遵循 Tailwind 设计系统，暗色模式通过 `next-themes` 支持。
- 表单控件统一封装在 `components/ui` 中，新增字段请优先复用 `Form`, `Input`, `Select`, `DatePicker` 模块。
- 列表页需支持分页或虚拟滚动（参考 `TopAccounts` 实现）。
- 响应式：所有主页面在 `md` 以上展示 3 列布局，`sm` 以下堆叠。
- 管理员模拟登录提示：在 `layout` 顶部注入横幅，展示当前视角用户与“退出模拟”按钮。

## 4. 数据获取与缓存策略
- 所有 API 调用位于 `src/lib/api/*`，返回值经 `fetchJSON` 封装（含错误处理）。
- SWR key：`["dashboard", params]`、`["incomeRecords", year, userId]` 等，需要在更新后调用 `mutate`。
- 人工调整、规则更新、模拟登录等动作必须显式触发相关 key 的失效，保持 UI 一致。

## 5. 待补充/风险项
- Income 子路由目前多为组件级实现，需要按上述规划补齐页面级路由或在主页面内补充对话框实现。
- 管理员工作台、新增年度扣除界面尚未存在，需要新增页面与 API。
- 导出功能（CSV/Excel）尚未实现，需要统一工具（建议放在 `src/lib/utils/export.ts`）。
- 图表在暗色模式下的配色需校对，确保可读性。
