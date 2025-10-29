# 系统边界改造任务 05：Vitest 失败用例收敛

## 背景

在任务 04 中已统一 Prisma mock，并为部分账户、FX、估值与收入测试补齐字段，但 `pnpm test` 仍然存在多条失败用例，主要集中在：

- 收入服务与报告相关测试：缺少 `taxConfig.findFirst` 等返回值，触发 `user_not_found` 或税表空值。
- 账本/估值路由测试：mock 数据不足导致 `accounts.length` 为 undefined、幂等校验失败。
- FX 服务测试：`convert` 在创建汇率快照时仍可能抛出 `fx_snapshot_not_created`。

为确保阶段性改造后基线可用，需要继续迭代测试数据与断言。

## 目标

- 修复当前 `pnpm test` 中所有失败用例，使测试重新通过。
- 对关键场景补齐模拟数据：税表、账户列表、FX 快照、报表用户等。
- 更新 `doc/plans/system-boundary-baseline.md`，记录“测试全部通过”的新基线。

## 执行步骤

1. **收入域测试补齐**  
   - 在 `income.service.test.ts`、`income.forecast*.test.ts` 等文件中为 `taxConfig.findFirst`、`taxBracket.findMany`、`user.findMany` 等常用查询给出默认返回。  
   - 检查 `income.routes.test.ts`、`income.api.test.ts`、`reports.*.test.ts`，确保调用 `buildIncomeTimeline` 之前，`user` mock 具备城市信息，避免 `user_not_found`。

2. **账本/估值测试补齐**  
   - 账户相关测试需显式设置 `account.findMany`/`findUnique`、`txnEntry.create` 等返回，保持 `accounts-ledger` 汇总逻辑的输入足够完整。  
   - `/valuations` 路由测试需要同步补齐 `valuationSnapshot.create` 的字段（`fxSnapshotId`、`fxAppliedRate`），并确保 `account.findMany` 返回至少一条数据。

3. **FX 服务测试完善**  
   - 针对 `convert`，在测试中预置 `fxSnapshot.findFirst`/`create` 的返回值，避免抛出 `fx_snapshot_not_created`。  
   - 核查 `fxRate.findMany` 的默认返回值，确保 `getLatestRates` 用例可覆盖缺失分支。

4. **重跑测试并更新基线**  
   - 执行 `pnpm test`，若失败则继续补齐对应 mock/断言直至全绿。  
   - 成功后在 `doc/plans/system-boundary-baseline.md` 写入新的测试结果，说明已恢复通过状态。

## 验收标准

- `pnpm test` 全部通过，日志与变更记录写入基线文档。
- 所有失败用例根因得到修复，无临时跳过或 `vi.skip`。
- Mock/断言调整保持可维护性，后续改动无需重复填坑。
