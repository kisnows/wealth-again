# 前端技术规格与页面规划

> **文档状态：已整合**
> 本文档是前端开发的唯一事实来源，整合了技术约束、架构设计、路由规划与页面模块说明，替代了 `frontend-constraints.md` 和 `ui-routing.md`。

## 1. 核心架构与技术约束

- **组件库**: 仅使用 **shadcn/ui**。新增组件使用 `pnpm dlx shadcn@latest add <component>`。
- **样式**: 仅使用 **Tailwind CSS**。禁止引入其它样式方案。
- **数据请求**: 统一使用 **SWR**。所有 API 调用必须通过 `src/lib/api/*` 暴露的钩子或函数，禁止在页面内零散请求。
- **状态管理**: 跨页面/跨模块共享的非服务端状态（如 UI 偏好）使用 **Zustand** (`src/lib/state/*`)。
- **逻辑分层**: UI 只负责展示与交互；业务逻辑、数据加工、校验、纯计算函数置于 `src/lib/domain/*` 或 `src/lib/services/*`。
- **体积约束**: 单个组件文件不超过 500 行。鼓励将复用 UI 抽象为业务模块组件。
- **表单处理**: 使用 **`react-hook-form` + `zod`** 进行表单状态管理和校验。
- **异步提示**: 写操作统一通过 `notifyAsync` 包装，配合 `mutation` 工具发送请求并自动输出 loading/success/error 提示。

## 2. 目录结构

- `src/app/*`: App Router 路由与页面壳（优先使用 Server Component 组织布局）。
- `components/ui/*`: shadcn/ui 原始组件。
- `components/modules/<subsystem>`: 子系统维度的业务模块（如 `components/modules/accounts`, `income`, `identity`, `reporting`, `fx`, `layout`），便于和后端系统边界对齐。
- `src/lib/api/*`: 接口层与 SWR hooks（按领域划分，如 `accounts.ts`, `income.ts`）。
- `src/lib/state/*`: Zustand 全局状态存储。
- `src/lib/hooks/*`: 客户端专用的公共 hook（例如 `useLiveStatus` 订阅后台任务状态）。
- `src/lib/domain/*`: 纯业务逻辑函数（如金额格式化、校验规则）。
- `src/lib/services/*`: 前端组合服务，编排多接口或多步骤流程。
- `src/lib/utils/*`: 通用工具函数（如 `fetcher.ts`, `idempotency.ts`）。

## 3. 路由树与页面规划

### 3.1 路由概览
```
/app
├─ layout.tsx                 # 全局导航、主题、会话守卫
├─ page.tsx                   # 重定向 → /dashboard
├─ signin/page.tsx            # 登录页
├─ dashboard/page.tsx         # 财务总览
├─ income/                    # 收入管理中心
│   ├─ page.tsx               # 整合了概览、录入、图表分析与预测
│   └─ recalc-status/page.tsx # (新增) 自动化回算任务状态监控
├─ accounts/page.tsx          # 账户列表
├─ accounts/[id]/page.tsx     # 账户详情（Tabs）
├─ entries/                   # 交易流水录入（存入/取出/转账）
├─ rules/page.tsx             # 城市社保、公积金、税务配置
├─ reporting/page.tsx         # ReportDataset 缓存视图与导出入口
├─ activity/page.tsx          # 任务中心（回算任务、Outbox、Audit）
└─ admin/users/page.tsx       # 管理员用户管理（Identity 子系统）
└─ settings/page.tsx          # 用户设置（币种、城市、年度扣除）
```

### 3.2 页面与核心组件说明

- **/dashboard**: 呈现资产、负债、净资产、收入等关键指标。主要组件包括 `NetWorthLine`, `AllocPie`, `TopAccounts` 和 `IncomeSummaryCard`。

- **/income**: 收入管理中心，以分区方式呈现：
  - **核心配置入口**：页面顶部以紧凑分组呈现工资、奖金、长期现金与税务入口，避免重复按钮并保留快速操作。
  - **收入时间线**：`IncomeAnalyticsPanel` 统一展示历史与预测的汇总、图表与月度表格，数据源为 `/api/v1/income-tax/timeline`。
  - **回算任务中心**：`IncomeRecalcTaskBoard` 实时展示/触发回算任务（`/income/recalc-status` 指向该锚点），配合即时回算表单。任务状态由 `useLiveStatus` 订阅后台变更并写入 `useUserPrefsStore`、`useTaskCenterStore`。

- **/accounts**: 账户列表页。
  - 顶部包含操作按钮（新增账户、转账、估值），并提供跳转以管理全局设置。
  - 汇总卡片下方新增 `AccountsSummaryTable`，用于以表格方式快速对比本金、估值、收益与 ROI。
  - `AccountTable` 展示各账户详情，底部有资产汇总卡片。
- **/accounts/[id]**: 账户详情页，Tabs 包含概览、交易、估值、事件，所有操作按钮靠右展示并与报表组件组合。

- **/entries**: 交易录入模块，通过对话框或独立页面实现。
  - `DepositDialog`, `WithdrawDialog`, `TransferDialog` 复用同一表单组件。

- **/rules**: 规则配置中心。
  - 使用 Tabs 分隔社保 (`CityRuleSS`)、公积金 (`CityRuleHF`) 和税制 (`TaxConfig`) 的管理界面。
  - 每个 Tab 内含规则表格和用于新增/编辑的 `RulesUpsertForm`。

- **/settings**: 用户个人与全局设置中心。
  - **展示偏好**: 统一维护展示币种、统计日期等，通过 `useUserPrefsStore` 管理。
  - **基础设置**: 管理基准币种、工作城市等。
  - **汇率维护**: 使用 `AccountFxPanel` 维护涉及币种的 USD 中间价，更新后自动刷新账户估值。
  - **年度专项扣除**: 维护个人年度专项附加扣除额。
  - 所有重要卡片均提供 `data-testid`，方便回归测试与自动化收集。

- **/reporting**: 展示 `ReportDataset` 缓存状态，支持手动刷新、导出（预留）与 payload 快速预览。

- **/activity**: 任务中心，使用 Tabs 展示回算任务、EventOutbox、AuditLog。通过 `useTaskCenterStore` 聚合后台任务摘要，更新入口与收入页保持一致。

- **/admin/users**: 管理员用户管理，展示全量用户列表并预留模拟登录、审计提示区域。

## 4. 数据获取与状态管理

- **SWR**: 作为数据请求和缓存的核心。API 请求统一封装在 `src/lib/api/*` 中，通过 `useSWR(key, fetcher)` 的形式消费。
  - **Key 策略**: 使用数组形式，如 `["dashboard", params]`, `["incomeRecords", year, userId]`。
  - **写操作**: 封装为独立的 async 函数（如 `createAccount()`），成功后调用 `mutate` 来刷新相关的 SWR key。
- **Zustand**: 仅用于管理与服务端数据无直接关联的全局客户端状态。
  - `useUserPrefsStore`: `displayCurrency`, `asOfDate` 等 UI 偏好。
    - 扩展字段 `pendingTasks`, `lastDataSyncAt` 统一本地显示任务状态、数据刷新时间。
  - `useTaskCenterStore`: 聚合后台任务（回算、导出、Outbox、Audit）以便 Dashboard/Activity/Income 等页面统一访问。
  - `useDialogStore`: 全局共享的对话框开关状态（如全局转账弹窗）。
- **Hooks**:
  - `useLiveStatus`: 轮询回算任务队列，并联动 `useUserPrefsStore` 与 `useTaskCenterStore`，保证客户端顶部状态与 Activity 页同步。

## 5. 通用 UI 约束

- **响应式**: 所有主页面在 `md` 以上断点展示多列布局，`sm` 以下堆叠。
- **管理员模式**: 模拟登录时，在全局 `layout` 顶部注入一个横幅，显示当前视角用户和“退出”按钮。
- **导出功能**: 待实现，建议统一放在 `src/lib/utils/export.ts` 中。

## 6. 导航与异步提示规范

- 顶层导航顺序：Dashboard / Accounts / Income / Reporting / Settings / Activity，管理员加挂 Identity。
- 所有动作按钮必须挂载 `data-testid="领域-UI-描述"`。
- 长时任务（回算、导出等）必须展示 `notifyAsync` 提示，成功态需附任务编号或刷新指引。
