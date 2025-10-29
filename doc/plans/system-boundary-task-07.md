# 系统边界改造任务 07：EventOutbox 与队列平台

## 背景

系统边界规划中阶段 2 要求引入数据库 Outbox、统一的 FX Provider 与任务队列，以增强幂等性与异步处理能力。目前尚未实现 Outbox 表、队列抽象以及收入回算等长耗时任务的异步化。

## 目标

- 新增 `EventOutbox` Prisma 模型、迁移及写入方法（与业务写路径同事务落库）。
- 在 `src/server/services/jobs/` 下实现队列抽象（接口与本地 worker），并将收入重算等任务改为“登记任务 + 放队列”。
- 文档化 Outbox 消费者、重试策略与部署方式，确保可在 CI/本地复现。

## 执行步骤

1. **Schema & Migration**：编写 Prisma 模型（`id,eventType,payload,status,attempts,lastError,occurredAt,createdAt` 等），生成并提交迁移，更新 `prisma/seed.ts` 视需要填充样例。
2. **Outbox Writer**：在 `src/server/services/outbox.ts` 实现写入函数，与 `txnEntry`、`incomeRecord` 等写路径同事务调用，并补测幂等/序列号。
3. **队列抽象**：在 `src/server/services/jobs` 下提供 `queue.ts`（接口）与 `local-worker.ts`（最小实现），支持 enqueue、ack、retry；在 `package.json` 增加 worker 启动脚本。
4. **业务接入**：将 `/income/recalc`、`IncomeRecalcTask` 写路径改为“创建任务记录 → enqueue”；worker 消费后调用 `recalcIncome` 并更新任务状态。
5. **测试与文档**：新增出入站测试（Outbox 写入、worker 模拟执行），在 `doc/plans/system-boundary-task-07.md` 或 `doc/system-boundary-plan.md` 更新运行指南、监控与告警建议。

## 验收标准

- Prisma migration 可成功执行，本地/CI 运行通过。
- 核心写路径（至少 Accounts/Income）会写入 Outbox，且幂等验证通过。
- 队列 worker 在测试中可消费任务并更新状态，文档提供运行指引。
