# 系统边界改造基线记录（2025-02-14）

## 命令与结果

- 最新执行命令：`pnpm test`
- 结果：测试仍失败。主要剩余问题：
  - **收入域/报表测试**：`taxConfig.findFirst`、`user.findMany` 等 mock 返回缺失，触发 `user_not_found` 或税额断言不符（已归档至 Task-05）。
  - **帐本/估值路由**：部分测试未准备 `account.findMany` 数据，导致 `accounts.length` 访问报错，或 Meta JSON 与新字段不匹配。
  - **FX 服务**：`convert` 仍可能抛出 `fx_snapshot_not_created`，需在测试中补充 `fxSnapshot` mock。
  - **Rules 路由**：旧断言仍按历史响应检查，需要结合新 mock 结构更新。

> 以上失败均来自已有测试对 Prisma mock 的覆盖不足；功能代码尚未验证是否存在回归，需在后续任务中逐一修正测试隔离逻辑。

## Prisma Schema 巡检

- `TxnLine`：已包含 `fxSnapshotId`, `fxAppliedRate`, `fxEffectiveAt`, `principalDelta`, `valuationDelta` 等字段，可支撑汇率快照及派生值写入。
- `IncomeRecord`：包含收入对账字段（`taxableCurrent`, `taxableCumulative`, `taxCumulative`, `taxPaidCumulative`, `netIncome`）以及 `fxSnapshotId` / `fxAppliedRate`，满足阶段改造要求。
- `FxSnapshot`：存在 `baseCurrency`, `quoteCurrency`, `rate`, `capturedAt` 字段，且与 `TxnLine`、`IncomeRecord` 建立外键关系。
- `IncomeRecalcTask`、`TaxConfig`、`TaxBracket` 等模型均已在 schema 中定义，后续 Outbox/Queue 改造可直接复用。

## 备注

- 阶段 1（服务目录化、FX 写路径补齐）已完成；当前正在执行 Task-05，聚焦于测试基线修复。
- 新增 Task-06/07/08 等，用于后续 API 路由命名空间重构、Outbox/队列建设与 Reporting/Audit 完善。
- 文档更新：`doc/plans/system-boundary-task-01.md`～`05.md` 描述已完成及在途任务，本记录将随下一次 `pnpm test` 全绿后同步刷新。
