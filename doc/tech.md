# 技术设计文档（对齐 2025Q1 PRD）

## 1. 系统总览
- 技术栈：Next.js 15 App Router（TypeScript）、better-auth、Prisma（SQLite dev → Postgres prod）、Tailwind CSS + shadcn/ui、SWR、Zustand、Vitest。
- 架构分层：
  - 前端：`src/app` 负责路由与页面，`src/components` 存放 UI 组件，`src/lib` 管理客户端 API、状态和领域工具。
  - 服务端：`src/server` 提供 Prisma 单例、better-auth 配置与领域服务（ledger、income、tax、fx、report、rule、audit）。
  - API 层：使用 Next.js Route Handlers（`src/app/api/**`）对外提供 RESTful 接口。
  - 数据层：Prisma schema covering accounts、transactions、income、rules、audit、impersonation。

## 2. 前端架构总览
- App Router 负责页面与布局装配，Server Component 承担骨架渲染，Client Component 结合 SWR 提供实时数据刷新。
- 数据访问、状态管理、UI 约束等所有前端相关的规范，均已统一收敛至 **`doc/frontend-spec.md`**，该文档是前端实现的唯一事实来源。

## 3. 身份认证与权限
- 认证通过 better-auth（`src/server/auth.ts`）；数据库记录用户角色 `role: "USER" | "ADMIN"`。
- 守卫逻辑：
  - API Route Handler 通过 `auth.api.getSession` + `getUserFromRequest` 获取当前用户；若存在 `impersonatedUserId` 则切换上下文但保留 `actorId`。
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

## 5. 数据模型（Prisma 摘要）
- 详细的数据模型定义见 `prisma/schema.prisma` 文件。
- 核心实体包括：`User`, `Account`, `TxnEntry`, `TxnLine`, `IncomeRecord`, `CityRuleSS`, `CityRuleHF`, `TaxConfig` 等。

## 6. 核心流程

### 6.1 收入回算（年度累计预扣）
- 详细流程见 `doc/income-spec.md`。
- 简述：前端输入变更触发后端自动化异步任务，服务层聚合所有输入（工资、奖金、规则等），逐月计算并写回 `IncomeRecord`。

### 6.2 人工调整
- 用户或管理员在收入明细表点击“人工调整”。
- `PATCH /api/income/records/{id}` 写入 `manualGross/manualNet/...` 与备注。
- 后端设置 `manualApplied = true` 并在回算时优先读取。

### 6.3 管理员模拟登录
- 管理员调用 `/api/admin/impersonate`，服务端验证权限、写 `ImpersonationSession`。
- 中间件在后续请求中将 session context 切换为目标用户，但 AuditLog 记录 `actorId`。

## 7. 报表与聚合
- `report.getDashboard`：聚合账户、估值、汇率、收入数据，折算为用户展示币种后返回。
- `report.getIncomeTimeseries`：从 `IncomeRecord` 查询指定区间，按 `isForecast` 区分实际/预测。

## 8. 任务与集成
- **自动化收入回算**：作为核心异步任务，由输入变更触发。
- **定期作业**：每日清理过期的 `ImpersonationSession` 与 `IdempotencyKey`。

## 9. 测试策略
- **测试分层**：统一使用 Vitest，所有用例放置在 `src/tests`。
  - 工具/纯函数 (`/lib/domain`) → 服务层 (`/server/services`) → API Route (`/app/api`)。
- **测试基线准备**：
  - 在 `vitest.setup.ts` 配置专用测试数据库。
  - 提供测试夹具（Fixtures）用于创建用户、规则和收入等测试数据。
- **重点用例覆盖**：收入累计预扣税计算、社保公积金规则切换、跨币种转账、管理员模拟登录、规则区间重叠校验等。

## 10. 部署与运维
- **环境变量**：`DATABASE_URL`, `BETTER_AUTH_SECRET`, `ADMIN_EMAILS` 等。
- **构建与迁移**：标准 `npm` 脚本 + `prisma migrate deploy`。

## 11. 数据种子与业务规则参考

本节内容用于解释开发环境初始化数据的构成，并存档核心业务规则数据作为参考。

### 11.1 种子数据概览

种子脚本 (`prisma/seed.ts`) 的目标是填充一个包含近三年（2023-2025）真实业务规则的开发数据库，以便于功能开发和回归测试。

- **收入**: 模拟月度工资、年度奖金和季度长期现金。
- **规则**: 包含中国个人所得税规则和杭州市的社保/公积金规则。

### 11.2 核心业务规则数据存档

以下为嵌入种子脚本的核心业务规则，作为快速参考：

- **税务（中国个人所得税）**:
  - **规则**: 综合所得年度累计预扣法。
  - **标准扣除**: 5,000元/月 (自2019年起)。
  - **年度税率表**: 采用2019年至今的国家标准税率及速算扣除数。
  - **来源**: 普华永道(PwC)税务摘要。

- **社保/公积金（杭州市）**:
  - **社保个人缴费比例 (示例)**:
    - 养老: 8%
    - 医疗: 2%
    - 失业: 0.5%
  - **社保缴费基数上下限 (浙江省口径，杭州适用)**:
    - **2023**: 上限 24,060元, 下限 4,462元
    - **2024**: 上限 24,930元, 下限 4,812元
    - **2025**: 暂按 2024 标准
  - **住房公积金缴存基数 (杭州)**:
    - **2023 (自2023-07-01起)**: 上限 38,390元, 下限 2,280元
    - **2024 (自2024-07-01起)**: 上限 39,530元, 下限 2,490元
    - **2025 (自2025-07-01起)**: 上限 40,694元, 下限 2,490元
  - **公积金缴存比例**: 示例中使用员工个人 **12%**。
  - **来源**: 浙江省税务局、杭州公积金中心、12333服务热线等官方渠道。

### 11.3 使用方法

```bash
# 安装依赖、生成客户端并迁移数据库
pnpm install
pnpm prisma generate
pnpm prisma migrate dev

# 执行种子脚本填充数据
pnpm tsx prisma/seed.ts
```

## 12. 安全策略

### 12.1 注册与登录防护

- **验证码服务**: 推荐使用 hCaptcha / reCAPTCHA v2/v3 / 腾讯防水墙等 SaaS 服务。
  - 前端：在注册表单提交前请求验证码，并将 `token` 附带到注册接口中。
  - 后端：在 `/api/v1/identity/register` 中校验 `token`，失败时返回 422。
  - 配置：密钥写入 `.env`（如 `CAPTCHA_SITE_KEY`、`CAPTCHA_SECRET`）。

- **限流策略**: 对注册接口增加基础限流，可使用 Edge Middleware 或带 Redis 的限流器实现。

- **审计记录**: 将验证码失败、注册失败次数写入 `AuditLog`，便于后续监控。

### 12.2 敏感操作防护

- **管理员模拟登录**: 需双重确认并写入 `AuditLog`，包含 `actorId`、`asUserId`、`action`、`payload`。
- **规则修改**: 税率表、城市规则等全局配置变更需记录审计日志。
- **数据删除**: 账户、收入记录的删除操作需写入审计日志。
