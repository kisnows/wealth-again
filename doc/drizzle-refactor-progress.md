# Prisma -> Drizzle 全量重构进度（持续维护）

## 目标与约束
- 目标：将全项目 Prisma 完整替换为 Drizzle（SQLite），功能保持一致。
- 约束：继续使用 SQLite；Schema 直接从 Prisma 语义翻译为 Drizzle；字段继续以字符串存储（兼容重构）；better-auth 使用官方 Drizzle adapter；移除 Prisma 依赖；新增 `drizzle.config.ts`，删除 Prisma 目录与配置。

## 已完成（核心里程碑）
- 代码层：已将服务层/路由层 Prisma 调用替换为 Drizzle 查询。
- 认证层：`better-auth` 使用 `drizzleAdapter`（SQLite）。
- 数据库：`drizzle.config.ts` 已新增；Prisma 依赖与 `prisma/` 目录已移除。
- 脚本：原 Prisma 脚本已改为 Drizzle/TS 实现。
- 测试：已大面积改写为 Drizzle 模式；测试全量通过。

## 测试与 Mock 体系变更
- `dbMock` 已升级：
  - `setSelectFallback` 支持按表/调用序号返回 fallback 结果。
  - insert/update returning 自动补 `id/createdAt/updatedAt`。
  - select 支持 fallback（避免必须 queue）。
- **临时适配层**：`src/tests/helpers/dbAdapterMock.ts`（原 `prismaMock` 改名），用于在部分测试里复用 `mockResolvedValueOnce` 语义，以向 `dbMock` 的 queue 推送结果。

## 当前状态（所有测试通过）
- 最近一次测试：`pnpm test` 全绿（28 files, 154 tests）。
- 仍残留的 Prisma 名称已清理（代码层不再出现 `prisma` 字样）。

## 待完成（剩余工作）
### 1) 移除测试中的临时适配层（dbAdapterMock）
**目标**：全部测试仅使用 `dbMock`（`setSelectFallback/queue*`），删除 `dbAdapterMock`。

**涉及文件（目前仍用 dbAdapterMock）：**
- `src/tests/income.api.test.ts`
- `src/tests/income.routes.test.ts`
- `src/tests/accounts.api.test.ts`
- `src/tests/ledger.routes.test.ts`

**建议做法：**
- 把 `mockDb.*.findUnique/findMany/create/upsert/update` 等调用替换为：
  - `setSelectFallback`（按表返回）或 `queueSelectResults`。
  - `queueInsertResults`/`queueUpdateResults`（返回值）。
- 然后删除 `src/tests/helpers/dbAdapterMock.ts`。
- 同时清理相关 import（`dbAdapterMock/resetDbAdapterMock`）。

### 2) 统一 reset 行为
- 全部测试应使用 `resetDbMock()` 进行清理，不再保留 `resetDbAdapterMock()`。

## 已修改的关键文件（近期）
- `src/server/auth.ts`：better-auth Drizzle adapter。
- `src/server/db.ts`：Drizzle + better-sqlite3 初始化。
- `src/tests/helpers/dbMock.ts`：select fallback + returning 补全。
- `src/tests/helpers/dbAdapterMock.ts`：临时适配层（后续删除）。

## 运行与验证
- 测试：`pnpm test`
- 开发运行：`pnpm dev`（端口 4001）

## 迁移策略提示（给后续模型）
- 复杂测试优先用 `setSelectFallback`，避免 `queueSelectResults` 被其他链式 select 消耗。
- `setSelectFallback` 支持 `{ table, callIndex, tableCallIndex }`，推荐按 `tableCallIndex` 写“多次同表查询”的用例。
- 若发现 insert/update returning 丢字段，可依赖 `dbMock` 的默认补全逻辑，不必手动补 `id/createdAt/updatedAt`。

