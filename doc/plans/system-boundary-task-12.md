# 系统边界改造任务 12：前端架构与界面体验重构方案

后端已按 Identity、Accounts & Ledger、Income & Tax、Reporting、FX 等子系统完成拆分。前端需同步升级，使工程结构与 UI/交互对齐新边界，保证整体体验现代、简洁、高效、专业。

## 1. 工程结构与数据访问

1. **目录分层**
   - `src/app`：保留页面路由，但仅负责布局与组合组件。
   - `src/components/modules/<subsystem>`：子系统级模块（Identity、Accounts、Income、Reporting、FX）。
   - `src/lib/api/<subsystem>.ts`：SWR + 请求封装，统一从 `doc/openapi.json` 生成的类型中获取契约。
   - `src/lib/state/<subsystem>.ts`：Zustand store 管理局部状态/偏好。
2. **API 与类型**
   - 使用 OpenAPI 契约自动生成 TypeScript 类型（`pnpm dlx openapi-typescript doc/openapi.json -o src/types/openapi.ts`）。
   - 所有请求通过 `fetchJson`/`mutation` util，提供 `notifyAsync`（loading/success/error）包装，保证交互一致。
3. **异步策略**
   - 报表数据先读 `ReportDataset` 缓存，缺失再 fallback 实时 API。
   - 后台任务（income recalc、导出）全走队列；页面侧不再期待同步数据，统一提示“任务已入队”并指向任务中心。

## 2. 页面设计与交互

### 2.1 顶层导航

| 导航 | 描述 | 设计要点 |
| --- | --- | --- |
| Dashboard | 全局概览 | 卡片式 KPI + 净资产趋势 + 最近任务/事件，提供刷新与导出快捷入口 |
| Accounts | 账户列表/详情 | 分资产/负债分组，详情页含交易、估值、事件 tabs；右、下角提供“新增”浮动按钮 |
| Income | 收入中心 | 左侧时间线/分项图，右侧任务队列与回算触点，配置入口模块化 |
| Reporting | 报表数据集 | 列表展示 `ReportDataset` 状态，支持手动刷新与导出 |
| Settings | 个人设置 | 卡片布局管理展示偏好、城市变更、专项扣除、通知偏好，清晰提示后台任务 |
| Activity | 任务中心 | 统一查看队列任务、Outbox、审计日志，支持管理员重试/导出 |
| Identity (管理员) | 用户管理 | 列表 + 详情抽屉，可模拟登录，操作前强提醒与审计说明 |

### 2.2 关键页面

#### Dashboard
- 顶部 Summary Bar：资产/负债/净资产/最近同步时间 + `刷新` 按钮（实际调用刷新 dataset）。
- 中区：
  - 净资产折线图（支持时间范围切换）。
  - “近期事件”时间线（取 Outbox/Audit 最新记录）。
- 底部 CTA：引导“检查账户”“查看收入任务”“管理设置”。

#### Accounts
- 列表：卡片或表格切换，支持类型/状态筛选，显示估值、收益、最新更新。
- 详情 Tabs：
  - Overview：关键数字 + 最近交易 + 小型趋势图。
  - Transactions：表格 + 筛选 + 导出，顶部按钮 `新增/导入`。
  - Valuations：时间线 + 手动估值入口。
  - Events：列出相关 Outbox 事件、审计记录。

#### Income
- Header：当年累计 Gross/Net/Tax + “回算任务状态”提示条（展示队列最新状态）。
- Main 区域：`IncomeAnalyticsPanel`（堆叠柱状/折线按来源切换）。
- Side 区域：
  - `IncomeRecalcTaskBoard`：状态标签 + 刷新按钮，失败任务提供“重试”快捷入口（管理员）。
  - `手动回算`卡片：表单 + 执行说明 + 入队提示。
  - 快速入口卡片：工资变更、专项扣除等设置链接。

#### Settings
- 卡片式布局：
  1. 展示偏好（展示币种、通知）；
  2. 城市变更（当前城市 + 历史时间线 + 新增表单）；
  3. 年度专项扣除（表格 + 新增/编辑弹窗，说明“按月均摊”）；
  4. 数据导出（触发后台任务 + 任务中心提示）。
- 顶部说明条：所有设置即时生效，部分动作需后台处理，并提供快速跳转到 Activity。

#### Reporting
- `ReportDataset` 列表：按 scope/bucket 展示缓存状态、更新时间、来源任务；支持手动刷新和导出。
- 详情面板：可视化 payload 结构，帮助排查数据同步问题。

#### Activity
- Tabs：`回算任务` | `EventOutbox` | `Audit Log`。
- 回算任务：状态过滤、重试、查看详情；与 Income 页交叉链接。
- EventOutbox：按事件类型分组，支持搜索 payload。
- Audit Log：时间线样式，关键操作醒目标识，点击查看元数据。

### 2.3 交互准则

- 所有异步操作通过 `notifyAsync` 统一提示：开始 → 成功（含任务号）→ 失败（建议重试/联系提示）。
- 列表空态提供占位图和引导 CTA，例如“暂无任务，完成设置后可自动生成”。
- 关键指标旁展示数据来源（实时 vs 缓存），并提供刷新/查看任务按钮。
- 表格操作区简化：常用操作放主按钮，次要操作收在 `More` 菜单。

## 3. 状态管理与通知

1. 扩展 `useUserPrefsStore`：新增 `pendingTasks`、`lastDataSyncAt`，用于跨页面展示状态。
2. 新建 `useTaskCenterStore`：统一记录 Income、Export 等后台任务状态，便于 Dashboard/Activity 访问。
3. 建立 `useLiveStatus` hook：订阅队列任务变更（轮询或 SSE 预留），实时更新提示条。

## 4. 测试与文档

- 编写 React Testing Library 测试覆盖：
  - Settings 卡片交互（展示币种、城市变更、专项扣除）。
  - Income 页面回算入队 → 任务列表刷新。
  - Accounts 详情 tabs 切换与空态。
- 更新 `doc/frontend-spec.md`：记录新导航结构、组件职责、异步提示流程。
- 在 PR 模板中添加检查项：“是否更新 openapi 类型”“是否覆盖异步提示体验”。

## 5. 验收标准

- 导航与页面结构完整，对应后端子系统，用户便于定位操作。
- 信息单一入口、无重复展示；所有后台任务在 UI 中可见并可追踪。
- “异步提示 + 任务中心”流程一致，用户知道任务状态。
- `npm test`、UI 测试全部通过，实际演示中设置、收入、账户等页无报错、交互顺畅。
