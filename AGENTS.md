# Repository Guidelines

## 项目结构与模块组织
- `src/app`：Next.js App Router 路由与 UI（如 `accounts/`、`entries/`、`api/`）。组件与路由就近放置。
- `src/lib`：共享工具（`utils.ts`、`utils/*`），通过路径别名 `@/*` 引用。
- `src/server`：仅服务器端代码（如 Prisma 客户端单例 `db.ts`）。
- `src/tests`：单元测试（Vitest 风格），文件命名为 `*.test.ts`。
- `prisma/`：Prisma 模型与迁移；本地开发使用 SQLite `dev.db`。
- `public/`：静态资源；`doc/`：产品/技术文档。

## 构建、测试与开发命令
- `npm run dev`：使用 Turbopack 启动开发服务器（端口 4000）。
- `npm run build`：生产构建；`npm start`：运行已构建产物。
- `npm run lint`：Biome 代码检查；`npm run format`：Biome 格式化（写回）。
- Prisma：`npx prisma migrate dev` 应用/创建迁移；`npx prisma generate` 生成客户端。
- 测试：`npm i -D vitest` 并在 `package.json` 增加 `"test": "vitest"`，然后 `npm test`。

## 编码风格与命名
- TypeScript 严格模式；2 空格缩进（Biome 自动整理导入）。
- React 组件使用 PascalCase；与路由段就近放在 `src/app`。
- 工具模块在 `src/lib`，文件名使用 camelCase。
- 路径优先使用 `@/*`，避免相对路径深层穿越。

## 测试规范
- 位置与命名：`src/tests`，文件以 `*.test.ts` 结尾。
- 关注点：优先覆盖 `src/lib`、`src/server` 的纯逻辑；修复缺陷需补回归测试。
- 覆盖：保证关键模块基本路径覆盖；使用 `npm test` 运行。

## 提交与合并请求
- 提交遵循 Conventional Commits（如 `feat:`、`fix:`、`docs:`、`refactor:`），标题不超过 72 字符。
- PR 需清晰描述并关联 Issue；涉及 UI 变更请附截图；数据库/Schema 变化需附 Prisma 迁移。
- 合并前：本地可运行、lint/format 通过、测试通过，并更新相关文档（`doc/` 或 README）。

## 安全与配置
- 使用 `.env` 管理环境变量（如 `DATABASE_URL`、认证密钥），勿提交到版本库。
- 仅将敏感/服务端逻辑放在 `src/server`；避免输出敏感日志。
- 合并前在本地确认 Prisma 迁移可用。

## UI 与样式约束
- 组件库必须使用 shadcn/ui，且仅在 `component/ui` 放置 shadcn 组件；新增组件用 `pnpm dlx shadcn@latest add <component>`。
- 样式必须使用 Tailwind CSS，禁止引入其他样式方案。
