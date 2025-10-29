# 系统边界改造任务 03：写路径 FX 快照校验

## 背景

根据阶段 1 的第二项要求，需要核对交易与收入写路径中对汇率快照的使用是否完备，并补充缺失逻辑与测试，确保后续 Outbox 与异步改造具备可信基础。

## 目标

- 核实 `TxnLine`、`IncomeRecord` 等写入逻辑，确认 `fxSnapshotId`、`fxAppliedRate`、`fxEffectiveAt` 等字段正确赋值。
- 针对发现的缺口补齐实现，保持最小侵入式改动。
- 增补单元测试或集成测试，断言关键字段的存在与正确性。

## 执行步骤

1. 梳理账户交易与收入相关的 service 方法（如 `postDeposit`、`scheduleIncomeRecalcTask` 等），列出涉及汇率写入的路径。
2. 若调用 `convert` 或依赖 FX 数据，确保在写入实体时记录对应的快照 ID、使用的汇率与生效时间；若缺失则补写逻辑（例如补全 `fxEffectiveAt`、默认 1 倍汇率等）。
3. 为关键写入添加/更新测试（`src/tests/accounts.service.test.ts`、`src/tests/income.service.test.ts` 等），断言数据库记录或返回值包含正确字段。
4. 运行相关测试验证通过，并在文档中记录验证结论与潜在后续工作。

## 验收标准

- 所有涉及跨币种写入的路径均能持久化 FX 快照元数据。
- 新增测试覆盖典型路径，运行结果通过。
- 文档中记录检查结果及未处理的风险或后续事项。

## 当前进展（2025-02-14）

- ✅ 已完成本次改造。
- `/entries/deposit`、`/entries/withdraw` 路由及 `accounts-ledger/ledger.ts` 已补齐 `fxEffectiveAt`、`fxAppliedRate`、`fxSnapshotId` 写入，确保即便同币种也保留快照信息。
- `/valuations` 路由引入 `ensureFxSnapshot`，当估值币种与账户基准币不同时时落库快照与汇率。
- `income` 服务写路径原有的快照逻辑保持有效，后续在测试修复阶段补充断言覆盖。
