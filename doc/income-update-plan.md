# 收入域改造方案（2025-02）

## 背景与差距

- **自动回算缺失**：现实现依赖手动触发 `/income?dialog=recalc` 或在请求时同步补算，与规范要求的“延迟合并+任务列表”不符。
- **字段命名与对账**：`IncomeRecord` 使用 `taxableIncome/taxPaid` 等字段，未对齐文档中的 `taxableCurrent/taxPaidCumulative`，UI 亦引用不存在的人工字段。
- **人工调整能力缺位**：缺乏 `manualGross/manualNet/...` 字段及覆盖逻辑，导致人工调整标记无效。
- **页面冗余**：`/reports/income` 与 `/income` 内容重复，违背单一中心的约束。

## 目标

1. 建立符合规范的自动回算流水线：输入变更→任务入队→延迟执行→状态追踪→回算完成后失效缓存。
2. 调整数据模型与服务层，保证 `IncomeRecord` 对账字段命名与文档一致，并支持人工覆盖。
3. 精简收入页面，移除冗余回算对话框，引入任务状态视图，统一使用 `IncomeAnalyticsPanel`。
4. 评估 `/reports/income`，如确实重复则移除并提供友好跳转。

## 实施计划

### 阶段一：模型与任务框架
- Prisma 中新增 `IncomeRecalcTask`（字段：id/year/monthRange/status/retryAfter/...），并为 `IncomeRecord` 补充规范字段（含人工覆盖、来源标记）。
- 封装 `scheduleIncomeRecalc`/`processPendingIncomeTasks` 服务，支持 10 分钟延迟合并，记录 AuditLog。
- 更新相关 API（工资/奖金/LTC/城市变更等）在成功写入后调用 `scheduleIncomeRecalc`。

### 阶段二：计算服务与接口调整
- `recalcIncome` 接口改为消费任务、写入新字段，区分手动覆盖与自动计算；补充 `GET /api/v1/income/recalc-tasks` 返回任务列表。
- 调整 `calculateTax` 输出以填充 `taxPaidCumulative` 等字段，确保 doc/prd-income.md 示例数据回算一致。
- 补全 Vitest 用例：任务调度、去重、PRD 示例对账字段。

### 阶段三：前端与文档
- `/income` 页面替换“年度回算”对话框为“回算任务”抽屉/面板；新增 `/income/recalc-status` 真实页面并绑定数据源。
- 移除 `/reports/income`（改为 `/reports` 内提示与跳转），检查导航避免断链。
- 更新 `/income` 时间线表格，展示人工覆盖标记与新增对账字段。
- 同步更新 `doc/income-spec.md` 中的落地路径、API 示例，以及 README/导航说明。

## 验证

- 使用文档示例（2025 年 1–3 月）跑通自动回算，校验社保、公积金、个税、净收入。
- Playwright/Chrome DevTools 打开 http://localhost:4000 验证 `/income`、`/income/recalc-status`、`/reports` 导航。
- 运行 `npm run lint`、`npm test` 及关键服务单测。

## 进度（2025-02-16）

- [x] 新增 `IncomeRecalcTask` 表与 `scheduleIncomeRecalcTask`/`processDueIncomeRecalcTasks` 服务，工资/奖金/LTC/股权 API 自动排队任务。
- [x] `IncomeRecord` 增加人工覆盖字段与 `taxableCurrent`、`taxPaidCumulative`、`source`，表格展示人工标记。
- [x] 回算任务中心并入 `/income` 主页面，保留 `/income/recalc-status` anchor 重定向，统一查看与手动回算。
- [x] `/reports/income` 改为跳转避免重复。
- [x] `/income` 页面重新编排，整合预测、回算、维护入口，移除嵌套 Tab 与冗余快捷区域。
- [ ] 后续：人工调整 API/表单补强、任务失败可视化、测试覆盖完善。
