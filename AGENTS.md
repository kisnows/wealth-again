# Repository Guidelines

## 项目结构与模块

- `src/app`：Next.js App Router 路由与 UI（如 `page.tsx`、`layout.tsx`，功能段位于 `accounts/`、`entries/`、`api/`）。
- `src/lib`：共享工具（`utils.ts`、`utils/*`），通过路径别名 `@/*` 引用。
- `src/server`：服务端辅助（如 Prisma 客户端单例 `db.ts`）。
- `src/tests`：单元测试（Vitest 风格，`*.test.ts`）。
- `prisma/`：Prisma 模型与迁移；本地开发使用 SQLite `dev.db`。
- `public/`：静态资源。`doc/`：产品/技术文档。

## 构建、测试与开发命令

- `npm run dev`：使用 Turbopack 在端口 4000 启动开发服务。
- `npm run build`：生产构建。
- `npm start`：启动已构建产物。
- `npm run lint`：使用 Biome 进行检查。
- `npm run format`：使用 Biome 格式化（写回）。
- Prisma：`npx prisma migrate dev` 应用/创建迁移；`npx prisma generate` 生成客户端。
- 测试（建议）：安装 Vitest 并添加脚本：`npm i -D vitest`，在 `package.json` 增加 `"test": "vitest"`，运行 `npm test`。

## 编码风格与命名

- 使用 TypeScript 严格模式；2 空格缩进（Biome 配置），自动整理导入。
- React 组件：PascalCase；与路由段就近放在 `src/app`。
- 工具模块：`src/lib` 使用 camelCase 文件名。
- 路径：优先使用 `@/*` 别名，避免相对路径穿越。
- 提交前运行：`npm run lint && npm run format`。

## 测试规范

- 位置与命名：放在 `src/tests`，使用 `*.test.ts`。
- 示例：`src/tests/auth-config.test.ts`。
- 关注点：优先覆盖 `src/lib`/`src/server` 的纯逻辑；对修复过的缺陷补回归测试。
- 覆盖率：保证关键模块有基本路径覆盖，PR 需说明新增/变更测试。

## 提交与合并请求

- 建议使用 Conventional Commits：`feat:`、`fix:`、`docs:`、`refactor:` 等；标题不超过 72 字符。
- PR 要求：清晰描述、关联 Issue、UI 变更附截图；数据库/Schema 变化需附 Prisma 迁移。
- 合并前检查：本地可运行、lint/format 通过、测试通过、更新相关文档（`doc/` 或 README）。

## 安全与配置

- 环境变量：使用 `.env`（如 `DATABASE_URL`、认证密钥），勿提交到版本库。
- Prisma：开发使用 SQLite，本地确认迁移后再合并。
- 日志/隐私：避免输出敏感信息；仅服务器端代码放于 `src/server`。

## 约束

- 组件库必须使用 shadcn/ui 组件库, `component/ui` 下只能放 shadcn/ui 组件，增加 shadcn 组件时必须使用类似 `pnpm dlx shadcn@latest add sonner` 的命令来添加
- 样式方案必须使用 tailwindcss，不要使用其他样式方案
