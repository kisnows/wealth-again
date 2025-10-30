# Task-07 后续整改计划：Outbox & 队列联调收尾

## 背景

Task-07 已完成核心代码改造：新增 `EventOutbox` 模型、引入队列抽象、将收入回算/账户写路径写入 Outbox，并提供本地 worker。然而现有测试与部分逻辑尚未完全适配新的异步流程，导致 `pnpm test` 仍存在失败用例，前端仍假设回算同步返回更新条数。为达成 `doc/plans/system-boundary-task-07.md` 的验收标准，需要进一步收敛以下问题。

## 待完成事项

1. **收入回算测试适配（Service/UI/API）**
   - 更新 `src/tests/income.api.test.ts`、`income.routes.test.ts`、`income.forecast*.test.ts`、`income.prd-example.test.ts` 等用例，改为验证“入队 → worker 执行 → 断言结果”的流程，解除对 200/同步回算的依赖。
   - 提供测试辅助工具：封装 `processDueIncomeRecalcTasks` 或直接 mock `jobs/queue`，在测试中显式触发回算，确保金额断言仍被覆盖。

2. **队列服务返回值与 Mock 完善**
   - `enqueueIncomeRecalcTask` 在更新已有任务时需保证返回对象包含 `id/taxYear/startMonth/endMonth` 等字段。当前在部分测试场景（mock 返回空对象）会导致 `taskId` 读取失败。
   - 将 `jobs/queue` 中的 `mark*` / `enqueue*` 方法导出易于测试的接口，并在 `prismaMock` 中补全相应 delegate 以避免 `undefined` 访问错误。

3. **前端交互同步**
   - `postIncomeRecalc` 及 `IncomeRecalcPanel` 已改为处理 202 响应，但页面提示仍缺少“手动触发 worker”说明。补充文案或提示，引导用户前往任务列表/等待队列完成。
   - 校验 `/income` 等页面是否仍假设同步更新，并根据需要刷新任务列表。

4. **Outbox/Queue 集成补测**
   - 新增针对队列 worker 的集成测试（可在 Vitest 中直接调用 `processDueIncomeRecalcTasks`），验证事件写出与任务状态流转。
   - 扩充 `outbox.service.test.ts`，覆盖 `fetchPendingOutboxEvents`、`markDelivered/Failed` 的默认 client 分支。

5. **文档更新**
   - 在 `doc/plans/system-boundary-task-07.md` 增补“实际运行方式、任务列表轮询、worker 启动指引”章节，说明同步接口已改为排队处理。

## 交付标准

- `pnpm test` 全量通过，含新增队列/Outbox 测试。
- `/income-tax/recalc` 接口与前端页面同步提示“任务已入队”；任务执行可由 worker 或页面提示触发。
- `doc/plans/system-boundary-task-07.md` 记录整改结果与运行说明。
