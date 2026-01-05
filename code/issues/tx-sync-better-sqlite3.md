## Stage 1: 问题定位与影响面确认
**Goal**: 确认 `better-sqlite3`（Drizzle sync driver）下 `db.transaction(async () => …)` 会触发 `Transaction function cannot return a promise`，并找出全仓库受影响点。
**Success Criteria**: 在 `src/` 中找出所有 `transaction(async` 用法，并确认至少包含 income、ledger、jobs、fx、相关 API routes。
**Tests**: `pnpm test src/tests/auth.config.test.ts`（快速 sanity，用于确保测试环境可跑）
**Status**: Complete

## Stage 2: 事务回调改为同步执行（.get/.all/.run）
**Goal**: 将所有 `transaction(async (tx)=>...)` 改为同步回调，并在事务内部使用 drizzle 的同步执行 API：`.get()`/`.all()`/`.run()`。
**Success Criteria**: 开发环境不再出现 `Transaction function cannot return a promise`；相关 API 不再 500。
**Tests**:
- `pnpm test src/tests/income.service.test.ts src/tests/income.api.test.ts`
- `pnpm test src/tests/accounts.service.test.ts src/tests/ledger.routes.test.ts`
**Status**: In Progress

## Stage 3: Outbox + Fx overlap 稳定性修复
**Goal**: 事务内写 outbox 改为同步写入；FX 写入出现 `FxRateOverlapError` 时不产生 unhandledRejection（幂等/降级处理）。
**Success Criteria**: 本地 worker 不再打印 `unhandledRejection`；fx update 任务遇到 overlap 不会把整个迭代打崩。
**Tests**:
- `pnpm test src/tests/fx.update.service.test.ts src/tests/fx.service.test.ts`
- `pnpm test src/tests/outbox.service.test.ts`
**Status**: Not Started

## Stage 4: 测试/Mock 对齐
**Goal**: 更新测试用的 `dbMock`/调用方式，支持事务内 `.get/.all/.run`，并在 mock 的 `transaction` 中对“返回 Promise”做失败保护。
**Success Criteria**: 所有相关测试通过；新增回归测试覆盖“事务回调返回 Promise 会报错”的路径。
**Tests**:
- `pnpm test src/tests/utils.notify.test.ts`（快速 sanity）
- `pnpm test`
**Status**: Not Started


