## 多币种改造后续工作清单（2025-02-18）

> 目标：下一位接手的同学（或 AI）只需阅读本文，即可继续完成剩余改造、修复测试并落地前端/服务端联动。

---

### 一、当前仓库状态速览

- **数据库结构**：`prisma/migrations/20250218121000_multi_currency_fx_snapshots/` 已落地 FxSnapshot 表及相关外键；`prisma/migrations/20251021093117_income/migration.sql` 已补齐 IncomeRecord 的新列（`fxSnapshotId` / `fxAppliedRate`）。
- **种子数据**：`prisma/seed.js` 包含 2023–2025 USD↔CNY 汇率快照示例，并为交易、估值、收入记录写入 `fxSnapshotId`、`sourceCurrency` 等字段。执行指令：
  ```bash
  node prisma/seed.js
  node scripts/backfill-fx-snapshots.cjs  # 迁移后补齐历史快照
  ```
- **服务层**：
  - `src/server/services/fx.ts` 已引入缓存、批处理（`ensureFxSnapshotBatch`）及缺失汇率审计，但仍依赖真实 Prisma 委托。
  - `src/server/services/ledger.ts`、`accounts-summary.ts` 已写入快照，并在汇率缺失时提供兜底逻辑。
  - 其他服务（`income.ts`、`income-timeline.ts`、`tax.ts` 等）尚未全部适配新快照模式。
- **测试状态**：`pnpm test` 当前失败 39/120 用例，主要因 mock 未覆盖新依赖、接口行为变更未更新断言。
- **Lint 状态**：`pnpm lint` 仍有 `any`、未使用导入等遗留问题。

---

### 二、待办事项拆解

#### 1. 服务层与领域逻辑
- [x] `src/server/services/income.ts` / `income-timeline.ts`
  - 2025-02-19：收入回算改为按 `TaxContext` 分段累计，并在回算/时间线层统一通过 `FxSnapshot` 进行币种折算。
  - 替换 `fxRateId` 依赖，基于 `fxSnapshotId` + `fxAppliedRate` 进行累计换算。
  - 在 `calculateTax` 调用处处理快照币种与规则币种的差异，必要时调用 `convert`。
  - 补充城市/国家切换时累计字段重置逻辑。
- [x] `src/server/services/tax.ts`
  - 2025-02-19：新增 `getTaxContext` 与 `computeCumulativeTax`，替换旧的单一税率表计算逻辑，支持多币种与生效区间。
  - 已加入委托兜底，但需将 `calculateTax` 的入口改造为快照感知（例如对传入的收入记录进行币种换算）。
  - 更新 `TaxService` 测试，覆盖多币种税率场景。
- [ ] `src/server/services/income-forecast.ts` / 相关任务处理器
  - 确保预测/回算任务使用快照而非实时汇率；必要时在任务执行前批量预取快照，或调用 `ensureFxSnapshotBatch`。

#### 2. API Route Handlers
- [ ] `/api/v1/accounts-ledger/entries/deposit`、`/api/v1/accounts-ledger/entries/withdraw`、`/api/v1/accounts-ledger/entries/transfer`
  - 与服务层保持一致：补充快照字段、错误码、attachment 写入。
  - 更新 meta 中的 `rateSnapshots` 结构（当前对 `capturedAt` 有日期假设）。
- [ ] `/api/v1/accounts-ledger/valuations`：引入 `fxSnapshotId` / `fxAppliedRate` 字段，兼容回填脚本。
- [ ] `/api/v1/reporting/accounts/summary`：目前服务层已更新，但测试 mock 仍期待旧字段，需要同步修正（见下文）。
- [x] `/api/v1/settings/*`：仅保留展示币种偏好设置，基础币种相关功能已取消。

#### 3. 前端（Next.js App Router）
- [ ] `/settings`
  - [x] 展示币种偏好持久化到用户表，支持全局 SWR 同步与 Dashboard/Income 刷新。
  - [ ] （已移除基础币种概念，无需额外配置）。
- [ ] `/income/*`
  - [x] 与 `IncomeAnalyticsPanel` 联动，显示记录币种、快照信息以及折算后的展示金额。
  - [ ] 表单写入时补充 `sourceCurrency` / `fxSnapshotId`。
- [ ] `/accounts`、`/entries/*`
  - 转账弹窗展示实时快照说明（当转换依赖历史速率时，需要提示用户 `asOf` 日期）。
  - Dashboard 中 `accountType` 汇总需改造为类型安全（当前 `any`）。

#### 4. 测试与 Mock 修复
- [ ] 更新所有使用 prisma mock 的测试文件：
  - 添加 `taxConfig.findFirst`、`taxConfig.findUnique`、`fxRate.findFirst`、`fxSnapshot.findFirst/create`、`$transaction` 等方法的 stub。
  - `ledger`/`accounts` 相关测试需要模拟 `ensureFxSnapshotBatch` 或提供固定返回值。
  - 对转账 metadata 的断言需更新为新的结构（`sourceRateId`、`capturedAt` 可能为空时回退 `fxEffectiveAt`）。
- [ ] 编写回归测试：
  - `src/tests/fx.service.test.ts`：补充 `ensureFxSnapshotBatch` 缺省 fallback 场景。
  - `src/tests/income.service.test.ts`：使用 seed 中的杭州示例验证 2025-01~03 月的累计税额、净收入。
  - 新增 `src/tests/accounts.summary.service.test.ts`：覆盖快照桥接、缓存命中等逻辑。

#### 5. 文档与运维
- [ ] 更新 `doc/frontend-spec.md` 与 `doc/tech.md`，说明多币种快照使用规范及展示币种偏好处理。
- [ ] 在 `doc/README.md` 的索引中链接本跟进文档，标注 2025-02-18 状态。
- [ ] 准备迁移演练说明：记录执行顺序（`migrate deploy` → `seed` → `scripts/backfill-fx-snapshots.cjs`）、预期输出及回滚策略。
- [ ] 基础币种修改后触发异步任务（已下线，后续若恢复需重新设计）。

---

### 三、测试失败分析（2025-02-18）

| 失败范围 | 核心原因 | 对应待办 |
| --- | --- | --- |
| `income.service.test.ts` 等 | mock 未提供 `taxConfig.findFirst` / `findUnique` → 抛出 “is not a function” | 测试桩补全 & 服务层兜底 |
| `accounts.service.test.ts`、`ledger.routes.test.ts` | `txnEntry.create`、`$transaction`、`convert` mock 未适配新接口；meta 结构断言过时 | 测试重写 & 转账 meta 定义 |
| `accounts-summary` & `reports` | 测试中返回假数据导致 `accounts.length` 为 undefined，需防御或 mock | 见服务层/测试待办 |
| `valuations.routes.test.ts` | `NextResponse.json` 序列化含 `BigInt/Decimal` 失败 | 在 route 中转换为 `Number`，或在测试 mock 中返回 `Number` |
| `rules` 相关 | 规则接口现允许覆盖？需重新确认预期（可能是快捷修复 migration 影响） | 前端/接口逻辑对齐 PRD，调整测试期待值 |

---

### 四、开发指引

1. **环境准备**
   ```bash
   pnpm install --no-frozen-lockfile
   npx prisma generate
   pnpm lint
   pnpm test
   ```
   - 若安装受内网限制，请确保 `.npmrc` 指向合法镜像；必要时使用 `pnpm-workspace.yaml` 中 `onlyBuiltDependencies` 编译本地模块。

2. **数据库操作**
   ```bash
   npx prisma migrate deploy
   node prisma/seed.js
   node scripts/backfill-fx-snapshots.cjs
   ```
   - 回填脚本会输出缺失快照 ID，后续可用于人工核对。

3. **常见问题**
   - `default.$transaction is not a function`：说明测试里使用的 mock 未提供 `$transaction`；可在测试桩中添加 `mockImplementation(async cb => cb(mockPrisma))`。
   - `Value is not JSON serializable`：Next.js Response 不接受 `Decimal` 等类型，需在 route handler 中 `Number()` 化。
   - `fx_rate_missing`：表示 seed 中缺少对应币种速率，应在 `prisma/seed.js` 中补充，或在 `scripts/backfill-fx-snapshots.cjs` 运行后检查缺失列表。

---

### 五、优先级建议

1. **修复服务层/测试桩** → 让 `pnpm test`、`pnpm lint` 通过，保障已有功能稳定。
2. **完成收入域改造**（`income.ts` + Route Handlers + 前端时间线），确保多币种累计预扣逻辑正确。
3. **（已取消）基础币种二次确认**：当前系统仅保留展示币种偏好，无需处理。
4. **更新文档与运维脚本**，准备生产迁移演练。

如需进一步拆分任务，可基于本文各小节新增 issue 或 TODO，并在本文内同步更新进度。

---

最后更新：2025-02-18 11:30（由自动化代理整理）  
如需自动上下文加载，请直接读取本文件并遵循「待办事项拆解」章节的顺序执行。***
