# 系统边界与改造计划（5+1 切分）

目的：在保持当前单仓库开发模式下，把系统按职责划分为彼此松耦合、可独立演进的 5+1 个子系统。本文档基于当前仓库实际代码（`src/app` 前端页面、`src/app/api` 路由、`src/server/services` 服务以及 `prisma/` 模型）进行对照与可执行改造计划，给出阶段化的改造任务、具体文件/目录建议、Prisma 变更风险与验收标准，便于后续 PR 跟踪与 CI 校验。

## 文档导航

- 快速结论
- 当前仓库映射（精确对照）
- 边界与契约（工程规则）
- 改造目标与分阶段计划（文件/目录级建议）
- Prisma 与 Schema 注意事项
- 可观测性、回放与幂等
- 最小交付清单与验收指标
- 小步验证任务
- 跟踪与 PR 模板建议
- 决议：采用折中推荐方案
- 改造大步骤（逐 PR 执行）
- 后续可拆分 PR 任务清单
- 验收清单（PR 模板）
- 术语表（Glossary）
- 测试矩阵与覆盖范围
- 影响矩阵（样例）
- 回刷与审批 Runbook（FX 修正）
- 前提与假设 / 非目标

## 快速结论（1 段话）

将“账户/账本/估值”作为 Accounts & Ledger 内聚系统；把“收入/税务”作为独立的 Income & Tax 子系统；FX 作为时间序列数据源（只读），Reporting 作为读优化/聚合层，Identity & Audit 为横切关注点，Jobs/EventBus 负责调度与事件传递。重要原则：上游系统在写入业务数据时必须把当次使用的汇率/快照写入该业务记录；事件采用数据库 Outbox 模式保证可靠投递和可回放。

## 术语表（Glossary）

- FxRateSnapshot：不可变的历史汇率快照记录，包含 base、target、rate、timestamp、provider、rawJson 等。
- Outbox（EventOutbox）：出站事件表，保证业务写入与事件写入在同一事务内，供异步消费者可靠读取。
- Idempotency-Key：写操作的幂等键，用于去重与重试安全。
- RecalcTask（IncomeRecalcTask）：收入重算任务记录，队列/worker 用其编排执行与重试。
- TaxFxPolicy：税务汇率策略（例：paymentDate、yearEnd、annualAverage）。
- Tenant（租户）：本系统以“用户”为租户边界，除全局配置/市场数据/规则外，业务数据行均归属单一用户。
- UserProfile：用户的基本档案信息（如 locale、timezone、country、cityId 等），仅该用户和管理员可读写。
- UserSettings：用户偏好与全局设置项（如展示币种、税务策略等），集中在 `/settings` 页面维护。
- Impersonation（模拟登录）：管理员以受管用户身份进行操作，必须二次确认并写入 AuditLog。

## 1) 当前仓库映射（精确对照）

下面把每个子系统映射到当前仓库的文件/路由，以便一眼看出现状与迁移边界：

- Accounts & Ledger
  - 前端页面（RSC / React）：`src/app/accounts/*`（账户列表、账户详情 `/accounts/[id]`, 新建 `/accounts/new`）
  - API 路由（实际路径）：
    - `POST/GET /api/v1/accounts-ledger/accounts` -> `src/app/api/v1/accounts-ledger/accounts/route.ts`
    - `GET/PUT /api/v1/accounts-ledger/accounts/[id]` -> `src/app/api/v1/accounts-ledger/accounts/[id]/route.ts`
    - 子路由：`archive`、`summary`、`timeseries`、`transactions` -> `src/app/api/v1/accounts-ledger/accounts/[id]/*`
  - 交易入口：`src/app/api/v1/accounts-ledger/entries/{deposit,withdraw,transfer}/route.ts`
  - 估值路由：`src/app/api/v1/accounts-ledger/valuations/route.ts`
  - 服务实现位置：`src/server/services/ledger*` 系列（注意：当前仓库中服务可能分散于多个文件，重构建议见下文）
  - 重要 Prisma 表：`Account`, `TxnLine`, `ValuationSnapshot`, `AccountValuationCurve`（参见 `prisma/schema.prisma`）
  - 重要 Prisma 表（与当前 schema 对齐）：`Account`, `TxnLine`, `ValuationSnapshot`（曲线为由快照聚合得到的视图/查询结果，不是独立表）

- Income & Tax
  - 前端页面：`src/app/income/*`（包括 `recalc-status`、`salary-changes`、`overview` 等）
  - API 路由：`src/app/api/v1/income-tax/*`（records、recalc、overview、timeline、forecast、bonus、equity、ltc 等）
  - 服务实现位置：`src/server/services/income*`, `tax*`（仓库已有 `income` 相关服务与测试，详见 `src/tests`）
  - 重要 Prisma 表：`IncomeRecord`, `IncomeRecalcTask`, `TaxConfig`, `TaxBracket` 等

- FX & Market Data
  - 前端与路由：`src/app/api/v1/fx/rates/route.ts`、`/latest/route.ts`，页面层少量使用（例如账户估值或汇率显示）
  - 服务实现位置：`src/server/services/fx*`
  - 重要 Prisma 表（与当前 schema 对齐）：`FxRate`, `FxSnapshot`

- Reporting & Analytics
  - API 路由（当前轻量聚合）：`src/app/api/v1/reporting/*`（dashboard、income timeseries、accounts summary）
  - 前端页面：`src/app/dashboard/page.tsx`、各业务页嵌入的报表组件
  - 当前状态：以查询聚合为主，尚未采用物化视图或独立报表服务

- Identity & Audit
  - API 路由：`src/app/api/auth/[...better-auth]/route.ts`, `src/app/api/v1/identity/auth/me/route.ts`
  - 服务实现位置：`src/server/auth.ts`, `src/server/services/audit*`
  - 重要 Prisma 表：`User`, `AuthAccount`, `AuthSession`, `AuthVerification`, `AuditLog`

- +1 Jobs & Event Bus (平台)
  - 当前实现：部分异步逻辑和重算以本地任务/数据库任务表实现（见 `IncomeRecalcTask` 与 `src/server/services/*`），尚未统一队列实现
  - 建议位置：`src/server/services/jobs/*`（封装本地队列/出站 Outbox 与本地 consumer）

- Rules & Reference Data（规则与参考数据）
  - API 路由：
    - 规则：`/api/v1/income-tax/rules/tax/config`, `/api/v1/income-tax/rules/tax/brackets`, `/api/v1/income-tax/rules/social-security`, `/api/v1/income-tax/rules/housing-fund`
    - 地理/参考：`/api/v1/identity/countries`, `/api/v1/identity/cities`, `/api/v1/identity/city-changes`
  - 服务实现位置：`src/server/services/tax*`、与规则读取/校验相关的服务
  - 重要 Prisma 表：`TaxConfig`, `TaxBracket`, `City`, `CityRuleSS`, `CityRuleHF`, `CityChangeRecord`

## 用户与设置（领域定义与接口）

目标：明确“用户/租户”边界、用户档案与设置的归属、可读写范围与接口，确保各系统仅在“读取现有设置”的前提下运行，写操作集中于 `/settings`。

- 领域边界与归属
  - 单租户模型：每位用户为独立租户，其业务数据（Account、TxnLine、IncomeRecord 等）归属该用户；全局数据（TaxConfig/TaxBracket、CityRule、FxRateSnapshot）为平台级共享数据。
  - 访问控制：普通用户仅可访问自己数据；管理员可查看全量并支持模拟登录（Impersonation）。

- 用户属性建议（分层结构）
  - User（认证基础，better-auth 默认字段 + 项目扩展）：`id`, `email`, `emailVerified`, `name`, `image`, `createdAt`
  - UserProfile（档案，当前 schema 可映射为 User 的派生信息）：`locale`（如 zh-CN/en-US）、`timezone`、`countryCode`、`cityId`（当前城市规则绑定）、可选 `taxResidentCountry`
  - UserSettings（设置/偏好，集中在 `/settings`，当前实现部分字段在 `User` 上）：
    - 货币与统计：`displayCurrency`、`reportBaseCurrency`（如采用统一基准）、`reportStartDate`
    - 税务策略：`taxFxPolicy`（paymentDate|yearEnd|annualAverage）、专项附加扣除开关默认值
    - 其它偏好：主题、图表单位等（非核心）
  - AnnualDeductions（专项附加扣除）：按 PRD 字段维护（如子女教育、住房贷款等），对应 API 已存在。

- API 与页面（仓库现状）
  - API：`GET/PUT /api/v1/identity/user/profile`、`GET/PUT /api/v1/identity/user/annual-deductions`
  - 页面：`/settings`（集中维护设置项），其它页面只读或提供跳转。

实现现状与演进建议：
- 当前 schema 中 `User` 已包含 `displayCurrency` 与 `currentCityId`，可视为 UserSettings 的一部分（简单模型）。后续如需扩展/审计更强，可在不破坏兼容的前提下引入独立 `UserSettings` 表并在服务层做向后兼容映射。

- 事件与审计
  - 当用户更新 Profile/Settings/Annual Deductions 时，写入 `EventOutbox`（`user.profile.updated`、`user.settings.updated`、`user.annualDeductions.updated`）。
  - 模拟登录（Impersonation）需二次确认并写入 `AuditLog`（`auth.impersonation.started`/`ended`）。

- 安全与隐私
  - 最小化 PII 存储，仅保存业务所需字段；仅管理员与本人可读写；所有读取必须包含租户隔离（按 `userId` 过滤）。
  - 导出/敏感操作应写入 `AuditLog` 并可追溯到发起人。

### 租户与所有权映射（样例）

- userId 归属：`Account`, `TxnLine`, `ValuationSnapshot`, `IncomeRecord`, `IncomeRecalcTask`, `AnnualDeductions`。
- 平台级（无 userId 或多租户共享）：`FxRateSnapshot`, `FxSource`, `TaxConfig`, `TaxBracket`, `CityRuleSS/HF`。
- 管理/审计：`User`, `AuthSession`, `AuditLog`, `EventOutbox`（事件可带 userId）。

交易模型关系（对齐现有 schema）：
- 交易由 `TxnEntry`（头）与 `TxnLine`（明细）构成；两者可引用 `FxSnapshot`/`FxRate`，并记录 `fxAppliedRate`、`fxEffectiveAt` 等派生字段用于回溯与聚合。

要求：
- 服务层统一在数据查询时注入 `userId` 过滤（管理员模拟登录则使用“被模拟用户”的 userId），防止跨租户泄露。
- 其它系统读取用户设置时使用只读接口；写入统一由 `/settings` 页面与相关 API 完成。

## 2) 边界与契约（必须遵守的工程规则）

1. 只读依赖：上游系统可调用 `FX` 服务读取报价，但写入业务数据（交易/估值/收入）必须同时写入当次使用的汇率快照字段（例如 `fxEffectiveAt`, `baseToDisplayRate`, `baseToUsdRate`）。
2. 事件可靠化：对外事件首先写入数据库 `EventOutbox`（字段：`id,eventType,payload,topic,status,attempts,lastError,occurredAt,createdAt`），然后由独立 consumer 读取并投递；消费端实现幂等。Outbox 保证事务性写入（与业务写入同一 DB 事务内）。
3. 单向依赖：Reporting 只读上游，不回写；Jobs/EventBus 提供通用调度；Identity&Audit 负责审计所有敏感操作（模拟登录、人工回算、规则变更）。
4. 幂等与回放：外部写操作需支持 `Idempotency-Key`，事件带 `idempotencyKey` 与 `occurredAt` 以支持重放和去重。

## 3) 改造总体目标与分阶段计划（含具体文件/目录级建议）

总体思路：采用“小步快跑、保持兼容”的方式。第一阶段做最少改动以“内聚”服务边界（不改 schema 或在必须时添加最小 migration），将服务代码按子系统重组以便后续抽取；第二阶段实现共享平台（FX provider、Jobs/queue、Outbox consumer）；第三阶段完善 Reporting 与审计。

### 执行三步概览（优先顺序）

- **步骤一 · 结构梳理与基线稳定**：建立 `src/server/services/accounts-ledger/`、`income-tax/` 等子目录，迁移现有服务导出并同步更新路由及测试引用，确保 `pnpm test` 全绿，为后续功能迭代打基线。
- **步骤二 · 核心写路径补强**：在 `services/fx/` 下实现 provider，并统一写入端的 FX 快照；新增 `EventOutbox` 模型与 writer，将交易、收入等写路径和事件发布绑定到同一事务，补齐相应测试。
- **步骤三 · 异步与横切能力完善**：实现 `services/jobs/` 本地队列及 worker，将收入重算等长耗时逻辑改为异步；基于 Outbox 构建 reporting consumer，并在敏感操作中统一写入审计日志，完成端到端回放与监控闭环。

阶段 0：基线与验收（短，目标：保证当前测试通过并记录基线）

- 产出：
  - 生成 OpenAPI 草案（按子系统分组），放置 `doc/openapi.yaml`（可后续完善）
  - 在 `README.md` 或 `doc/` 记录当前关键测试通过基线（例如 `npm test` 全绿、`src/tests/income.prd-example.test.ts` 通过）
  - 简单 PRD 校验：基于 `doc/prd.md` 的示例数据复现收入回算结果（测试文件已存在于 `src/tests`）

- 操作（开发任务示例）：
  - 运行单元测试并记录失败项：`npm test`（或 `pnpm test`）
  - 检查 `prisma/schema.prisma` 中的表，确认 `IncomeRecord`, `TxnLine`, `FxRateSnapshot` 等存在

- 验收：CI 报告基线测试通过

阶段 1：Accounts & Income 内聚（低风险、可回滚）

- 目标：把相关服务代码按子系统目录化（尽量保持零功能改动），并补齐现有写路径对 FX 快照字段的使用验证，为后续 Outbox/异步改造打基线。

- 主要改动（代码级）：
  1. 在 `src/server/services` 下新增目录：
     - `src/server/services/accounts-ledger/`：包含 `accounts.ts`, `ledger.ts`, `valuations.ts`, `transactions.ts`（把现有实现逐步迁移到这里，导出统一 API）
     - `src/server/services/income-tax/`：包含 `income.ts`, `recalc.ts`, `tax.ts`, `timeline.ts`
  2. 逐条核对交易、估值、收入写路径，确认 `TxnLine`/`IncomeRecord` 已落库的 `fxSnapshotId`、`fxAppliedRate`、`fxEffectiveAt` 等字段；补充缺失的写入逻辑与回归测试，默认不引入新的 Prisma migration，如确需新增字段改为独立 PR。
  3. 保持 API 路由行为不变（`src/app/api/v1/*` 仅更新内部依赖路径），同步调整测试引用与类型导出，确保 `pnpm test` 仍然通过。

- 测试与验收：
  - 单元测试：更新/新增测试覆盖移动后的服务导出（在 `src/tests` 添加/更新对应测试）。
  - 集成测试：确保 `npm test` 全绿，重点测试：`income.prd-example.test.ts`, `income.service.test.ts`, `entries` 相关测试。 
  - 验收条目：新增或现有的 `TxnLine` 与 `IncomeRecord` 在 DB 中包含 `fxSnapshot` 字段；API 返回字段不变（向后兼容）。

阶段 2：写路径补强与基础平台（中等风险）

- 目标：在阶段 1 的目录化基础上，补齐 Outbox 与队列等横切能力，并将 FX 调用封装为可复用 provider，为长耗时任务迁移到异步流程做准备。

- 主要改动（代码级）：
  1. 新增 `EventOutbox` Prisma 模型与 `src/server/services/outbox.ts` writer，将交易、收入等核心写路径的事件持久化到 Outbox（与业务写入同一事务）；对应 migration 需单独评审风险，并提供 backfill/回滚方案。
  2. 在 `src/server/services/fx/` 中实现 `provider.ts`，导出 `getQuote`, `getLatest`, `getTimeSeries` 等接口，并集中处理缓存策略；现有路由与服务改为依赖 provider。
  3. 在 `src/server/services/jobs/` 中实现轻量 queue：`queue.ts`（抽象接口）、`local-worker.ts`（本地 consumer），并规划部署形态（如：Next.js 以独立 Node 进程运行 worker、或使用外部队列服务）。
  4. 把 `IncomeRecalcTask` 的触发从同步改为：路由写入任务记录 + 向 queue 入队，由 worker 拉取并执行 `recalcIncome`；补充失败重试与死信策略。

- 测试与验收：
  - 单元测试覆盖 FX provider 的核心方法（`fx.service.test.ts` 扩展为 provider 行为测试）。
  - Outbox 写入/读取测试：验证与业务写入同事务落库、重复提交幂等。
  - 本地 queue 的 end-to-end：在测试中 enqueue 一个 `income-recalc`，worker 执行并写回 `IncomeRecalcTask` 的状态；CI 增加该集成测试。

阶段 3：Reporting、Audit、事件投递完善（高价值、长期）

- 目标：用 EventOutbox 驱动 Reporting 的物化视图，强化 AuditLog、事件schema 与监控告警。

- 主要改动（代码级）：
  1. 在 `src/server/services/reporting/` 中实现 consumer scaffold：`outbox-consumer.ts`，将事件异步写入 `ReportDataset` 或直接更新物化表，并明确 consumer 的运行形态（复用队列进程或独立 worker）、失败重试与监控指标。
  2. 在 `src/server/services/audit/` 中统一审计接口：`audit.log(action, meta)`，所有敏感路由（如管理员模拟登录、人工调整、规则变更）必须调用并写入 `AuditLog`，并在必要时产出 Outbox 事件以供异步消费。
  3. 增加报表物化表/索引与相应 migration，优化 `reports` 相关 API 性能。

- 测试与验收：
  - 报表延迟与一致性验证测试（Outbox 写入 -> consumer 处理 -> reports API 返回物化结果）。
  - 审计记录覆盖关键操作（测试中断言 AuditLog 有条目）。
  - 运行指引：文档化 consumer/worker 的启动方式、健康检查与监控报警配置。

## 4) Prisma 与 Schema 注意事项

- 最佳实践：尽量把 schema 变更拆成小迁移，每次 PR 附带：Prisma migration、`prisma/seed.ts` 更新（如需要）、以及至少一个针对迁移后行为的测试。
- 必要字段与模型（与现有 schema 对齐/或增补建议）：
  - FX 快照：使用 `FxSnapshot`（当前已存在）并优先引用其 `id`；如需保留原始响应，考虑在 `meta/raw` 类字段序列化存储。
  - 交易/收入派生字段：`TxnLine.fxSnapshotId`, `TxnLine.fxAppliedRate`, `TxnLine.fxEffectiveAt`，`IncomeRecord.fxSnapshotId`, `IncomeRecord.fxAppliedRate`（schema 已有）。
  - 事务外发布：`EventOutbox`（建议增补）。
  - 审计：`AuditLog`（当前已存在）。
  - 幂等：`IdempotencyKey`（当前已存在）。

## 5) 可观测性、回放与幂等

- 日志：业务写入、Outbox 写入、worker 执行、重试与死信都必须记录日志（标准化字段：requestId, userId, taskId/eventId）。
- 回放：Outbox 支持按时间/类型筛选并重新投递；consumer 需实现去重逻辑。

## 6) 最小交付清单（阶段 1 完成时）

1. `src/server/services/accounts-ledger/` 与 `src/server/services/income-tax/` 目录与导出接口建立完成（仅做代码移动和依赖调整）。
2. 交易、估值、收入写路径均验证会写入 `fxSnapshotId`、`fxAppliedRate`、`fxEffectiveAt` 等已有字段，并补充对应回归测试记录验证结果（无需新增 Prisma migration）。
3. 路由（`src/app/api/v1/*`）保持不变但内部改为调用新的服务导出接口；相关测试与类型更新同步完成。
4. CI: `npm test`（或 `pnpm test`）能跑通关键集成测试：`income.prd-example.test.ts`、`entries` 和 `valuations` 相关测试，并在 PR 描述记录验证步骤。

## 7) 验收与衡量指标（量化）

- 功能正确性：关键测试（如 `src/tests/income.prd-example.test.ts`, `src/tests/entries.*.test.ts`）通过，且 CI 无回归。
- 回溯性：任意历史 `TxnLine`/`IncomeRecord` 可通过包含的 `fxSnapshot` 重现原始净值与税务计算。
- 可运维性：队列失败任务进入死信（DB 或 Redis），Outbox 重试次数和上次错误信息可查。 
- 文档齐全：`doc/openapi.yaml`、`doc/system-boundary-plan.md` 与 `doc/prd.md` 的示例互相验证。

## 8) 小步验证任务（供下一次 PR 使用）

以下为低风险、可以在短时间内验证的任务清单（每项可做成单个 PR）：

1) 在 `src/server/services` 下新增 `accounts-ledger` 目录并移动一个现有服务（如 accounts list），确认导出保持不变（目标耗时：半天）。
2) 为交易/收入写路径补充 FX 快照字段的断言测试（`entries`、`income`、`valuations` 等），记录测试输出用于基线对比（目标耗时：1 天）。
3) 整理基线验证脚本/文档，明确 `pnpm test` 与收入回算示例的操作步骤（目标耗时：半天）。
4) 新增 `EventOutbox` Prisma 模型 + migration，并编写一个单元测试验证写入/读取（目标耗时：1 天，进入阶段 2 前置任务）。
5) 为 `IncomeRecalcTask` 添加一个本地 worker 测试，模拟 enqueue -> worker 执行 -> 更新 task 状态（目标耗时：1–2 天，阶段 2）。

## 9) 跟踪与 PR 模板建议（便于验收）

每个变更 PR 建议包含：

- 标准标题（Conventional Commits）：`feat(accounts): move ledger services to src/server/services/accounts-ledger`
- 变更概要：短要点列出改动文件/目录、是否包含 Prisma migration、是否存在数据库后向兼容风险。 
- 测试项：列出必须通过的本地/CI 测试名（例如 `income.prd-example.test.ts`）。
- 验收步骤：如何在本地验证（例如 curl 调用或 UI 操作序列）。

---

完成度说明：本文档已根据仓库中实际存在的 `src/app` 前端页面和 `src/app/api` 路由进行对照与修正，加入了更具体的代码级迁移建议与可执行的小步任务，便于按阶段推进改造。后续我可以根据你选择的优先级把其中某一小任务（例如新增 `EventOutbox` model 并创建 migration 与测试）实现为 PR。 

## 决议：采用折中推荐方案（已采纳）

团队决议：采用上文中的“折中推荐”实践——业务记录保存原币与关键派生值（或引用不可变 `FxRateSnapshot`），FX 系统保持历史快照且以不可变记录/追加修正的方式管理历史汇率。展示与性能需求通过物化快照（daily/hourly）满足；修正通过受控的回刷流程（Jobs + AuditLog）实现。下面把改造大步骤与后续任务按更细粒度列出，便于分 PR 实施与 CI 验收。

## 改造大步骤（详细任务拆分，供逐 PR 执行）

下列每一项建议做成独立 PR（小步、易回滚），每个 PR 包含变更说明、是否含 Prisma migration、影响的测试用例和本地验收步骤。

阶段 0（基线，已完成/短期）
- 任务 0.1：生成 `doc/openapi.yaml` 草案，按子系统分组（文档 PR）。验收：PR 描述包含按子系统列出的主要 API。

阶段 1（结构与基线校验，优先级高）
- 任务 1.1（PR-001）：在 `src/server/services` 下创建目录：`accounts-ledger/`、`income-tax/`（仅移动导出接口，不改变逻辑），并把对应服务逐步导出统一接口。
  - 测试：相关单元测试仍通过（更新引用路径）。
  - 验收：路由 `src/app/api/v1/*` 无需变更，服务导入处更新为新路径且 CI 通过。

- 任务 1.2（PR-002）：梳理交易、估值、收入等写路径，确保会写入现有的 `fxSnapshotId`、`fxAppliedRate`、`fxEffectiveAt` 等字段；对缺失场景补充逻辑与测试（不引入新的 Prisma migration），并将验证结果记录到 PR 描述。
  - 测试：补充/更新 `src/tests/entries.*.test.ts`, `src/tests/income.*.test.ts`, `src/tests/valuations.*.test.ts` 等用例，断言写入字段及幂等行为。
  - 验收：关键写路径都有覆盖测试，重复执行写操作结果一致，数据库字段保持现有 schema。

- 任务 1.3（PR-003）：整理基线文档与脚本，记录 `pnpm test`、收入回算示例（`doc/prd-income.md`）的复现步骤，并在 `doc/README.md` 或该文档附注基线结果，便于后续改造对比。
  - 测试：无代码变更；重点在文档与脚本复用。
  - 验收：文档明确基线测试命令及预期输出（如关键断言的截图/日志节选）。

阶段 2（Jobs、Outbox 与回刷，优先级中）
- 任务 2.1（PR-004）：新增 `EventOutbox` Prisma 模型并实现 minimal outbox writer（`src/server/services/outbox.ts`），在关键写入点伴随业务写入向 Outbox 写事件（同一事务）。Migration 需评估数据兼容性，并在 PR 中包含 backfill/回滚指引。
  - 测试：Outbox 写入与读取单元测试。
  - 验收：写业务数据时 Outbox 有对应事件记录。

- 任务 2.2（PR-005）：实现本地 queue 与 worker（`src/server/services/jobs/queue.ts`, `local-worker.ts`），并实现 `income-recalc` 的 enqueue/worker 执行逻辑（worker 读取 `IncomeRecalcTask` 表并调用 `income-tax.recalc`）。在 PR 中说明运行方式（独立 Node 进程/pm2/或 CI script）及故障告警策略。
  - 测试：E2E 测试 enqueue -> worker 执行 -> 更新 task 状态。
  - 验收：长耗时任务由 worker 执行，路由改为写任务记录并 enqueue，部署指引清晰。

- 任务 2.3（PR-006）：在 `src/server/services/fx/provider.ts` 中集中封装 FX 报价/缓存逻辑，现有 `convert` 等函数改为调用 provider；同步更新调用方（包括路由、服务、测试）。
  - 测试：扩展 `src/tests/fx.service.test.ts`、新增 provider 单元测试，确保缓存策略与降级逻辑可测。
  - 验收：FX 相关路由与服务通过 provider 统一访问，缓存失效策略有测试覆盖。

阶段 3（Reporting 与审计完善，优先级中低）
- 任务 3.1（PR-007）：实现 `src/server/services/reporting/outbox-consumer.ts`，消费 Outbox 事件，更新/构建 `ReportDataset` 或物化表。明确 consumer 的部署方式（同队列进程/独立 worker）与监控指标。
- 任务 3.2（PR-008）：实现 `src/server/services/audit/audit.ts`，并在管理员/敏感操作写入 `AuditLog` 与 Outbox 事件，完善审计链路。

## 后续可拆分 PR 任务清单（可直接引用到 PR 描述）

优先级高（立即）：
- PR-001：服务目录化
  - Files: `src/server/services/accounts-ledger/*`, `src/server/services/income-tax/*`（move & re-export）
  - Tests: update import paths in `src/tests/*`

- PR-002：写路径 FX 快照校验
  - Files: `src/server/services/ledger.ts`（或拆分后的 `accounts-ledger/*`）、`src/server/services/income-tax/*`, `src/tests/*`
  - Tests: 扩充 `entries`、`income`、`valuations` 相关测试断言 `fxSnapshotId`、`fxAppliedRate` 等字段
  - Local verify: 记录 `pnpm test` 输出与示例数据校验结论

- PR-003：基线脚本与文档
  - Files: `doc/README.md`（或新增 `doc/baseline.md`）、脚本目录
  - Tests: 无；需在 PR 描述附带基线验证日志

中期优先：
- PR-004：EventOutbox model + writer
  - Files: `prisma/schema.prisma` migration, `src/server/services/outbox.ts`, hook into write paths
  - Tests: `src/tests/outbox.test.ts`

- PR-005：Local queue + income-recalc worker
  - Files: `src/server/services/jobs/*`, modifications to `src/app/api/v1/income-tax/recalc/route.ts`
  - Tests: `src/tests/income.recalc-task.service.test.ts`
- PR-006：FX provider 抽象与路由改造
  - Files: `src/server/services/fx/provider.ts`, `src/server/services/fx.ts`, `src/app/api/v1/fx/rates/*`, 以及调用方
  - Tests: `src/tests/fx.service.test.ts`, 新增 provider 缓存与降级测试

低优先（后续优化）：
- PR-007：Outbox consumer -> Reporting dataset
- PR-008：审计封装 + 管理员敏感操作挂钩

## AI 执行手册（近期任务指引）

- **步骤 1：服务目录化（PR-001）** 使用 `mkdir -p src/server/services/accounts-ledger src/server/services/income-tax` 创建目录，移动 `ledger.ts`、`accounts-summary.ts`、`income.ts`、`tax.ts` 等文件至对应目录并保持导出不变，更新 `src/app/api/v1/*` 与 `src/tests/*` 导入路径，执行 `pnpm test --filter "accounts"` 与 `pnpm test --filter "income"` 并在 PR 描述记录命令与摘要结果。
- **步骤 2：写路径 FX 快照校验（PR-002）** 审核 `accounts-ledger/*` 与 `income-tax/*` 写入逻辑确保 `fxSnapshotId`、`fxAppliedRate`、`fxEffectiveAt` 会在事务中落库，必要时调用 `ensureFxSnapshot` 补写字段，扩展 `entries`、`income`、`valuations` 测试断言 FX 字段，运行 `pnpm test` 并将关键断言输出写入 PR 描述；若发现需要修改 Prisma schema，应终止此步骤并转入新的 migration PR。
- **步骤 3：基线脚本与文档（PR-003）** 在 `doc/README.md` 或新建 `doc/baseline.md` 记录回归命令（`pnpm test`、`pnpm lint`、`pnpm tsx prisma/seed.ts`、收入回算脚本等），提供 `doc/prd-income.md` 示例数据复现步骤与预期断言，将执行结果写入文档列表，并更新 PR 模板“本地验证”小节引用该文档。
- **步骤 4：EventOutbox 与队列（PR-004/PR-005）** 通过 `pnpm prisma migrate dev --name add_event_outbox` 新增模型并实现 `src/server/services/outbox.ts`，在写路径事务中调用 `outbox.write` 并补充 `src/tests/outbox.test.ts`，开发 `jobs/queue.ts` 与 `local-worker.ts` 并在 `package.json` 增加 `pnpm worker` 脚本，新增 enqueue→worker→任务完成的端到端测试，更新文档说明 worker 启动方式、重试策略与监控指标。
- **步骤 5：FX Provider 与 Reporting/Audit（PR-006+）** 抽象 `src/server/services/fx/provider.ts` 并让路由与服务统一使用 provider，扩展 `src/tests/fx.service.test.ts` 覆盖缓存、降级与快照回放，实现 `reporting/outbox-consumer.ts` 与 `audit/audit.ts` 并文档化部署方案，针对 `/admin` 敏感操作补充审计日志与 Outbox 事件，并新增对应测试验证。

## 验收清单（可用于 PR 模板）

每个 PR 请在描述中列出下列核验项（CI 必需通过）：

- 是否包含 Prisma migration（若包含请在 PR 描述提供 migration 名称与变更简述）。
- 单元/集成测试（列出受影响的测试文件名）。
- 本地运行步骤（至少提供一条 curl 或 UI 验证流程）。
- 数据兼容性说明（是否新增 nullable 字段、是否需要 backfill、是否会影响现有数据）。

---

我已把折中方案写入并把改造步骤细化为可拆分 PR 任务清单。下一步我会把 todo 列表同步更新以反映这些任务（把第 2 项标为已完成，生成跟踪清单与验收条目与建议小步任务设为进行中），或如果你同意，我可以直接开始实现 PR-001（服务目录化与引用更新）。

## 测试矩阵与覆盖范围（补充）

- 服务层（src/server/services/*）：
  - 覆盖目标：核心计算与写路径 ≥ 80% 语句覆盖。
  - 必测用例：
    - 历史复现：写入包含 fxSnapshot 的交易/收入记录后，即便 FX Provider 返回不同值，也能基于保存的快照重现相同结果。
    - 幂等：相同 Idempotency-Key 重试不产生重复记录或不同快照。
    - Outage：FX/Jobs 不可用时的降级/错误行为一致且可观测。

- 路由层（src/app/api/v1/*）：
  - 覆盖目标：关键写入路由均有 happy path + 校验失败 + 异常回滚测试。
  - 关键测试文件参考：`src/tests/income.prd-example.test.ts`, `src/tests/income.service.test.ts`, `src/tests/entries.*.test.ts`, `src/tests/fx.service.test.ts`。

- 集成与端到端：
  - migration 后启动最小数据集，执行 recalc、entries、valuations 的端到端路径；断言结果与 PRD 示例一致。

## 影响矩阵（样例）

- /api/v1/accounts-ledger/entries/deposit|withdraw|transfer → services: ledger/transactions → tests: `src/tests/entries.*.test.ts`
- /api/v1/income-tax/recalc → services: income-tax/recalc + jobs/queue → tests: `src/tests/income.recalc-task.service.test.ts`
- /api/v1/fx/rates/* → services: fx/provider → tests: `src/tests/fx.service.test.ts`
- /api/v1/reporting/* → services: reporting/outbox-consumer（后续） → tests: `src/tests/reports.*.test.ts`
- /api/v1/income-tax/rules/* → services: tax/* + rules readers → tests: `src/tests/rules.api.test.ts`
- /api/v1/country|countries, /api/v1/identity/cities → services: reference data → tests: `src/tests/city-changes.api.test.ts`（城市相关）
- /api/v1/identity/city-changes → services: city changes + income recalculation impact → tests: `src/tests/city-changes.api.test.ts`
- OpenAPI 契约 → 文档：`doc/openapi.json`（按子系统分组），测试：`src/tests/openapi.contract.test.ts`，在变更接口时需同步更新契约文件并确保测试通过。

（建议在实施过程中逐步完善为完整矩阵）

## 回刷与审批 Runbook（FX 修正）

目标：当发现历史汇率需要修正时，保证有序、可审计、可回滚地更新受影响的数据与报表。

1) 发起与审批
- 发起人提交“修正申请”：说明时间范围、货币对、修正原因、影响评估。
- 审批人（管理员/合规）在系统中审批并记录到 `AuditLog`。

2) 准备与 Dry-Run
- 在 FX 系统新增 correction 的 `FxRateSnapshot`（不可覆盖历史，使用追加版本）。
- 运行回刷 Job 的 dry-run：扫描受影响的业务/快照，输出影响清单与预计变更摘要。

3) 执行回刷
- 由 Jobs/worker 分页回刷物化快照或生成 correction entries；并将关键事件写入 `EventOutbox`。
- 并发与限速：设置批大小、并发数、重试策略与死信队列。

4) 验证与发布
- 比对前后报表差异（关键 KPI 与样本明细）。
- 记录 `AuditLog` 与发布记录；必要时通知相关使用方。

5) 回退
- 若验证失败：停止 Job，回滚到上一次物化快照版本或使用备份数据，记录原因并生成 post-mortem。

## PR 模板（可复制）

```
标题: feat(scope): concise summary (≤ 72 chars)

变更类型
- [ ] feat
- [ ] fix
- [ ] refactor
- [ ] docs
- [ ] chore

包含 Prisma migration
- [ ] 否
- [ ] 是：名称 `2025xxxx_xxx`，变更概述：

变更概要
- 主要改动文件/目录：
- 业务行为是否改变：是/否（若是，说明兼容策略）
- 数据兼容性：新增 nullable 字段/无需 backfill/需要 backfill（说明策略）

测试与验证
- [ ] 单元测试通过（列出关键测试文件）：
- [ ] 集成/E2E 通过（列出关键测试文件）：
- [ ] 本地验证步骤（curl/UI 流程）：

风险与回退
- 风险点：
- 回退步骤：

相关文档
- 关联的设计/计划文档链接：
```

## 前提与假设 / 非目标

前提与假设
- 全局设置（基准币种、展示币种、城市、税务规则等）在 `/settings` 页面统一维护，其它页面仅读取现有配置或提供跳转入口。
- FX 系统保存不可变的历史快照；修正通过追加 snapshot 而非覆盖。
- 服务层暴露统一接口，路由层只做校验与错误处理。

非目标
- 本阶段不拆分为多仓库/多服务部署，依旧保持单仓库、按模块内聚的代码组织。
- 不在阶段 1 引入外部队列（如 Redis/BullMQ），先实现本地队列与 Outbox，后续再演进。

## 关键用例测试（每系统）

本节列出“最小但关键”的测试用例清单。若这些用例全部通过，整体系统逻辑基本可用并具备回溯与可运维能力。用例对应现有或建议的测试文件，优先在现有测试文件中补充。

### Accounts & Ledger

必测用例
- 跨币种转账写入 fx 快照（Happy path）
  - 场景：A(EUR) → B(USD) 转账 100 EUR，指定交易发生时间；调用 FX provider 取当时汇率。
  - 断言：`TxnLine` 含 `fxEffectiveAt`、`baseToDisplayRate`（或 `fxSnapshotId`）；借贷两边金额与汇率匹配；账户余额变动正确。
  - 文件：`src/tests/ledger.routes.test.ts` 或 `src/tests/accounts.api.test.ts`

- 幂等存款（Idempotency-Key）
  - 场景：同一 `Idempotency-Key` 对同一账户发起两次 deposit。
  - 断言：仅生成一条 `TxnLine`；第二次返回 2xx/409（按约定）但不重复写入。
  - 文件：`src/tests/ledger.routes.test.ts`

- 归档账户禁止交易
  - 场景：把账户标记为 archived，尝试再发起交易。
  - 断言：返回 4xx（如 409/400），数据库无新增 `TxnLine`。
  - 文件：`src/tests/accounts.service.test.ts`

- 估值快照写入与曲线生成
  - 场景：对账户触发估值写入，含跨币种估值。
  - 断言：`ValuationSnapshot` 写入 fx 快照或 `fxSnapshotId`；`AccountValuationCurve` 曲线点数量与时间戳正确。
  - 文件：`src/tests/valuations.routes.test.ts`

- 权限隔离
  - 场景：用户 U1 尝试访问 U2 的账户详情或交易。
  - 断言：返回 403/404；无数据泄露。
  - 文件：`src/tests/accounts.api.test.ts`

### Income & Tax

必测用例
- PRD 示例（1–3 月回算）
  - 场景：使用 `doc/prd-income.md`/seed 数据回算 1–3 月。
  - 断言：社保=2103、公积金=2400、`taxableCurrent/taxableCumulative/taxCumulative/taxPaidCumulative/netIncome` 与示例一致；多次回算结果一致（幂等）。
  - 文件：`src/tests/income.prd-example.test.ts`

- 工资变更当月生效 + 同月多次取最后一次
  - 场景：同月内多次变更工资，检查当月计算采用最后一次。
  - 断言：各字段一致性正确，累计预扣不倒挂。
  - 文件：`src/tests/income.service.test.ts` 或 `src/tests/income.routes.test.ts`

- 奖金/长期现金/股权激励的累计预扣
  - 场景：同年内混合发放，检查累计预扣规则、专项附加扣除与城市上下限 clamp。
  - 断言：累计字段单调、跨月对账一致；医保固定额与附加扣除被正确计入。
  - 文件：`src/tests/income.service.test.ts`, `src/tests/tax.service.test.ts`

- 年度税务策略（TaxFxPolicy）
  - 场景：对同一年度，使用 `paymentDate` 与 `yearEnd`（或 `annualAverage`）两种策略计算。
  - 断言：两策略结果稳定且符合预期差异；策略选择被记录到收入记录或报表。
  - 文件：`src/tests/tax.service.test.ts`

- 重算任务队列（阶段 2 生效）
  - 场景：提交 `IncomeRecalcTask`，worker 执行并更新状态。
  - 断言：`status: queued -> running -> completed/failed`；幂等重试不重复入队。
  - 文件：`src/tests/income.recalc-task.service.test.ts`

### FX & Market Data

必测用例
- 时间点报价与不可变快照
  - 场景：`getQuote(base,target,at)` 返回 `snapshotId` 与 `rate`。
  - 断言：同一 `base/target/at` 返回相同 `snapshotId`；新增 correction 产生新的 `snapshotId`，不影响已引用老快照的业务记录。
  - 文件：`src/tests/fx.service.test.ts`

- 最新报价与时间序列
  - 场景：`/api/v1/fx/rates/latest` 与 `getTimeSeries`。
  - 断言：latest 返回最近的 snapshot；timeSeries 返回时间序列（允许缺口，按设计处理 null/缺失）。
  - 文件：`src/tests/fx.service.test.ts`

- 缓存与降级
  - 场景：provider 不可用时的缓存命中或错误处理。
  - 断言：按策略返回缓存/报错；记录告警日志。
  - 文件：`src/tests/fx.service.test.ts`

### Reporting & Analytics

必测用例
- Dashboard 汇总的正确性
  - 场景：生成若干交易与收入，触发估值。
  - 断言：`/api/v1/reporting/dashboard` 返回的净资产/收入等汇总与基于 `TxnLine/IncomeRecord` 的快照一致（使用业务快照汇率，不使用实时 FX）。
  - 文件：`src/tests/reports.api.test.ts` 或 `src/tests/reports.routes.test.ts`

- 收入时序的准确性
  - 场景：多月收入、奖金混合。
  - 断言：`/api/v1/reporting/income/timeseries` 中每月净收入等于对应 `IncomeRecord` 聚合。
  - 文件：`src/tests/reports.api.test.ts`

- Outbox → 物化视图更新（阶段 3 生效）
  - 场景：写业务数据->Outbox 产出->consumer 更新报表表。
  - 断言：报表在消费后与源数据一致；延迟在配置阈值内。
  - 文件：`src/tests/reports.api.test.ts`

### Identity & Audit

必测用例
- 用户信息与鉴权
  - 场景：登录后访问 `/api/v1/identity/auth/me`。
  - 断言：返回用户 profile；未登录返回 401。
  - 文件：`src/tests/user.profile.api.test.ts`

- 敏感操作审计（阶段 3）
  - 场景：管理员修改规则或模拟登录。
  - 断言：写入 `AuditLog`（action、userId、occurredAt、meta）；普通用户无权操作。
  - 文件：`src/tests/rules.api.test.ts` + 新增 `audit.*.test.ts`（如需）

### Jobs & Event Bus

必测用例（阶段 2）
- 入队与执行
  - 场景：`enqueue('income-recalc')` 后 worker 执行。
  - 断言：任务状态流转、结果落库；失败进入重试/死信。
  - 文件：`src/tests/income.recalc-task.service.test.ts`

- Outbox 投递顺序与去重
  - 场景：写多条业务事件与重复事件。
  - 断言：consumer 按顺序消费，并对重复事件幂等处理。
  - 文件：`src/tests/outbox.test.ts`（建议新增）

---

执行建议：优先补强已有测试文件中的断言，避免重复创建新文件；对阶段 2/3 相关用例先标注为 pending/skip，并在相应阶段启用。
