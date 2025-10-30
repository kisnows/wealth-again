# 系统边界改造任务 08：Reporting & Audit 完善

## 完成内容概览

- 增加 `ReportDataset` Prisma 模型及迁移，支持用户维度的报表物化存储（`scope`+`bucket` 唯一）。
- 在 `src/server/services/reporting/` 下实现数据集写入器与 `outbox-consumer.ts`，消费账本与收入相关的 Outbox 事件并刷新报表缓存。
- 更新队列 worker（`src/server/services/jobs/local-worker.ts`）在处理 Outbox 时调用报表消费者，并保留失败重试逻辑。
- 报表 API（`/api/v1/reporting/*`）默认读取 `ReportDataset`，在缺失或请求指定展示币种时回退至实时聚合。
- 审计服务重构为 `audit` 对象，提供 `audit.log` / `audit.logAndEmit`，支持在日志落库时可选写出审计 Outbox 事件；收入回算接口现使用 `audit.logAndEmit`。

## 数据与服务设计

### ReportDataset
- Prisma 模型：`id`, `userId`, `scope`, `bucket`, `payload`, `occurredAt`, `createdAt`, `updatedAt`，并对 `userId+scope+bucket` 做唯一约束。
- 新增迁移 `20251101090000_add_report_dataset` 负责建表与索引；`userId` 外键删除时级联清理缓存。

### 报表刷新流程
- `refreshAccountsSummaryDataset`：复用 `computeAccountsSummary` 计算账户/估值汇总，将结果分别写入 `accounts.summary` 与 `dashboard.overview` 数据集。
- `refreshIncomeReportingDataset`：拉取全部 `IncomeRecord`，归一化每月指标（含税前/后、社保、公积金等），写入 `income.monthly`。
- `consumeReportingEvent`：根据事件类型路由至对应刷新函数，`ledger.entry.created` / `ledger.valuation.created` 刷新账户，`income.record.updated` / `income.recalc.completed` 刷新收入；缺失用户标记为失败以触发重试。
- Worker 迭代时依次调用收入任务处理 → 报表消费者 → 标记事件送达，未覆盖事件会记录 reason 并跳过。

### 报表 API
- `/reporting/accounts/summary`、`/reporting/dashboard` 在未指定 `displayCurrency` 时优先返回缓存 payload；若缓存缺失则即时刷新并落库。
- `/reporting/income/timeseries` 使用缓存 `income.monthly` 中的数据过滤指定时间范围并生成序列/汇总；带 `displayCurrency` 请求时继续使用实时 `buildIncomeTimeline`。

### 审计接口
- 新增 `src/server/services/audit/index.ts` 暴露 `audit` 与 `logAudit`，内部统一序列化元数据并支持可选的 Outbox 事件写出。
- `/income-tax/recalc` 等敏感路径改用 `audit.logAndEmit` 记录审计日志并发送 `audit.income.recalc_enqueued` 事件。

## 运行与监控指引

1. **本地/CI Worker**：执行 `npm run worker`（已更新脚本）即可同时处理收入回算与报表消费。日志包含 `consumed/ skipped`，失败事件会调用 `markOutboxEventFailed` 并推迟重试。
2. **回放/补偿**：若需要重放，可手动将 `EventOutbox.status` 置为 `PENDING` 并调整 `availableAt`，worker 会在下一轮消费；`ReportDataset` 支持幂等覆盖，不需额外清理。
3. **监控建议**：
   - 统计 `EventOutbox` 中 `status=FAILED` 的数量与 `attempts` 递增情况。
   - 通过 `ReportDataset.updatedAt` 差值监控报表延迟，必要时增加 worker 并发或拉长批量大小。
   - 审计事件统一写到 Outbox，可在日志平台按 `eventType` 聚合告警。

## 测试覆盖

- 新增 `src/tests/reporting.outbox-consumer.test.ts` 验证消费者对账本/收入事件的调用路径。
- `reports.api.test.ts` 增补缓存命中用例，`reports.routes.test.ts`、`income.*` 系列测试已适配新的审计与数据集接口。

## 后续关注

- 若需多展示币种缓存，可扩展 `bucket` 命名（如 `display:CNY`），并在 Outbox 事件里批量刷新。
- 报表 allocations / timeseries 目前使用占位符，待引入资产配置与时间序列物化后补足。
- 审计事件的消费链路尚未落地，可在后续任务中引入审计专用消费者或对接 SIEM。
