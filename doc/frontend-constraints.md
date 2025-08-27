# 前端实现约束与架构设计

本文件约束本仓库前端实现方式，并给出代码组织与落地思路，确保架构合理、设计优雅、实现可读、易于测试与复用。

## 基本约束（强制）
- 组件库：仅使用 shadcn/ui；`components/ui` 下只放 shadcn 组件；新增组件使用 `pnpm dlx shadcn@latest add <component>`。
- 样式：仅使用 Tailwind CSS；禁止引入其它样式方案。
- 数据请求：统一使用 SWR（https://swr.vercel.app/zh-CN）。如页面不便使用 SWR，也必须统一通过 `src/lib/api/*` 暴露方法，禁止在页面内零散请求。
- 状态管理：跨页面/跨模块共享的状态使用 Zustand（`src/lib/state/*`）。
- 逻辑分层：UI 只负责展示与交互；业务逻辑、数据加工、校验、纯计算函数放至 `src/lib/domain/*` 或 `src/lib/services/*`；UI 组件不得直接耦合复杂业务逻辑。
- 体积约束：单个组件文件不超过 500 行；鼓励将复用 UI 抽象为业务模块组件，放在 `components/modules/*`。

## 目录结构（建议）
- `src/app/*`：App Router 路由与页面壳（尽量用 Server Component 组织布局与骨架）。
- `components/ui/*`：shadcn 组件（Button、Input、Dialog、Tabs、Table、Form、Sonner 等）。
- `components/modules/*`：复用业务 UI 模块（如 `AccountTable/`、`TransferDialog/`、`IncomeForms/`、`RuleUpsertForm/`、`Charts/`）。
- `src/lib/api/*`：接口层与 SWR hooks（每个子域一个文件，如 `accounts.ts`、`income.ts`、`rules.ts`、`reports.ts`、`fx.ts`）。
- `src/lib/state/*`：Zustand store（全局过滤条件、显示币种、默认城市、对话框全局开关等）。
- `src/lib/domain/*`：纯函数（金额/币种格式化、净资产口径折算、税务计算桥接、区间校验等）。
- `src/lib/services/*`：前端组合服务（将多接口/多步骤流程编排为可测试的函数）。
- `src/lib/utils/*`：通用工具（`fetcher.ts`、`idempotency.ts`、`date.ts`、`zod-schemas.ts`）。

## 接口与 SWR 组织
- 统一 `fetcher`：`src/lib/utils/fetcher.ts` 提供带错误处理/JSON 解析/`Idempotency-Key` 注入的 `fetchJson`；SWR 使用 `useSWR(key, fetcher)`。
- 域文件划分（示例）：
  - `src/lib/api/accounts.ts`：`useAccounts()`、`useAccountSummary(id)`、`createAccount()`、`archiveAccount()`、`postDeposit()`、`postWithdraw()`、`postTransfer()`、`postValuation()`。
  - `src/lib/api/income.ts`：工资/奖金/LTC/股权 CRUD 与生成、`useIncomeRecords(range)`、`postIncomeRecalc()`。
  - `src/lib/api/rules.ts`：城市/社保/公积金/税制/税率的查询与 upsert。
  - `src/lib/api/reports.ts`：Dashboard、账户汇总、收入时序。
  - `src/lib/api/fx.ts`：`getFxRate(on)`（如需）。
- 写操作默认通过函数导出（返回 Promise），读操作优先 SWR hooks 暴露；页面与模块仅消费这些方法/钩子。

## Zustand 放什么
- `useUserPrefsStore`：`displayCurrency`、`currentCity`、`asOfDate`、表格密度等 UI 偏好。
- `useDialogStore`：跨页共享的对话框开关与上下文（如全局“跨币种转账”弹窗）。
- `useSelectionStore`：列表选中项、批量操作上下文。
- 业务缓存不与接口缓存混用：数据列表仍由 SWR 缓存；Zustand 只放“控制状态/过滤条件/UI 偏好”。

## 业务逻辑抽离（可测试）
- 放至 `src/lib/domain/*` 的纯函数示例：
  - `formatMoney(value,currency)`、`calcROI(principal,valuation)`、`netWorthAllocations(accounts)`。
  - `inferTransferToAmount(fromAmt, fromCcy, toCcy, fxRate)`、`validateNoOverlap(intervals)`。
  - `monthRange(from,to)`、`toMonthKey(date)` 等日期工具。
- 对应单元测试位于 `src/tests/*.test.ts`，新增函数需补测试。

## 组件拆分与复用
- 页面壳在 `src/app/.../page.tsx`：布局、Suspense 边界与模块组合。
- 复用模块示例（放 `components/modules`）：
  - `AccountTable`、`AccountSummaryCards`、`TransferDialog`、`ValuationFormDialog`。
  - `IncomeForms`（`SalaryChangeForm`、`BonusForm`、`LTCPlanForm`、`EquityGrantForm`、`VestFairValueForm`）。
  - `RulesUpsertForm`（支持批量 JSON 粘贴导入）。
  - `Charts/NetWorthLine`、`Charts/AllocPie`、`Charts/IncomeStackedBar`（基于 SVG/Canvas 封装，样式用 Tailwind）。
- 表单：`react-hook-form + zod`；提交统一走 `lib/api/*`，写操作自动附带 `Idempotency-Key`。

## 页面设计落地（对齐 API）
- `/dashboard`：用 `useSWR` 拉取 `reports.dashboard`；展示 KPI 卡、曲线与占比；支持 `displayCurrency/asOf` 切换（Zustand 绑定）。
- `/accounts` 与 `/accounts/[id]`：列表 + 行内操作；详情页展示 `summary` 与快捷动作（存/取/转/估）。
- `/income/*`：各子页为“列表 + 新建对话框 + 生成/回填动作”；`/recalc` 为参数表单 + 执行结果反馈。
- `/rules/*`：配置表单/表格与区间校验提示；提交走 upsert 接口。
- `/reports/*`：账户汇总、收入时序图表与导出入口。

## 性能与可维护性
- Server Component 负责布局与首屏骨架，数据区块用 Client Component + SWR；提交后用 `mutate` 做增量刷新。
- 文件上限 500 行，超出即拆分；跨页复用组件沉淀至 `components/modules`。
- 严格类型：API 方法与 hooks 全部显式返回类型；公共 DTO 放 `src/lib/models/*`。

