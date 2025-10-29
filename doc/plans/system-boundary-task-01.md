# 系统边界改造任务 01：建立基线

## 状态（2025-02-14）

- ✅ 已完成。基线执行及巡检结果记录于 `doc/plans/system-boundary-baseline.md`。

## 背景

根据 `doc/system-boundary-plan.md` 的阶段 0 要求，需要在改造前记录当前基线，确保后续结构性调整不会掩盖既有行为或引入回归。

## 目标

- 运行现有核心测试（Income/Accounts 等）并记录结果。
- 快速巡检 `prisma/schema.prisma` 中关键表结构，确认收入与账本领域所需字段齐备。
- 在文档中固化基线结论，便于后续任务作为对照。

## 执行步骤

1. 运行 `pnpm test`（或项目推荐命令）并记录结果输出摘要。
2. 检查 `prisma/schema.prisma` 中的 `IncomeRecord`、`IncomeRecalcTask`、`TxnLine`、`FxSnapshot` 等模型，确认字段满足 Stage 1 改造所需。
3. 将命令输出及巡检结论写入 `doc/plans/system-boundary-baseline.md`（若不存在则创建），形成可追踪的基线记录。

## 验收标准

- 基线文档存在且记录了测试结果与 schema 巡检结论。
- 改造未开展前即可在 PR/评审中引用该基线证明“改造前状态”。
