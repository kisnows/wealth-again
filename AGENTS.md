# 项目与产品概览

- 平台目标：统一资产、负债、收入与税务视角，提供多币种净资产洞察，并支持收入预测与人工调整（见 `doc/prd.md`）。
- 收入侧覆盖工资、奖金、长期现金、股权激励，结合城市社保、公积金与个税规则做累计预扣（`doc/income-spec.md`）。
- 管理员可模拟登录用户，维护全局规则并执行人工回算；普通用户聚焦个人账户与收入。

## 角色与权限

- 普通用户：维护账户、交易、估值、收入及个人偏好，触发年度回算与数据导出。
- 管理员：拥有用户能力外，可查看全量数据、模拟登录、维护城市/税务配置并进行人工调整（详见 `doc/prd.md` 第 2 节）。
- 审计角色暂未实现，但需确保敏感操作进入 `AuditLog`。

## 核心功能与路由

- 主要路由：`/dashboard`（总览）、`/income/*`（收入管理与回算）、`/accounts`、`/entries/*`、`/rules/*`、`/settings`、`/signin`、`/signup`（详见 `doc/frontend-spec.md`）。
- Income 子路由覆盖工资变更、奖金、长期现金、股权、收入记录、年度回算；管理员工作台位于 `/admin/users`。
- 路由下的模块与数据源请对齐 `doc/frontend-spec.md` 的组件划分与交互说明。

## 技术架构

- 技术栈：Next.js 15 App Router + TypeScript、better-auth、Prisma（SQLite dev → Postgres prod）、Tailwind、shadcn/ui、SWR、Zustand、Vitest（`doc/tech.md`）。
- 架构分层：
  - 前端：`src/app`（路由与 RSC 布局）、`src/components`（UI 模块）
  - 客户端逻辑：`src/lib`（API 客户端、状态管理、领域工具）
  - 服务端：`src/server/services`（领域服务，按子系统组织）
  - API 层：`src/app/api/v1/*`（RESTful 接口）
- 子系统划分：
  - `accounts-ledger`：账户、交易、估值
  - `income-tax`：收入、税务计算、回算任务
  - `fx`：汇率快照与折算
  - `reporting`：报表与数据聚合
  - `identity`：用户、认证、城市配置
  - `audit`：审计日志
  - `jobs`：异步任务与事件处理

## 前端开发约束

- UI 库与样式：仅使用 shadcn/ui（置于 `src/components/ui`）和 Tailwind；新增组件通过 `pnpm dlx shadcn@latest add <component>`。
- 数据请求：统一 SWR + `src/lib/utils/fetcher.ts`；写操作经 `src/lib/api/*` 函数导出；跨模块状态使用 Zustand（`src/lib/state/*`）。
- 逻辑分层：业务逻辑/格式化放入 `src/lib/domain/*`，UI 文件 <= 500 行；复用模块放 `src/components/modules/*`。
- 表单体系：`react-hook-form` + `zod`，写操作附带 `Idempotency-Key`。
- 图表依赖 Recharts（暗色模式需校对配色）。
- 所有组件需添加 `data-testid` 属性以方便测试，命名规则为 `领域-层级-描述`，例如 `data-testid="income-ui-overview"`。
- 全局设置项（展示币种、城市、税务规则等）必须在 `/settings` 页面统一维护，其它页面只能读取现有值或提供跳转链接。
- 收入域的统计视图统一通过 `IncomeAnalyticsPanel` 复用；`/income` 是唯一收入中心，禁止额外的概览/表格实现。

## 数据模型与计算规则

- Prisma schema 与 `prisma/seed.js` 提供三年（2023–2025）杭州社保/公积金/个税规则与收入样例，涵盖 `CityRuleSS/HF`、`TaxConfig/TaxBracket`、`IncomeRecord` 等。
- 收入计算遵循累计预扣法：工资当月生效、同月多次取最后一次；社保、公积金基数按城市上下限 clamp；医保可带固定额；专项附加扣除可配置（`doc/income-spec.md`）。
- 对账字段需写入 `taxableCurrent`、`taxableCumulative`、`taxCumulative`、`taxPaidCumulative`、`netIncome`，保证年中回算一致性。
- 税率与城市规则需按时间区间版本化，API 更新后必须触发相关 SWR key 失效。

## 项目结构与模块组织

```
src/
├── app/                    # Next.js App Router 路由与页面
│   ├── api/v1/            # RESTful API（按子系统组织）
│   │   ├── accounts-ledger/
│   │   ├── income-tax/
│   │   ├── fx/
│   │   ├── reporting/
│   │   └── identity/
│   ├── dashboard/
│   ├── accounts/
│   ├── income/
│   ├── rules/
│   ├── settings/
│   ├── admin/
│   └── ...
├── components/
│   ├── ui/                # shadcn/ui 组件
│   └── modules/           # 业务复用模块
│       ├── accounts/
│       ├── income/
│       ├── fx/
│       ├── reporting/
│       └── layout/
├── lib/                   # 客户端共享代码
│   ├── api/              # API 客户端与 SWR hooks
│   ├── domain/           # 领域逻辑（格式化、计算等）
│   ├── state/            # Zustand stores
│   ├── hooks/            # 通用 React hooks
│   └── utils/            # 工具函数
├── server/               # 服务端代码
│   ├── services/         # 领域服务（按子系统组织）
│   │   ├── accounts-ledger/
│   │   ├── income-tax/
│   │   ├── fx/
│   │   ├── reporting/
│   │   ├── identity/
│   │   ├── audit/
│   │   └── jobs/
│   ├── auth.ts           # better-auth 配置
│   └── db.ts             # Prisma 客户端单例
├── tests/                # Vitest 测试
└── types/                # TypeScript 类型定义

prisma/                   # 数据库模型与迁移
doc/                      # 产品/技术文档
```

## 文档索引

文档统一索引位于 `doc/README.md`，核心文档包括：

| 文档 | 描述 |
|------|------|
| `doc/prd.md` | 总体产品需求 |
| `doc/tech.md` | 技术设计与安全策略 |
| `doc/income-spec.md` | 收入模块详细规格 |
| `doc/account-all.md` | 账户与汇率系统规格 |
| `doc/frontend-spec.md` | 前端开发规格 |
| `doc/openapi.json` | API 接口定义 |

## 构建、测试与开发命令

```bash
# 开发
pnpm dev                    # Turbopack 开发服务器（端口 4000）

# 构建与运行
pnpm build && pnpm start    # 生产构建与运行

# 代码质量
pnpm lint                   # Biome 检查
pnpm format                 # Biome 格式化
pnpm test                   # Vitest 测试

# 数据库
pnpm prisma migrate dev     # 开发迁移
pnpm prisma generate        # 生成 Prisma Client
node prisma/seed.js         # 运行种子数据
```

## 编码风格与测试规范

- TypeScript 严格模式，2 空格缩进，遵循 Biome 自动排序导入。
- React 组件采用 PascalCase，工具模块文件名使用 camelCase，路径优先 `@/*` 避免深层相对引用。
- 测试优先覆盖 `src/lib`、`src/server` 的纯逻辑与服务层计算，修复缺陷时补回归测试。
- 单元测试统一放在 `src/tests`，文件命名为 `领域.层级.test.ts`（如 `income.api.test.ts`、`accounts.service.test.ts`）。
- 每个 `describe`/`it` 之前需用中文注释解释场景用途；共享 mock/fixture 在 `beforeEach` 中重置。

## 提交与合并请求

- 使用 Conventional Commits（如 `feat:`、`fix:`、`docs:`、`refactor:`），标题 ≤ 72 字符。
- 合并前需保证：应用可本地运行、lint/format/test 全部通过、相关文档更新、数据库迁移可用。
- UI 改动需附截图；数据库/Schema 变更附对应 Prisma 迁移；敏感操作日志保持完整。

## 安全与配置

- 环境变量统一置于 `.env`（`DATABASE_URL`、`BETTER_AUTH_SECRET`、`ADMIN_EMAILS` 等），禁止提交。
- 仅在 `src/server` 放置敏感与服务端逻辑，避免泄露；管理员模拟登录需双重确认并写入 `AuditLog`。
- 部署流程：`pnpm install` → `pnpm lint` → `pnpm test` → `pnpm build` → `prisma migrate deploy`。

## 测试和验证

可以通过访问 http://localhost:4000 来验证每一个功能修改是否符合预期。

测试账号：
- 邮箱：demo@example.com
- 密码：demo

---

**所有的回答必须使用中文。**
