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

## 2. 目录结构

- `src/app/*`: App Router 路由与页面壳（优先使用 Server Component 组织布局）。
- `components/ui/*`: shadcn/ui 原始组件。
- `components/modules/*`: 可复用的业务 UI 模块（如 `AccountTable`, `TransferDialog`, `IncomeForms`）。
- `src/lib/api/*`: 接口层与 SWR hooks（按领域划分，如 `accounts.ts`, `income.ts`）。
- `src/lib/state/*`: Zustand 全局状态存储。
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
├─ entries/                   # 交易流水录入（存入/取出/转账）
├─ rules/page.tsx             # 城市社保、公积金、税务配置
└─ settings/page.tsx          # 用户设置（币种、城市、年度扣除）
```

### 3.2 页面与核心组件说明

- **/dashboard**: 呈现资产、负债、净资产、收入等关键指标。主要组件包括 `NetWorthLine`, `AllocPie`, `TopAccounts` 和 `IncomeSummaryCard`。

- **/income**: 收入管理中心，以分区方式呈现：
  - **核心配置入口**：页面顶部以紧凑分组呈现工资、奖金、长期现金与税务入口，避免重复按钮并保留快速操作。
  - **收入时间线**：`IncomeAnalyticsPanel` 统一展示历史与预测的汇总、图表与月度表格，数据源为 `/api/v1/income/timeline`。
  - **回算任务中心**：`IncomeRecalcTaskBoard` 实时展示/触发回算任务（`/income/recalc-status` 指向该锚点），配合即时回算表单。

- **/accounts**: 账户列表页。
  - 顶部包含操作按钮（新增账户）和汇率面板 (`AccountFxPanel`)。
  - `AccountTable` 展示各账户详情，底部有资产汇总卡片。

- **/entries**: 交易录入模块，通过对话框或独立页面实现。
  - `DepositDialog`, `WithdrawDialog`, `TransferDialog` 复用同一表单组件。

- **/rules**: 规则配置中心。
  - 使用 Tabs 分隔社保 (`CityRuleSS`)、公积金 (`CityRuleHF`) 和税制 (`TaxConfig`) 的管理界面。
  - 每个 Tab 内含规则表格和用于新增/编辑的 `RulesUpsertForm`。

- **/settings**: 用户个人设置。
  - **全局偏好**: 统一维护展示币种、报表统计日期等，通过 `useUserPrefsStore` 管理。
  - **个人信息**: 管理基准币种、工作城市等。
  - **年度专线扣除**: 维护个人年度专项附加扣除额。

## 4. 数据获取与状态管理

- **SWR**: 作为数据请求和缓存的核心。API 请求统一封装在 `src/lib/api/*` 中，通过 `useSWR(key, fetcher)` 的形式消费。
  - **Key 策略**: 使用数组形式，如 `["dashboard", params]`, `["incomeRecords", year, userId]`。
  - **写操作**: 封装为独立的 async 函数（如 `createAccount()`），成功后调用 `mutate` 来刷新相关的 SWR key。
- **Zustand**: 仅用于管理与服务端数据无直接关联的全局客户端状态。
  - `useUserPrefsStore`: `displayCurrency`, `asOfDate` 等 UI 偏好。
  - `useDialogStore`: 全局共享的对话框开关状态（如全局转账弹窗）。

## 5. 通用 UI 约束

- **响应式**: 所有主页面在 `md` 以上断点展示多列布局，`sm` 以下堆叠。
- **管理员模式**: 模拟登录时，在全局 `layout` 顶部注入一个横幅，显示当前视角用户和“退出”按钮。
- **导出功能**: 待实现，建议统一放在 `src/lib/utils/export.ts` 中。
