# 系统边界改造任务进度总览（2025-02-14）

| 任务编号 | 描述 | 当前状态 |
| --- | --- | --- |
| Task-01 | 建立基线（测试结果 & Schema 巡检） | ✅ 已完成 |
| Task-02 | 服务层目录化（Accounts & Ledger / Income & Tax） | ✅ 已完成 |
| Task-03 | 写路径 FX 快照校验（存取款/估值等） | ✅ 已完成 |
| Task-04 | 测试基线修复（统一 Prisma Mock、补充断言） | ✅ 已完成 |
| Task-05 | Vitest 失败用例收敛（当前新增） | ✅ 已完成 |
| Task-06 | API 路由命名空间收敛 | ✅ 已完成 |
| Task-07 | EventOutbox 与队列平台建设 | ⏳ 待开始 |
| Task-08 | Reporting & Audit 完善 | ⏳ 待开始 |
| Task-09 | FX Provider 封装与缓存策略统一 | ⏳ 待开始 |
| Task-10 | Settings / Identity 子系统收敛与权限梳理 | ⏳ 待开始 |

> 当前测试基线已恢复全绿，Task-04/05 收尾。Task-06 完成后已删除全部旧版 `/api/v1/*` 兼容路由，调用方须使用新命名空间。下一步进入 Task-07（EventOutbox 与队列平台建设），并按序推进后续任务以满足 `doc/system-boundary-plan.md` 的阶段目标。
