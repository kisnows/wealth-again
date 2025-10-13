# 技术设计文档（对齐 2025Q1 PRD）

## 1. 系统总览
- 技术栈：Next.js 15 App Router（TypeScript）、NextAuth、Prisma（SQLite dev → Postgres prod）、Tailwind CSS + shadcn/ui、SWR、Zustand、Vitest。
- 架构分层：
  - 前端：`src/app` 负责路由与页面，`src/components` 存放 UI 组件，`src/lib` 管理客户端 API、状态和领域工具。
  - 服务端：`src/server` 提供 Prisma 单例、NextAuth 设置与领域服务（ledger、income、tax、fx、report、rule、audit）。
  - API 层：使用 Next.js Route Handlers（`src/app/api/**`）对外提供 RESTful 接口。
  - 数据层：Prisma schema covering accounts、transactions、income、rules、audit、impersonation。
- 关键目标：支持 PRD 中的五大场景（总览、收入管理、账户、税务社保、用户设置）以及管理员模拟登录与人工调整。

```
+---------------------------+         +-------------------------------+
|        Next.js UI         | <-----> |     /app/api Route Handlers   |
|  (Dashboard/Income/etc.)  |         |  Auth Guard + DTO Validation  |
+------------+--------------+         +---------------+---------------+
             |                                            |
             v                                            v
     +-------+------------------+                +--------+---------+
     |  Domain Services         |                | Prisma Repos     |
     | (ledger/income/tax/...)  |                | (SQLite/Postgres)|
     +-------+------------------+                +--------+---------+
             |                                            |
             v                                            v
       外部依赖：FX 快照、配置导入等（目前均为内部管理，无第三方实时接口）
```

## 2. 前端架构总览
- App Router 负责页面与布局装配，Server Component 承担骨架渲染，Client Component 结合 SWR 提供实时数据刷新。
- 数据访问统一通过 `src/lib/api/*` 暴露的 fetch/SWR 封装，跨模块状态由 `src/lib/state/*` 中的 Zustand store 管理。
- UI 层依赖 shadcn/ui 与 Tailwind；跨页面复用组件沉淀在 `components/modules/*`，页面级结构与交互详见 `doc/ui-routing.md`。
- 收入域的概览与报表均复用 `IncomeAnalyticsPanel`，该组件统一封装时序查询、汇总卡片、图表与明细表，避免多处实现导致口径偏差。
- 全局设置（基准币种、展示币种、统计日期、城市、税务规则等）只能在 `/settings` 内触发写操作；其它页面仅通过 `useUserPrefsStore` 或 `useCurrentUser` 读取。
- 表单、校验、图表等前端实现规范集中在 `doc/frontend-constraints.md`，该文档是前端实现的单一事实来源。

> 本章节提供架构脉络，具体约束（文件划分、表单规范、SWR key 策略等）请以 `doc/frontend-constraints.md` 为准。

## 3. 身份认证与权限
- 认证通过 NextAuth（`src/server/auth.*`）；数据库记录用户角色 `role: "USER" | "ADMIN"`。
- 守卫逻辑：
  - API Route Handler 通过 `getServerSession` 获取当前用户；若存在 `impersonatedUserId` 则切换上下文但保留 `actorId`。
  - 客户端钩子 `useSessionUser` 仅返回当前视角用户 data，同时暴露 `actorId` 以标记管理员操作。
- 管理员模拟登录流程：
  1. 管理员在管理后台选中用户触发 `/api/admin/impersonate`。
  2. 服务端生成 `ImpersonationSession` 记录（包含 `adminId`、`userId`、`expiresAt`）。
  3. 会话 Cookie 更新，前端刷新后以目标用户身份运行；顶部展示“管理员模式”提示。
  4. 退出模拟调用 `/api/admin/impersonate/end`，清理记录。
- 审计：所有管理操作（模拟登录、规则修改、删除记录等）写入 `AuditLog`，字段包含 `actorId`、`asUserId`、`action`、`payload`。

## 4. 服务端分层
- `src/server/services`
  - `ledger.ts`：账户、交易、估值、跨币种转账与收益计算。
  - `fx.ts`：汇率快照 CRUD、USD 中间价折算、批量获取各币种最新快照。
  - `income.ts`：收入回算、预测、人工调整写入。
  - `tax.ts`：累计预扣税计算器（根据 TaxConfig & TaxBracket）。
  - `rule.ts`：城市社保、公积金、税率表配置校验与持久化。
  - `report.ts`：Dashboard、账户摘要、收入时序等聚合查询。
  - `audit.ts`：记录敏感操作日志。
- 设计要点：
  - 服务函数返回纯数据对象；路由层负责 DTO 校验与错误处理。
  - 重要计算（收入、税务）集中在服务层，保证前端只做展示。
  - 幂等性通过 `IdempotencyKey` 表实现（转账、规则写入等场景）。
  - 报表/账户聚合中跨币种金额一律经 USD 中间价折算，缺失汇率时须显式返回错误或回退原币种。

## 5. 数据模型（Prisma 摘要）
```
User(id, role, baseCurrency, displayCurrency, currentCityId)
UserPrefs(userId, displayCurrency, asOfDate)
ImpersonationSession(id, adminId, userId, expiresAt)
AuditLog(id, actorId, asUserId, action, payload, createdAt)

Account(id, userId, name, type, currency, status)
TransactionEntry(id, accountId, type, occurredAt, note)
TransactionLine(id, entryId, currency, amount, fxRateId)
ValuationSnapshot(id, accountId, totalValue, asOf, fxRateId)
FxRate(id, base, quote, rate, onDate)

IncomeChange(id, userId, effectiveFrom, grossMonthly, currency)
BonusPlan(id, userId, effectiveDate, amount, currency)
LongTermCashPlan(id, userId, totalAmount, currency, recurrence, periods)
LongTermCashPayout(id, planId, payDate, amount, currency)
EquityGrant(id, userId, totalUnits, startVestDate, vestPeriods, vestInterval)
EquityVest(id, grantId, vestDate, units, fairValue, currency)
IncomeRecord(id, userId, monthDate, ... 数值字段, manualOverrides, flags)
UserAnnualDeduction(id, userId, taxYear, deductionAmount, allocationRule)

City(id, name, country)
CityRuleSS(id, cityId, startDate, endDate, baseMin, baseMax, ratePension,
           rateMedical, fixedMedicalPersonal, rateUnemployment)
CityRuleHF(id, cityId, startDate, endDate, baseMin, baseMax, rateEmployee)
TaxConfig(country, taxYear, standardDeduction, defaultSpecialMonthly, ...)
TaxBracket(id, taxConfigId, threshold, rate, quickDeduction)
```
- `IncomeRecord` 需新增列：
  - `manualGross`, `manualNet`, `manualTaxable`, `manualIncomeTax`, `manualComment`（可空）。
  - `taxableCumulative`, `taxCumulative`, `taxPaid` 已存在，用于对账。
  - `isForecast` 标记预测数据；预测数据写入独立记录或临时视图。
- `UserAnnualDeduction`：记录用户年度“专线扣除”额度；后端计算时将年度值按 12 个月平均或按规则分摊。
- 主键与索引：
  - `IncomeRecord` 使用 `(userId, monthDate)` 唯一索引。
  - 规则表全部使用 `[cityId, startDate)` 唯一并要求 `endDate` 开区间不重叠。
  - `ImpersonationSession` 通过 `expiresAt` 定期清理。

## 6. 核心流程

### 6.1 收入回算（年度累计预扣）
1. 前端调用 `POST /api/income/recalc`，参数：`taxYear`, `endMonth`, `cityId?`, `useManualOverrides`。
2. 服务 `income.recalcIncome`：
   - 聚合工资变更（当月生效、同月取最后一次）。
   - 汇总奖金、LTC payout、股权归属 fairValue。
   - 读取城市规则计算社保、公积金（含医疗固定额）。
   - 读取年度 TaxConfig（标准扣除、默认专项附加）与 `UserAnnualDeduction`（折算为月度专线扣除）。
   - 若定义人工调整，直接使用覆盖字段并标记 `source = "MANUAL"`。
   - 调用 `calculateTax` 计算累计应税额、累计税、当月税。
   - 写回 `IncomeRecord`，填充 `taxableCumulative`、`taxCumulative`、`taxPaid`、`netIncome`、`manualApplied` 等字段。
3. 触发报表缓存失效，前端刷新收入表、Dashboard。

### 6.2 人工调整
1. 用户或管理员在收入明细表点击“人工调整”。
2. `PATCH /api/income/records/{id}` 写入 `manualGross/manualNet/...` 与备注。
3. 后端设置 `manualApplied = true` 并在回算时优先读取。
4. UI 标签提示“人工值”，预测视图也使用覆盖值。

### 6.3 管理员模拟登录
1. 管理员调用 `/api/admin/impersonate`，服务端验证权限、写 `ImpersonationSession`。
2. 中间件在后续请求中将 session context 切换为目标用户，但 AuditLog 记录 `actorId`。
3. 用户视角操作完成后调用 `/api/admin/impersonate/end` 恢复。

### 6.4 账户跨币种转账
1. 前端先通过 `/api/fxrates` 选择当日 FX snap（以 USD 为中间价）。
2. 通过 `/api/entries/transfer` 提交，后端校验账户币种、FX snap 时效与幂等键。
3. ledger 服务写两条 `TransactionLine` 并更新账户汇总缓存。

## 7. 报表与聚合
- `report.getDashboard`：
  - 查询账户余额（资产/负债）、估值、净资产，使用汇率折算到展示币种。
  - 调用 `income.getSummary` 获取年度累计收入、税、社保、公积金、本月收入。
  - 返回图表数据（资产走势、资产分配、重点账户列表）。
- `report.getIncomeTimeseries`：
  - 从 `IncomeRecord` 查询指定区间，按 `isForecast` 区分实际/预测。
  - 聚合 gross、bonus、tax、net、社保、公积金，并标注人工调整。
- 管理员端可传 `userId` 获取任意用户报表；普通用户仅能查询自身。
- 报表缓存：使用 SWR + ETag；高计算量聚合可在 Prisma 层使用 `GROUP BY` 或 `view`。

## 8. 任务与集成
- 当前无外部实时集成。未来若对接银行流水或薪资系统，可在服务层增加适配器。
- 手工同步真实收入到账户：提供导出 CSV；管理员可创建提醒任务（非自动化）。
- 定期作业：
  - 每日清理过期 `ImpersonationSession` 与旧 `IdempotencyKey`。
  - 每月初自动运行收入回算并通知用户确认。

## 9. 测试策略
- **测试分层**：统一使用 Vitest，所有用例放置在 `src/tests` 并遵循 `领域.层级.test.ts` 命名，例如 `income.service.test.ts`、`accounts.api.test.ts`。
  - 工具/纯函数：`src/lib/domain/*`、`src/lib/utils/*`，验证金额格式化、时间区间、汇率换算等。
  - 服务层：`src/server/services/*`，结合 Prisma Test Client 校验数据库交互、事务、一致性与幂等。
  - API Route：通过 `createNextHandler` + Supertest 模拟请求，重点覆盖权限校验、参数校验与响应码。
  - 前端模块（可选）：React Testing Library + Vitest 验证 `components/modules/*` 的交互逻辑。
  - 端到端冒烟：后续接入 Playwright，覆盖登录 → Dashboard、账户记账、收入回算、管理员模拟登录、规则维护。
- **命名与注释**：每个 `describe` / `it` 块前加入中文注释说明场景与预期；共享夹具在 `beforeEach` 中重置，避免跨用例污染。
- **测试基线准备**：
  - 在 `vitest.setup.ts` 配置专用 SQLite 数据库（例如 `file:./dev-test.db`），`beforeAll` 执行 `prisma migrate deploy`，`beforeEach` 清空相关表。
  - 提供夹具：`seedIncomeFixtures()`（复用 `doc/prd-income.md` 示例）、`makeUserWithCity()`（创建杭州规则用户）、`mockFxRate()` 等。
  - 常用断言：`expectMoneyEqual`、`expectDateEqual`，统一金额精度与时区比较。
- **重点用例覆盖**：
  - 收入域：工资同月多次取最后一次、社保上下限 clamp、医保固定额、专项附加扣除、累计预扣个税（对照 `doc/prd-income.md` 2025-01~03 示例）、人工调整优先级、年度回算幂等与预测标记。
  - 账户与报表：跨币种转账双边分录、幂等键重复提交、估值与收益率计算、报表聚合折算。
  - 规则维护：区间重叠校验、专项附加扣除更新、审计日志记录。
  - 权限与审计：管理员模拟登录流程、普通用户越权访问、敏感操作写入 `AuditLog`。
- **覆盖率与回归**：语句/函数/分支覆盖率目标 ≥ 90%，收入与账户服务达到 100%；发布前执行 `npm run lint && npm run test -- --runInBand`，重点回归收入回算、管理员模拟、转账幂等与规则更新。

## 10. 部署与运维
- 环境变量：`DATABASE_URL`、`NEXTAUTH_SECRET`、`NEXTAUTH_URL`、`ADMIN_EMAILS` 等。
- 构建流程：`npm install` → `npm run lint` → `npm run test` → `npm run build` → `prisma migrate deploy`。
- 数据迁移：
  - 手动调整与年度扣除引入需要新增字段/表，执行 `npx prisma migrate dev`（本地）或 `migrate deploy`（生产）。
  - 如需回滚，使用 Prisma migrate `resolve` + `down` 或备份恢复。
- 监控：Next.js 提供基础日志；建议在生产接入 APM（如 Sentry）监测请求错误与慢查询。

## 11. 演进路线
1. 完成 PRD 要求的人工调整、年度扣除、管理员模拟登录（必要迁移与 API 扩展）。
2. 引入报表缓存层（Redis 或 Prisma materialized view）以优化大数据量。
3. 账户与收入的自动对账：预留 Webhook/任务接口。
4. 权限细化（未来若需要审计角色可在现有架构上扩展）。
