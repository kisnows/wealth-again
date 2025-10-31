# 系统边界改造任务 10：Settings 与 Identity 子系统收敛

## 完成内容概览

- 保持 Identity 命名空间，补强关键接口的幂等性与审计：`/api/v1/identity/city-changes`、`/identity/auth/me`、`/identity/user/profile` 统一引入 `ensureIdempotent`/`markIdempotencyUsed` 与 `audit.logAndEmit`，避免重复写入并沉淀操作事件。
- 城市迁移改为“记录+排队回算”流程：落库与城市更新置于同一事务，随后调用 `scheduleIncomeRecalcTask` 入队，响应返回任务信息（202），便于前端提示后台处理状态。
- 用户展示币种、资料更新改为幂等 PATCH，新增审计事件 `audit.identity.display_currency_updated` 与 `audit.identity.profile_updated`，前端通过现有 `fetcher` 自动携带幂等键，无需额外改动。
- `/settings` 页面优化反馈：创建城市迁移记录后 toast 提示队列任务号；其余偏好更新沿用新接口，SWR 缓存自动刷新。

## 接口与权限

- `POST /api/v1/identity/city-changes`
  - 请求体：`{ toCityId, effectiveMonth?, reason? }`
  - 响应：`{ cityChange, task: { id, status } }`，状态码 202
  - 行为：校验同国、未来月份 → 幂等指纹校验 → 事务内落库与更新用户 → 调度回算任务 → 写入审计事件
- `PATCH /api/v1/identity/auth/me`
  - 请求体：`{ displayCurrency: string | null }`
  - 幂等 + 审计，拒绝非法币种，返回最新用户信息
- `PATCH /api/v1/identity/user/profile`
  - 仅允许修改 `name`，其余字段写在专用接口（城市迁移）
  - 同样具备幂等与审计

所有接口仍基于当前登录用户，无额外管理员入口；后续如需管理员代操作，可在相同命名空间增加带权限检查的路由。

## 前端适配

- `createCityChange` 返回值扩展为 `{ cityChange, task }`，`SettingsPage` 在成功时展示“任务已排队（任务号 …）”提示。
- 其它调用（展示币种偏好、资料更新）继续使用原封装，幂等键自动生成。

## 测试覆盖

- `src/tests/city-changes.api.test.ts` 更新为期待排队逻辑与任务响应；
- 新增 `src/tests/identity.auth-me.api.test.ts` 覆盖展示币种更新的幂等/审计路径；
- 现有 `user.profile.api.test.ts` 延续验证名称更新场景。

`npm test` 全量通过（135 项），确保 Settings/Identity 改造后行为稳定。

## 后续建议

- 管理员代操作与审计：若需支持管理员为他人调整城市/偏好，可在当前路由基础上扩展 `admin` 入口，并在审计事件中补充 `actedBy` 字段。
- Settings 页面仍有统计日期等本地偏好，可视需求接入服务端存储或 Workspace 级设置。
