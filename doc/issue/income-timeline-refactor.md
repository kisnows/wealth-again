# 收入视图统一改造计划

## 背景
- `/income` 页面目前通过 `IncomeAnalyticsPanel` 展示历史汇总，同时依赖 `IncomeForecastModule` 提供预测；两块模块分别调用 `/reports/income/timeseries` 与 `/income/forecast`，导致数据及 UI 结构重复。
- 头部「查看收入记录」按钮弹出的 `IncomeRecordsDialog` 与概览区块展示同一批 `IncomeRecord` 数据，存在明显冗余。
- 用户希望历史与未来收入在前端使用统一组件展示：所选区间若落在过去，即显示历史记录；若跨越未来月份，则自动补齐预测数据，并在同一张表、同一套图表中标识来源。

## 改造目标
1. **单一数据接口**：新增 `/api/v1/income/timeline`，服务端统一拼装 `IncomeRecord`（历史）与预测结果，保持累计计税逻辑一致。
2. **单一展示组件**：改造 `IncomeAnalyticsPanel`，让其成为统一时间线组件并下线 `IncomeForecastModule`。
3. **去重入口**：移除 `IncomeRecordsDialog` 及 `/income/records` 路由，头部仅保留跳转锚点与配置入口；预测与回算信息保持在 `/income` 单页聚合。
4. **一致性标注**：统一在前端标识实际数据与预测数据来源，确保用户能够快速识别不同月份的状态。

## 里程碑与任务
### 1. 服务层
- 整理预测计算逻辑到独立的 `income-timeline` 服务，补齐专项附加扣除与累计字段的对齐。
- 实现 `buildIncomeTimeline(userId, from, to)`：
  - 调用 `ensureIncomeRecordsForUser` 补齐历史。
  - 查询选区内的 `IncomeRecord`。
  - 对缺失月份调用预测服务补齐，输出统一结构（含 `taxableCurrent`、`taxableCumulative` 等字段）。
  - 汇总实际/预测/合计的统计信息。
- 暴露 `GET /api/v1/income/timeline`，返回 `{ items, summary, meta }`。

### 2. 前端
- 新建 `IncomeTimelinePanel`（或改造现有组件）读取 `/income/timeline`，提供日期区间选择、汇总卡片、堆叠图、月度表格。
- 表格中以 `source` 或标签标识预测月份，删除原 `IncomeRecordsTable` 弹窗；对账字段直接在表格内展示。
- 更新 `/income/page.tsx` 布局：移除冗余按钮与旧组件，保留维护入口与回算任务面板。

### 3. 文档与测试
- 更新 `doc/income-spec.md`/`doc/ui-routing.md` 或相关说明，描述新的统一视图和 API。
- 调整 / 新增 Vitest 用例覆盖 `buildIncomeTimeline` 行为。
- 通过 Playwright / 手动验证 `/income` 页面展示的正确性（历史与未来组合场景）。

## 验收标准
- `/income` 页面只保留一个展示组件，且在跨月区间（含未来）时正确合并历史+预测数据。
- 概览、图表、表格的数值与示例数据一致，预测月份在 UI 上有明显标记。
- 文档与测试同步更新，lint/test 构建通过。
