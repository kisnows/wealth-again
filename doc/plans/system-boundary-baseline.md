# 系统边界改造基线记录（2025-02-14）

## 命令与结果

- 最新执行命令：`pnpm test`
- 结果：测试全部通过。关键动作：
  - 统一 `resetPrismaMock` 的默认返回，补齐 `taxConfig`/`taxBracket`、`incomeChange`、`userAnnualDeduction` 等常见查询，并在重置时清理税务上下文缓存。
  - 调整账户/估值相关测试，显式提供 `account.findMany` 数据、估值快照与 FX 批量补全，确保摘要与 ROI 断言稳定。
  - 更新收入/报表测试的默认数据，复用全局税务配置并补齐 `ensureFxSnapshotBatch`、`salaryChanges` 等依赖。
  - 修复入账路由写入：`deposit`/`withdraw`/`transfer` 统一使用数组 `lines.create`，并为同币种转账默认使用原金额。

> 若后续改动引入新的测试失败，可在本基线基础上比对差异，定位缺失的 mock 或断言。

## Prisma Schema 巡检

- `TxnLine`：已包含 `fxSnapshotId`, `fxAppliedRate`, `fxEffectiveAt`, `principalDelta`, `valuationDelta` 等字段，可支撑汇率快照及派生值写入。
- `IncomeRecord`：包含收入对账字段（`taxableCurrent`, `taxableCumulative`, `taxCumulative`, `taxPaidCumulative`, `netIncome`）以及 `fxSnapshotId` / `fxAppliedRate`，满足阶段改造要求。
- `FxSnapshot`：存在 `baseCurrency`, `quoteCurrency`, `rate`, `capturedAt` 字段，且与 `TxnLine`、`IncomeRecord` 建立外键关系。
- `IncomeRecalcTask`、`TaxConfig`、`TaxBracket` 等模型均已在 schema 中定义，后续 Outbox/Queue 改造可直接复用。

## 备注

- 阶段 1（服务目录化、FX 写路径补齐）已完成；Task-04/05 已收官，可转入 Task-06（API 命名空间收敛）。
- 新增 Task-06/07/08 等，用于后续 API 路由命名空间重构、Outbox/队列建设与 Reporting/Audit 完善。
- 文档更新：`doc/plans/system-boundary-task-01.md`～`05.md` 描述已完成及在途任务；当前基线已刷新为“测试全绿”。
