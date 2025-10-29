# 系统边界改造任务 04：测试基线修复与 Prisma Mock 补齐

## 背景

在阶段 0 的基线记录中（`doc/plans/system-boundary-baseline.md`）已指出，现有 Vitest 用例大量依赖早期的 Prisma mock 约定。随着服务目录与 FX 写路径改造完成，测试仍然失败，需要专门的任务来对齐新的目录结构与必填字段，确保回归工具可信。

## 目标

- 审核 `src/tests` 下的 Prisma mock，补充 `txnEntry.create`、`valuationSnapshot.create`、`fxSnapshot` 等方法的默认实现或字段断言，匹配最新服务逻辑。
- 更新受影响的测试断言（账户/收入/FX/规则等），覆盖 `fxAppliedRate`、`fxEffectiveAt`、`fxSnapshotId` 等新增字段。
- 运行 `pnpm test`，确保改造后的测试重新通过，提供更新后的基线记录。

## 执行步骤

1. 梳理失败用例列表（参考基线文档），按领域逐个修复：
   - Accounts & Ledger 路由/服务；
   - Valuations、FX；
   - Income & Tax 相关服务与路由；
   - Reporting / Rules 等间接依赖。
2. 为常用 Prisma mock 提供统一工厂或 helper，减少重复布置。
3. 根据新逻辑更新断言，确保 FX 字段被覆盖（可利用 `expect.any(Date)` 等宽松检查）。
4. 执行 `pnpm test` 并更新 `doc/plans/system-boundary-baseline.md` 中的结果，记录通过状态。

## 验收标准

- `pnpm test` 全部通过，并在基线文档中刷新结果。
- 关键写路径的 FX 字段在测试中具备覆盖（至少 Accounts/Income/Valuations 三条线）。
- Mock/Helper 的调整具备复用性，后续阶段不会重复碰到同类问题。

## 当前进展（2025-02-14）

- 已在 `vitest.setup.ts` 基础上新增 `src/tests/helpers/prismaMock.ts`，统一导出 `prismaMock` 与 `resetPrismaMock`，大部分测试迁移为使用共享 Mock。
- 调整多处测试（Accounts/Income/Fx/Routes 等）以适配新 Mock 结构，并补充 FX 字段断言。
- 仍存在若干失败用例（主要集中在收入、账本 API），需要继续补齐默认返回值与测试断言。
