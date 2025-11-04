# 系统边界规划 (`system-boundary-plan.md`) 符合度分析

本文件用于追踪当前代码实现与系统边界规划的符合度。

## 1. 服务层目录结构 (阶段 1)

- [x] `src/server/services/accounts-ledger/` 目录已创建并包含相关服务。
- [x] `src/server/services/income-tax/` 目录已创建并包含相关服务。
- [x] `src/server/services/fx/` 目录已创建并包含相关服务。
- [x] `src/server/services/reporting/` 目录已创建。
- [x] `src/server/services/audit/` 目录已创建。
- [x] `src/server/services/jobs/` 目录已创建。

## 2. 核心契约与模式 (阶段 2)

- [ ] **EventOutbox 模式**:
    - [x] `EventOutbox` Prisma 模型已定义。
    - [x] 核心写操作通过同一事务写入 Outbox。
- [ ] **幂等性**:
    - [x] 关键写操作 API 支持 `Idempotency-Key` header。
- [ ] **FX 快照**:
    - [x] 核心业务实体 (`TxnLine`, `IncomeRecord`) 在写入时保存 `fxSnapshotId`。

## 3. 异步任务 (阶段 2)

- [ ] **收入回算**:
    - [x] `IncomeRecalcTask` 机制存在。
    - [x] 收入回算通过异步 worker 执行。
