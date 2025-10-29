# 系统边界改造任务 02：服务层目录化

## 状态（2025-02-14）

- ✅ 已完成。账本与收入服务已拆分至 `src/server/services/accounts-ledger/`、`src/server/services/income-tax/`，路由与测试引用同步更新。

## 背景

`doc/system-boundary-plan.md` 阶段 1 的核心之一，是将服务层按“Accounts & Ledger”和“Income & Tax”进行目录化，减少跨领域耦合，方便后续抽取子系统。

## 目标

- 在 `src/server/services/` 下新增 `accounts-ledger/` 与 `income-tax/` 目录。
- 将现有账本、收入、税务相关服务文件迁移到对应目录，并通过 `index.ts` 导出统一 API。
- 更新所有引用路径（路由、测试、其他服务）确保行为无差异。

## 执行步骤

1. 新建目录结构：
   - `src/server/services/accounts-ledger/`
   - `src/server/services/income-tax/`
2. 根据领域拆分现有文件：
   - `ledger.ts`、`accounts-summary.ts`、未来的 `valuations`/`transactions` 放入 `accounts-ledger/`。
   - `income.ts`、`income-timeline.ts`、`tax.ts` 等迁入 `income-tax/`。
3. 在新目录内创建 `index.ts`，集中导出对外 API，保持命名与类型兼容。
4. 全局更新导入路径，确保编译与测试通过；使用 `rg` 检查是否仍有旧路径。
5. 运行核心测试（账本、收入相关）验证目录化未引入行为变化。

## 验收标准

- 旧的 `src/server/services/*.ts` 中仅保留横切领域（如 `audit.ts`、`fx.ts`）。
- 所有引用使用新的目录导出，TS 编译与现有单测通过。
- 文档更新（如本任务记录）描述迁移内容与回归验证方式。
