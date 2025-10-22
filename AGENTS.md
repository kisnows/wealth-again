# 项目与产品概览

- 平台目标：统一资产、负债、收入与税务视角，提供多币种净资产洞察，并支持收入预测与人工调整（见 `doc/prd.md`）。
- 收入侧覆盖工资、奖金、长期现金、股权激励，结合城市社保、公积金与个税规则做累计预扣（`doc/prd-income.md`）。
- 管理员可模拟登录用户，维护全局规则并执行人工回算；普通用户聚焦个人账户与收入。

## 角色与权限

- 普通用户：维护账户、交易、估值、收入及个人偏好，触发年度回算与数据导出。
- 管理员：拥有用户能力外，可查看全量数据、模拟登录、维护城市/税务配置并进行人工调整（详见 `doc/prd.md` 第 2 节）。
- 审计角色暂未实现，但需确保敏感操作进入 `AuditLog`。

## 核心功能与路由

- 主要路由：`/dashboard`（总览）、`/income/*`（收入管理与回算）、`/accounts`、`/entries/*`、`/rules/*`、`/settings`、`/signin`（详见 `doc/frontend-spec.md`）。
- Income 子路由需覆盖工资变更、奖金、长期现金、股权、收入记录、年度回算；管理员工作台 `/admin/users`、`/admin/activity` 计划待补充。
- 路由下的模块与数据源请对齐 `doc/frontend-spec.md` 的组件划分与交互说明。

## 技术架构

- 技术栈：Next.js 15 App Router + TypeScript、NextAuth、Prisma（SQLite dev → Postgres prod）、Tailwind、shadcn/ui、SWR、Zustand、Vitest（`doc/tech.md`）。
- 架构分层：前端 `src/app`（路由与 RSC 布局）/`components`（UI 模块），客户端逻辑在 `src/lib`；服务端 Domain Services 位于 `src/server/services`；Route Handlers 暴露 REST API。
- 核心服务：ledger、income、tax、rule、report、fx、audit；所有重要计算置于服务层，接口层负责校验与错误处理。

## 前端开发约束

- UI 库与样式：仅使用 shadcn/ui（置于 `components/ui`）和 Tailwind；新增组件通过 shadcn 的 mcp 服务或者直接使用 `pnpm dlx shadcn@latest add <component>`。
- 数据请求：统一 SWR + `src/lib/utils/fetcher.ts`；写操作经 `src/lib/api/*` 函数导出；跨模块状态使用 Zustand（`src/lib/state/*`）。
- 逻辑分层：业务逻辑/格式化放入 `src/lib/domain/*` 或 `src/lib/services/*`，UI 文件 <= 500 行；复用模块放 `components/modules/*`。
- 表单体系：`react-hook-form` + `zod`，写操作附带 `Idempotency-Key`。
- 图表依赖 Recharts（暗色模式需校对配色）。
- 所有的组件需要添加 `data-testid` 属性以方便测试, 命名规则为 领域-层级-描述, 例如 `data-testid="income-ui-overview"`。
- 全局设置项（基准币种、展示币种、统计日期、城市、税务规则等）必须在 `/settings` 页面统一维护，其它页面只能读取现有值或提供跳转链接。
- 收入域的统计视图统一通过时间线版 `IncomeAnalyticsPanel` 复用；`/income` 是唯一收入中心，禁止额外的概览/表格实现。

## 数据模型与计算规则

- Prisma schema 与 `prisma/seed.ts` 提供三年（2023–2025）杭州社保/公积金/个税规则与收入样例（`doc/data.md`），涵盖 `CityRuleSS/HF`、`TaxConfig/TaxBracket`、`IncomeRecord` 等。
- 收入计算遵循累计预扣法：工资当月生效、同月多次取最后一次；社保、公积金基数按城市上下限 clamp；医保可带固定额；专项附加扣除可配置（`doc/prd-income.md`）。
- 对账字段需写入 `taxableCurrent`、`taxableCumulative`、`taxCumulative`、`taxPaidCumulative`、`netIncome`，保证年中回算一致性。
- 税率与城市规则需按时间区间版本化，API 更新后必须触发相关 SWR key 失效。

## 项目结构与模块组织

- `src/app`：Next.js App Router 路由与 UI（如 `dashboard/`、`accounts/`、`income/`、`api/`）；组件与路由就近放置。
- `components/ui`：shadcn 组件；`components/modules`：业务复用模块（表格、图表、表单等）。
- `src/lib`：共享工具、API 客户端、Zustand store、领域逻辑（通过 `@/*` 引用）。
- `src/server`：Prisma 客户端单例、NextAuth 配置、服务端领域服务。
- `src/tests`：Vitest 测试（严格按照 `*.test.ts` 命名）。
- `prisma/`：模型与迁移；本地使用 SQLite `dev.db`，生产切换 Postgres。
- `doc/`：产品/技术文档；`public/`：静态资源。
- 全局币种、汇率、税务与城市规则在 `/settings` 页面集中维护，其它页面仅读取现有配置或提供跳转入口。

## 构建、测试与开发命令

- `npm run dev`：Turbopack 开发服务器（默认端口 4000）。
- `npm run build` → `npm start`：生产构建与运行。
- `npm run lint` / `npm run format`：Biome 检查与格式化。
- Prisma：`npx prisma migrate dev`、`npx prisma generate`；`pnpm tsx prisma/seed.ts` 运行种子。
- 测试：安装 Vitest（`npm i -D vitest`，`"test": "vitest"`）后执行 `npm test`。

## 编码风格与测试规范

- TypeScript 严格模式，2 空格缩进，遵循 Biome 自动排序导入。
- React 组件采用 PascalCase，工具模块文件名使用 camelCase，路径优先 `@/*` 避免深层相对引用。
- 测试优先覆盖 `src/lib`、`src/server` 的纯逻辑与服务层计算，修复缺陷时补回归测试；使用 PRD 示例数据验证税务与收入计算（`doc/prd-income.md`）。
- 单元测试统一放在 `src/tests`，文件命名为 `领域.层级.test.ts`（如 `income.api.test.ts`、`accounts.service.test.ts`、`reports.ui.test.ts`），同一模块的 API/Service/UI/Utils 用例集中在单个文件中维护。
- 每个 `describe`/`it` 之前需用中文注释解释场景用途；共享 mock/fixture 在 `beforeEach` 中重置，避免跨测试污染。

## 提交与合并请求

- 使用 Conventional Commits（如 `feat:`、`fix:`、`docs:`、`refactor:`），标题 ≤ 72 字符。
- 合并前需保证：应用可本地运行、lint/format/test 全部通过、相关文档（`doc/` 或 README）更新、数据库迁移可用。
- UI 改动需附截图；数据库/Schema 变更附对应 Prisma 迁移；敏感操作日志保持完整。

## 安全与配置

- 环境变量统一置于 `.env`（`DATABASE_URL`、`NEXTAUTH_SECRET`、`ADMIN_EMAILS` 等），禁止提交。
- 仅在 `src/server` 放置敏感与服务端逻辑，避免泄露；管理员模拟登录需双重确认并写入 `AuditLog`。
- 部署流程（`doc/tech.md` 第 10 节）：`npm install` → `npm run lint` → `npm run test` → `npm run build` → `prisma migrate deploy`。

## 当前改造计划

- 参考 `doc/plans/prd-income-implementation-plan.md`：需完成工资当月生效逻辑、医保固定额与专项附加扣除、收入对账字段、规则页面更新及对应测试。
- 验收要求：使用 `doc/prd-income.md` 示例数据回算 1–3 月，确保社保=2103、公积金=2400、个税与净收入匹配示例；接口幂等与页面展示需同步更新。

## 文档索引

- 统一索引位于 `doc/README.md`，涵盖 PRD、技术设计、UI、测试与计划等全部文档的单一来源。

## 测试和验证

可以通过访问 http://localhost:4000 来验证每一个功能修改是否符合预期。
测试账号：

- 测试账号： demo@example.com
- 测试密码： demo

所有的回答必须使用中文。
