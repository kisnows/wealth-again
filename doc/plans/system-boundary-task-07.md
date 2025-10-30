# 系统边界改造任务 07：EventOutbox 与队列平台

## 背景

系统边界规划中阶段 2 要求引入数据库 Outbox、统一的 FX Provider 与任务队列，以增强幂等性与异步处理能力。目前尚未实现 Outbox 表、队列抽象以及收入回算等长耗时任务的异步化。

## 目标

- 新增 `EventOutbox` Prisma 模型、迁移及写入方法（与业务写路径同事务落库）。
- 在 `src/server/services/jobs/` 下实现队列抽象（接口与本地 worker），并将收入重算等任务改为“登记任务 + 放队列”。
- 文档化 Outbox 消费者、重试策略与部署方式，确保可在 CI/本地复现。

## 执行步骤

1. **Schema & Migration**：编写 Prisma 模型（`id,eventType,payload,status,attempts,lastError,occurredAt,createdAt,availableAt` 等），生成并提交迁移，更新 `prisma/seed.ts` 视需要填充样例。
2. **Outbox Writer**：在 `src/server/services/outbox.ts` 实现写入函数，与 `txnEntry`、`incomeRecord` 等写路径同事务调用，并补测幂等/序列号与重复事件的排重策略。
3. **队列抽象**：在 `src/server/services/jobs` 下提供 `queue.ts`（接口）与 `local-worker.ts`（最小实现），支持 enqueue、ack、retry；在 `package.json` 增加 worker 启动脚本。
4. **业务接入**：将 `/income-tax/recalc`、`IncomeRecalcTask` 写路径改为“创建任务记录 → enqueue”；账户写路径（存取款/转账/估值）在事务内写出 `ledger.entry.created` 等事件。worker 消费后调用 `recalcIncome` 并更新任务状态，同时写回 Outbox 状态。
5. **测试与文档**：新增出入站测试（Outbox 写入、worker 模拟执行、收入回算任务状态流转），在 `doc/plans/system-boundary-task-07.md` 或 `doc/system-boundary-plan.md` 更新运行指南、监控与告警建议。

### 事件规划（初版）

| 事件类型 | 触发场景 | 载荷要点 |
| --- | --- | --- |
| `ledger.entry.created` | 账户存入/支出/转账/估值写入后 | `entryId`, `userId`, `accountIds`, `occurredAt`, `amount`, `currency` |
| `ledger.valuation.created` | 手动估值写入 | `valuationId`, `accountId`, `asOf`, `totalValue`, `currency` |
| `income.recalc.requested` | 调用 `/income-tax/recalc` 或城市迁移触发回算 | `taskId`, `userId`, `taxYear`, `startMonth`, `endMonth`, `cityId` |
| `income.recalc.completed` | worker 成功执行回算 | `taskId`, `updated`, `status`, `processedAt` |
| `income.record.updated` | `recalcIncome` 写入 `IncomeRecord` 时 | `userId`, `monthDate`, `recordId`, `netIncome`, `taxPaidCumulative` |

> 以上事件均要求在业务写入的同一事务内落入 `EventOutbox`，以便后续消费者（如报表物化视图、审计同步）可靠消费。

## 运行指引与联调说明

- `/api/v1/income-tax/recalc` 接口现以异步排队形式返回 `202`，响应体包含 `taskId` 与当前状态，前端通过回算任务看板轮询结果。
- 本地或 CI 环境下需额外启动 `npm run worker`，worker 将轮询 `IncomeRecalcTask` 与 `EventOutbox` 并调用领域服务消费任务；默认 5 秒一次，可通过 `runWorkerIteration` 注入自定义间隔。
- Worker 执行成功会写回 `income.recalc.completed` 事件，失败则写入 `income.recalc.failed` 并重置 `availableAt`，可用于后续补偿。
- Vitest 用例通过直接调用 `processDueIncomeRecalcTasks` 验证“入队 → worker → Outbox”流程，并结合 PRD 示例数据对累计预扣金额与社保/公积金数值做回归。

## 验收标准

- Prisma migration 可成功执行，本地/CI 运行通过。
- 核心写路径（至少 Accounts/Income）会写入 Outbox，且幂等验证通过。
- 队列 worker 在测试中可消费任务并更新状态，文档提供运行指引。
