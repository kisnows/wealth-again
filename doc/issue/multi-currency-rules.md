## 背景

- 当前社保、公积金、个税等规则默认使用“基础币种”做统一折算，但该口径无法覆盖用户在不同时间使用不同币种结算的真实场景。
- 当用户在年度内迁移到其他币种国家或跨年后币种变更时，现有累计预扣逻辑会出现偏差。
- 需要将“基础币种”从规则计算中剥离，转而由每条规则与配置自带币种和生效区间；基础币种仅用于默认展示，需要用户知情确认。

## 需求范围

1. **规则携带币种**
   - `CityRuleSS/HF`、`TaxConfig`、`TaxBracket`、社保与专项扣除配置等所有金额字段需要增加币种字段。
   - 新增的币种字段默认使用现有基准币种补录，迁移时需要一次性更新 seed 与数据库。
2. **规则版本化**
   - 所有规则与配置需要明确 `effectiveFrom` 与 `effectiveTo`（为空表示持续有效）。
   - 累计预扣、社保、公积金计算逻辑按收入记录发生时间匹配对应区间的规则。
   - 规则区间变更触发币种或税率跳转时，需要明确累计字段（`taxableCumulative`、`taxPaidCumulative` 等）的重置或结转规则，确保迁移国家后从零开始计算。
3. **收入记录与扣除项**
   - `IncomeRecord`、专项附加扣除、城市迁移等写入接口需要携带币种，并保存为原始币种。
   - 计算层根据规则币种和记录币种，按 FX 转换后参与累计。
   - 每条收入及扣除记录需保存对应汇率快照（如 `fxRateId` 或“换算日期+汇率”），便于历史回算与审计复现。
4. **前端设置改造**
   - `/settings` 保留“展示币种”配置，默认值为 `USD`，用于 Dashboard 与报表统一口径；用户更新后即作为新的展示默认值，无需影响规则计算。
   - `/settings` 中展示系统“基础币种”字段，强调其只作为展示默认值和历史折算备用口径；修改时需二次确认、记录 AuditLog，并提示可能触发历史数据重算。
   - 规则与扣除管理页列表展示每条规则的币种、生效区间及来源标签（城市/国家仅作为辅助信息），城市迁移、专项扣除等表单需支持选择币种。
5. **基础币种策略调整**
   - 保留用户级 `displayCurrency` 字段，并在前端状态中区分展示币种、基础币种、规则币种三类来源，方便 SWR 失效与数据校验。
   - 基础币种仅在无展示偏好时作为默认换算使用，服务层逻辑完全依赖规则币种与记录币种；修改基础币种需触发 FX 快照重拉与历史展示金额重算。

## 数据与迁移

- 设计 Prisma 迁移脚本，为受影响模型补充币种、生效时间字段。
- 迁移脚本需要为现有历史数据填充默认币种（当前基础币种值）以及生效时间范围。
- 同步补录历史收入、扣除、对账记录的原币种金额、展示金额与对应汇率快照引用，为后续展示币种或基础币种调整提供重算依据。
- 更新 `prisma/seed.ts` 以提供币种与生效区间示例数据（至少覆盖杭州 2023–2025）。

### 现有模型影响确认（2025-02-18 审核）

- Prisma 当前已包含 `FxSnapshot` 表（字段：`baseCurrency`、`quoteCurrency`、`rate`、`capturedAt`、`sourceRateId`、`effectiveFrom/To`、`createdBy`）。迁移顺序需明确：**先建表，再补充业务表外键**，确保回填脚本可引用。
- 以下业务表已落地 `fxSnapshotId` / `fxAppliedRate` 字段，但仍保留旧的 `fxRateId` 或临时冗余，需要在迁移脚本中统一回填与校验：
  - `TxnEntry`：`fxRateId`、`fxSnapshotId`、`fxAppliedRate`；主记录需引用与资金方向一致的快照。
  - `TxnLine`：`fxSnapshotId`、`fxAppliedRate`、`fxEffectiveAt`；跨币种明细必须匹配 `TxnEntry` 聚合的快照。
  - `ValuationSnapshot`：用于账户估值的快照引用，回填后才能正确反推历史展示金额。
  - `IncomeRecord`：新增 `fxSnapshotId`、`fxAppliedRate`、`sourceCurrency` 字段；后续迁移脚本需根据 `monthDate` 与记录币种生成快照。
- 迁移演练应按照「建表 → 增列 → 回填 → 校验 → 清理旧列」的顺序执行；当前 schema 仍依赖 `fxRateId`，暂不移除，避免在回填完成前破坏历史记录。
- 除 FX 相关字段外，`CityRuleSS`、`CityRuleHF`、`TaxConfig`、`TaxBracket`、`IncomeChange` 等规则表已补充 `currency` 与 `effectiveFrom/To` 字段；迁移脚本需校验 seed 中 2023–2025 杭州样例是否覆盖所有时间段。

## 服务与前端影响

- 更新 `src/server/services/income`、`tax`、`fx` 等使用基础币种的逻辑，改为动态匹配规则与记录币种。
- 调整 FX 获取逻辑，优先按记录发生日期获取单一汇率快照并缓存引用；缺失快照时再按当前汇率补全并写入补录记录。
- 前端 SWR key 需在相关配置变更后失效重算。

## 风险点

- 累计预扣与年中回算逻辑涉及大量历史数据，需补充回归测试覆盖多币种示例。
- Prisma 迁移涉及历史数据补录，需要编写数据修复脚本并在 seed 中验证。
- 基础币种或展示币种调整可能导致历史展示金额差异，需要在 UI 提供风险提示、后台触发重算并记录 AuditLog。
- 汇率快照缺失或导入错误会直接影响税务复算结果，需增加快照完整性监控与告警。

## 后续事项

- 完成上述改造后，再清理 UI 与文档中对“基础币种”与“展示币种”的描述，明确适用场景与风险提示。
- 检查导出、报表、审计日志等模块是否依赖基础币种或展示币种，统一迁移并补充二次确认。
- 为基础币种修改、新增汇率快照等敏感操作补充 AuditLog 记录及回归测试。

## FX 快照设计

- **数据模型**
  - 新增 `FxSnapshot` 表：`id`（UUID）、`baseCurrency`、`quoteCurrency`、`rate`（Decimal）、`capturedAt`（记录换算发起时间）、`sourceRateId`（关联 `FxRate`）、`effectiveFrom`、`effectiveTo`、`createdAt`、`createdBy`（可为空，系统任务记为 `system`）。
- 所有需要持久化汇率的业务表（如 `IncomeRecord`、`TxnEntry`、`TxnLine`、`ValuationSnapshot`、收入回算结果表等）增加 `fxSnapshotId` 与 `fxAppliedRate` 字段；若原币种与展示币种一致则可为空，但依旧记录 `fxAppliedRate = 1` 以便计算校验。
  - Seed 数据补充基础的 `FxRate`、`FxSnapshot` 样例，覆盖 CNY/USD、USD/CNY 在 2023–2025 的月度快照。
- **写入策略**
  - 计算或入账流程调用 `ensureFxSnapshot(base, quote, at)`：按 `at`（默认 `asOf`）查找 `FxRate` 区间，再在 `FxSnapshot` 中匹配同一 `base+quote+sourceRateId+capturedAt` 的记录；若不存在则插入一条新快照并返回。
  - 收入写入、专项扣除、年中回算等场景获取快照后，将 `fxSnapshotId` 与 `fxAppliedRate`（`snapshot.rate`）落库；展示金额、累计字段使用该值换算，AuditLog 记录快照信息。
  - 回算或人工调整时优先读取 `fxSnapshotId` 对应的快照；若 `sourceRateId` 已失效，则仍按 `FxSnapshot.rate` 作为真值，同时触发 FX 服务告警补齐缺失的历史 `FxRate`。
- **读取策略**
  - 所有展示统一通过 `fxSnapshotId` 或 `fxAppliedRate` 进行还原，禁止直接取最新汇率；仅当历史记录缺失快照时，才按 `FxRate` 补全并立即写回快照。
  - `/settings` 中的展示币种切换仅影响实时换算层，多个记录的展示金额由已有快照配合目标展示币种的最新快照完成，确保历史值可重复。
- **审计与回归**
  - 快照写入、回算补齐、基础币种修改需写入 `AuditLog`，记录 `fxSnapshotId`、旧值、新值与触发来源。
  - `src/tests` 增加 `fx.service.test.ts` 校验快照重复插入、缺失补齐、跨日查询的行为；`income.service.test.ts` 增加“多币种入账+回算使用同一快照”的断言。

## 基础币种变更二次确认流程

- **触发入口**
  - `/settings` 页面保留“基础币种（Base Currency）”展示区域，显示当前值与最后修改时间，默认 `USD`。
  - 用户点击“修改基础币种”按钮后弹出 `Dialog`，表单仅允许从系统支持列表中选择（与 `displayCurrency` 共用枚举）。
- **确认机制**
  - 弹窗内包含风险提示：历史展示金额需要按新基础币种重算，过程可能耗时；需打勾确认“我已了解风险”，并在确认输入框中键入目标币种代码，如 `USD`。
  - 用户提交时再次弹出轻量确认（`AlertDialog`），列出旧值、新值、影响范围（展示金额重算、导出报表、账户总览）。
  - 二次确认通过后方可调用 API；关闭弹窗或取消则不修改任何数据。
- **后端流程**
  - `PUT /api/settings/base-currency` 校验请求来源必须为管理员或用户本人；校验目标币种属于支持列表且与当前值不同。
  - 成功变更后写入 `AuditLog`（操作人、旧值、新值、确认时间、风险确认标记），同时将任务投递到 `rebaseDisplayAmounts` 队列，异步重算历史展示金额与缓存。
  - API 返回新旧值、任务 ID，前端据此在消息条中展示“正在重算，预计耗时 X 分钟”。
- **前端状态与 SWR**
  - `settings` 相关的 SWR key 在 API 成功后立即失效；同时更新全局 Zustand store 的 `baseCurrency`，触发 Dashboard、report 模块刷新。
  - 页面显示一个 `ProgressCard` 展示重算进度（轮询任务状态 API），完成后提示刷新。
- **异常处理**
  - 若后台重算失败，任务状态返回 `failed`，前端展示错误与重试按钮；重试时沿用同一 `taskId` 并写入新的 AuditLog。
  - 任意失败均不会回滚基础币种字段，但会提示用户下载失败报告，供运营介入。

## 数据库迁移脚本规划

- **结构调整顺序**
  1. 迁移 `FxRate`：为后续外键允许为空，确保旧数据可写入 `FxSnapshot`。
  2. 新增 `FxSnapshot` 表（见上节字段定义），并为 `sourceRateId` 建立索引，约束同一 `base+quote+sourceRateId+capturedAt` 唯一。
  3. 在 `IncomeRecord`、`TxnEntry`、`TxnLine`、`ValuationSnapshot` 等表新增 `fxSnapshotId`（可空）、`fxAppliedRate`（Decimal，默认 1）、`originalCurrencyAmount`（必要时），并保留历史 `fxRateId` 以支持渐进迁移；若后续补充税务对账表（如 `TaxReconcile`），需使用同一模式。
  4. 在城市/税务规则相关表 (`CityRuleSS`, `CityRuleHF`, `TaxConfig`, `TaxBracket`) 增加 `currency`、`effectiveFrom`、`effectiveTo` 字段；对原有字段填充默认值。
- **数据补录流程**
  - 编写迁移脚本步骤：
    1. 遍历历史 `FxRate`，按照 `effectiveFrom` 生成对应 `FxSnapshot`（`capturedAt = effectiveFrom`）用于回填。
    2. 遍历 `IncomeRecord`：若已有 `fxRateId`，查找或生成快照，写入 `fxSnapshotId` 与 `fxAppliedRate`；若缺失则按 `monthDate` 获取快照并写入，同时记录缺失列表以便人工核查。
    3. `TxnEntry`/`TxnLine` 同理，使用 `occurredAt` 作为 `capturedAt`；若原先没有 `fxRateId`，则以账户币种与展示币种计算后落地快照。
    4. 对规则表字段批量填充默认币种（当前基础币种），`effectiveFrom` 使用原 `startDate`/`taxYear` 推导，`effectiveTo` 填 `NULL`。
  - 脚本执行过程中输出统计：补录成功条数、缺失 FX 列表、需要人工处理的边界数据。
- **回滚策略**
  - 所有新字段先以可空形式添加，脚本补录完成后再通过二次迁移将关键字段（如 `currency`、`effectiveFrom`）改为非空。
  - `fxSnapshotId` 在所有业务表完成补录并验证后，再移除旧的 `fxRateId` 字段；保留数据备份脚本，以便回滚时将 `fxSnapshot` 数据写回。
- **验证与测试**
  - 迁移执行后运行 `pnpm tsx prisma/seed.ts` 校验新种子；补充 `prisma/migrations/*/README.md` 记录迁移依赖与手工步骤。
  - 在 `src/tests` 新增迁移后回归用例：验证旧数据折算结果与迁移后保持一致，多币种样例（CNY→USD→CNY）累计字段从零重置。
  - 部署前准备演练脚本：在 staging 使用生产备份运行迁移，生成对账报告（迁前/迁后税额、净收入差异）。

### FX 快照影响业务表清单（基于当前 `prisma/schema.prisma`）

- `FxRate`：提供基础区间率，现有引用包括 `TxnEntry`, `TxnLine`, `ValuationSnapshot`, `IncomeRecord`；迁移后保留，成为 `FxSnapshot.sourceRateId` 的来源。
- `TxnEntry`（交易主表）与 `TxnLine`（明细）：字段 `fxRateId`、`exchangeRateAB`、`rateAtoUSD`、`rateUSDtoB` 需要被 `fxSnapshotId`、`fxAppliedRate` 替换或补充；相关 API 位于 `src/app/api/v1/entries/*`。
- `ValuationSnapshot`：目前通过 `fxRateId` 标记估值时间点，迁移后应引用 `fxSnapshotId` 并保留原币种估值。
- `IncomeRecord`：包含 `currency`、`sourceCurrency`、`fxRateId` 与对账字段，是收入域换算的主数据表；迁移后需新增 `fxSnapshotId`、`originalAmount` 等字段并更新 `src/server/services/income*`.
- `Account`、`User`：持有 `baseCurrency`，在展示币种/基础币种逻辑里需要重新界定作用，但不直接引用 `FxSnapshot`。
- 规则表 `CityRuleSS`、`CityRuleHF`、`TaxConfig`、`TaxBracket`：目前缺少 `currency` / `effectiveFrom` / `effectiveTo` 字段，迁移时需新增并补录，影响 `prisma/seed.ts` 与 `src/server/services/tax`.
- 其余带币种的业务表（`IncomeChange`, `BonusPlan`, `LongTermCashPlan`, `LongTermCashPayout`, `EquityGrant` 等）默认币种为 CNY，需要确认是否保留默认值还是迁移为原币种字段。

## 技术任务拆解

- **数据库与 Prisma**
  - 在 `prisma/schema.prisma` 新增 `FxSnapshot` 模型、规则币种字段、展示相关枚举；生成迁移并补充 `prisma/migrations/*/README.md`。
  - 编写分步迁移脚本：结构迁移 → 数据补录 → 约束收紧，附带回滚策略和统计输出。
  - 更新 `prisma/seed.ts`：填充多币种规则、`FxSnapshot` 样例、展示/基础币种默认值。
- **服务端逻辑**
  - `src/server/services/fx.ts`：实现 `ensureFxSnapshot`、历史快照读取、缺失补齐与告警。
  - `src/server/services/income*.ts`：替换现有 `fxRateId` 依赖，确保收入回算、时间线、报表使用快照；新增累计重置逻辑。
  - `src/server/services/ledger.ts`、`accounts-summary.ts`：使用快照换算，并兼容基础币种展示。
  - 新增后台任务 `rebaseDisplayAmounts`（可放 `src/server/services/tasks/rebase-display.ts`），负责基础币种调整后的异步重算。
  - 更新 `/api/settings`、`/api/v1/user/profile` 等 Route Handler，引入基础币种二次确认与 AuditLog。
- **前端改造**
  - `/settings` 页面：保留展示币种表单，新增基础币种二次确认弹窗、进度反馈组件（使用 `data-testid="settings-ui-base-currency-dialog"` 等）。
  - 收入、账户、报表模块：通过 SWR 读取快照数据，避免直接调用最新汇率；补充币种标签、跳转链接。
  - Zustand/SWR 状态：区分 `displayCurrency` 与 `baseCurrency`，统一触发刷新。
- **脚本与运维**
  - 编写一次性数据修复脚本（`scripts/backfill-fx-snapshots.ts`），执行迁移后补录历史快照。
  - 准备基础币种变更的异步任务监控，提供失败重试与告警。
- **测试与验证**
  - 新增 `src/tests/fx.service.test.ts`、`income.service.test.ts` 用例，覆盖快照生成、多币种回算、基础币种切换。
  - 更新现有 API/UI 测试期待值，确保 `fxSnapshotId` 字段回传正确。
  - 在 staging 演练迁移脚本，生成迁前/迁后对账报告并记录残留风险。

## 实施任务追踪

1. **数据层迁移准备**
   - 目标：完成 Prisma schema 更新、迁移脚本草案与 `seed` 示例改造，生成演练说明。
   - 产出：新的 schema/迁移文件、修订版 `prisma/seed.ts`、迁移演练文档。
2. **FX 服务与快照落地**
   - 目标：实现 `ensureFxSnapshot`、补齐转换流程、在收入/账户/估值服务中落地 `fxSnapshotId` 与 `fxAppliedRate`。
   - 产出：`src/server/services/fx.ts` 等服务更新、涉及 API 的改造、快照告警逻辑。
3. **规则管理改造**
   - 目标：前后端统一 `effectiveFrom/To` 与币种字段，更新城市/规则 API、配置页面、JSON 模板。
   - 产出：`/api/v1/cities`、`/rules/social-security|housing-fund` API 与页面更新、相关文档/示例刷新。
4. **基础币种二次确认流程**
   - 目标：实现 `/settings` 页弹窗确认、后台 API 与异步重算占位（含 AuditLog 和任务记录）。
   - 产出：设置页 UI、`/api/settings/base-currency`、重算任务骨架与警示文案。
5. **测试与文档收尾**
   - 目标：补充 Vitest 用例、更新文档索引及操作手册，验证示例数据回算。
   - 产出：新增/更新测试文件、`doc/` 相关章节、验收报告草稿。

## 技术任务拆解（基于当前代码库现状）

> 2025-02-18 扫描 `prisma/schema.prisma`、`src/server/services/*`、`src/app/api/v1/*`、`src/lib/api/*` 与主要 UI 模块后的初始拆解；后续执行过程中逐项更新勾选状态。

### 1. 数据库与种子

- [x] 新增迁移：确保 `FxSnapshot` 表结构与关联索引落库（当前 schema 已定义，但需迁移落地并在 README 记录顺序）。(2025-02-18 已生成 `20250218121000_multi_currency_fx_snapshots`)
- [x] 新增迁移：为 `TxnEntry`、`TxnLine`、`ValuationSnapshot`、`IncomeRecord` 增补 `fxSnapshotId`、`fxAppliedRate`、`fxEffectiveAt`、`sourceCurrency` 等字段，同时保持 `fxRateId` 作为兼容字段。
- [x] 回填脚本 `scripts/backfill-fx-snapshots.ts`：遍历上述业务表，依据已有 `fxRateId` 或发生时间调用 `ensureFxSnapshot`，写入 `fxSnapshotId`/`fxAppliedRate`。
- [x] 更新 `prisma/seed.ts`：同步为交易、估值、收入样例写入 `fxSnapshotId`、`fxAppliedRate`、`sourceCurrency`，并提供 USD↔CNY 2023–2025 示例快照。
- [ ] 数据验证：添加 `src/tests/db/fx-backfill.test.ts`（或合适位置），断言 seed 后所有跨币种记录具备快照引用。
- [ ] 迁移完成后清理：编写后续迁移移除业务表对 `fxRateId` 的依赖，并将历史值固化到 `FxSnapshot`。

### 2. 服务层

- [ ] `src/server/services/fx.ts`：补充缓存/批量接口，暴露 `ensureFxSnapshot` 的批处理能力，并在缺失速率时抛出可观测错误（含 AuditLog）。
  - [x] 捕获 `P2002` 并发冲突并回读已有快照（2025-02-18，修复转账 500）。
- [x] `src/server/services/ledger.ts`：复用 `ensureFxSnapshot`，在服务层转账/存款写入快照与 AuditLog（2025-02-18）。
- [ ] `src/server/services/income.ts`、`income-timeline.ts`：读取 `IncomeRecord.fxSnapshotId`，将累计/展示金额改为基于 `fxAppliedRate` 计算；替换所有对 `fxRateId` 的引用。
- [x] `src/server/services/accounts-summary.ts`、`ledger.ts`：统一在转账/存款/估值流程中落 `fxSnapshotId` 与 `fxAppliedRate`，并返回快照信息供前端展示。（2025-02-18）
- [ ] `src/server/services/tax.ts`、`rule.ts`：确保规则币种使用 `currency` 字段，并在计算中调用 FX 服务做币种转换。
- [ ] 新增 `src/server/services/tasks/rebase-display.ts`：接受基础币种变化任务，重算展示金额并写入 AuditLog。

### 3. API 层（Route Handlers）

- [ ] `/api/v1/entries/transfer`、`deposit`：完成 FX 快照回写、`fxRateId` 清理、错误码细化（当前 transfer 已部分落地，仍需补充失败日志）。
- [ ] `/api/v1/valuations`：改用 `fxSnapshotId` 和 `fxAppliedRate`，并允许传入 `asOf` 触发快照；移除 `fxRateId` 参数。
- [ ] `/api/v1/fxrates`：新增快照读取/补齐接口，以供前端展示历史换算。
- [ ] `/api/v1/rules/*`、`/api/v1/cities`：确保返回体带上 `currency`、`effectiveFrom/To`，并在写操作中校验币种。
- [ ] `/api/settings/base-currency`（新增）：封装基础币种修改逻辑，触发二次确认与 `rebase-display` 任务。
- [ ] `/api/v1/user/profile`：更新返回的 `baseCurrency` 描述文案，标注其为展示默认值，并附带最后确认时间。

### 4. 前端

- [ ] `/settings` 页面：拆分展示币种与基础币种表单，新增确认弹窗（`data-testid="settings-ui-base-currency-dialog"`）、风险提示及操作日志提示。
- [ ] `/settings`：引入基础币种修改进度提示（轮询任务状态），并在 SWR 中区分 `displayCurrency`/`baseCurrency`。
- [ ] `/income` 相关页面：复用 `IncomeAnalyticsPanel` 展示多币种明细，标注记录币种与快照来源。
- [ ] `/accounts`、`/entries/*`：为转账/存款表单显示快照明细，提示用户当前采用的 FX。
- [ ] Zustand `useUserPrefsStore`：拆分 `displayCurrency` 与 `baseCurrency`，提供重置逻辑，并与 `SWR` key 同步。

### 5. 测试与监控

- [ ] Vitest：新增 `fx.service.test.ts` 验证快照去重/补齐；`income.service.test.ts` 覆盖多币种累计预扣。
- [ ] API 测试：添加 `src/tests/accounts.api.test.ts` 检查转账接口返回 `fxSnapshotId`、`fxAppliedRate`。
- [ ] UI 测试：编写 `/settings` 流程测试，验证基础币种确认弹窗与失败提示。
- [ ] 监控：为 FX 快照缺失、基础币种重算失败设置告警（暂可记录在 `doc/tech.md`「运维」章节）。

### 6. 文档与发布

- [ ] 更新 `doc/tech.md` 与 `doc/frontend-spec.md`，反映多币种与快照方案。
- [ ] 在 `doc/README.md` 索引新增“多币种规则改造”章节，并链接本 issue。
- [ ] 准备迁移演练记录（时间线、回滚方案、影响评估），作为发布清单的一部分。
