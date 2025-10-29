# 系统边界改造任务进度总览（2025-02-14）

| 任务编号 | 描述 | 当前状态 |
| --- | --- | --- |
| Task-01 | 建立基线（测试结果 & Schema 巡检） | ✅ 已完成 |
| Task-02 | 服务层目录化（Accounts & Ledger / Income & Tax） | ✅ 已完成 |
| Task-03 | 写路径 FX 快照校验（存取款/估值等） | ✅ 已完成 |
| Task-04 | 测试基线修复（统一 Prisma Mock、补充断言） | 🔄 进行中 |
| Task-05 | Vitest 失败用例收敛（当前新增） | 🔄 进行中 |
| Task-06 | API 路由命名空间收敛 | ⏳ 待开始 |
| Task-07 | EventOutbox 与队列平台建设 | ⏳ 待开始 |
| Task-08 | Reporting & Audit 完善 | ⏳ 待开始 |
| Task-09 | FX Provider 封装与缓存策略统一 | ⏳ 待开始 |
| Task-10 | Settings / Identity 子系统收敛与权限梳理 | ⏳ 待开始 |

> 当前执行到 Task-05（在 Task-04 基础上继续修复 Vitest 失败用例，目标是让 `pnpm test` 恢复全绿）。完成 Task-05 后，将依序开展 Task-06 ～ Task-10，以满足 `doc/system-boundary-plan.md` 的后续阶段要求。

