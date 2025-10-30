# 系统边界改造任务 06：API 路由命名空间收敛

## 背景

阶段 1 完成后，领域服务已拆分为 `accounts-ledger/*`、`income-tax/*` 等子目录，但 `/api/v1` 仍延续旧命名（如 `/accounts/*`、`/city-changes`、`/rules/*`）。为真正体现“5+1 子系统”边界，需要将 Route Handler 与 URL 映射同步收敛。

## 目标

- 为每个子系统建立统一的 API 命名空间，例如：
  - `accounts-ledger`: `/api/v1/accounts-ledger/*`
  - `income-tax`: `/api/v1/income-tax/*`
  - `identity`: `/api/v1/identity/*`（城市迁移、个人设置等）
  - `fx`: `/api/v1/fx/*`
  - `rules`: `/api/v1/income-tax/rules/*`（或归并至 `income-tax` 按需求）
- 调整 Route Handler 文件结构（`src/app/api/v1/...`），并提供旧路径到新路径的兼容层或重定向。
- 更新前端调用、SWR Key、测试用例，使其匹配新的命名空间。

## 执行步骤

1. 梳理现有 `/api/v1` 子目录，形成“旧路径 → 新路径”的对照表，并写入文档供前后端参考。
2. 在 `src/app/api/v1` 中创建新命名空间目录，将 Route Handler 文件迁移（或重新导出），同时保留过渡期别名（例如通过 re-export 或轻量 redirect）。
3. 更新客户端 API 调用层（`src/lib/api/*`）、SWR Key 与测试中的请求 URL；同步调整前端路由/Hook（例如 `/settings`、`/accounts`、`/income` 等页面中的请求封装）。
4. 运行现有后端、前端（SWR/页面）测试或 smoke，确认行为未回归；必要时在文档中记录兼容策略与迁移时间线。

### 旧路径 → 新命名空间对照表（旧路径已完全删除）

| 子系统 | 已废弃路径 | 当前路径 |
| --- | --- | --- |
| Accounts & Ledger | `/api/v1/accounts`<br>`/api/v1/accounts/[id]/*`<br>`/api/v1/entries/*`<br>`/api/v1/valuations` | `/api/v1/accounts-ledger/accounts`<br>`/api/v1/accounts-ledger/accounts/[id]/*`<br>`/api/v1/accounts-ledger/entries/*`<br>`/api/v1/accounts-ledger/valuations` |
| Income & Tax | `/api/v1/income/*`<br>`/api/v1/rules/*` | `/api/v1/income-tax/*`<br>`/api/v1/income-tax/rules/*` |
| Identity & Settings | `/api/v1/auth/me`<br>`/api/v1/user/*`<br>`/api/v1/city-changes`<br>`/api/v1/cities`<br>`/api/v1/countries` | `/api/v1/identity/auth/me`<br>`/api/v1/identity/user/*`<br>`/api/v1/identity/city-changes`<br>`/api/v1/identity/cities`<br>`/api/v1/identity/countries` |
| FX | `/api/v1/fxrates` | `/api/v1/fx/rates` |
| Reporting | `/api/v1/reporting/dashboard`（原 `/api/v1/reports/dashboard`）<br>`/api/v1/reporting/income/timeseries`（原 `/api/v1/reports/income/timeseries`）<br>`/api/v1/reporting/accounts/summary`（原 `/api/v1/reports/accounts/summary`） | `/api/v1/reporting/*` |

> 说明：2025-02-XX 起，旧路径已经在代码仓库中移除，所有调用方必须使用右列命名空间。

## 验收标准

- 所有 API 均位于目标命名空间下，无零散顶层路由。
- 前端、测试均使用新的命名空间，旧路径对外表现为兼容层（或经文档说明后移除）。
- 文档提供迁移清单与对外接口变更说明。
